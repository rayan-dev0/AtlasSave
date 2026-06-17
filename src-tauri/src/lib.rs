mod config;
mod core {
    pub mod archiver;
    pub mod debouncer;
    pub mod uploader;
    pub mod watcher;
}
mod utils {
    pub mod detector;
}
mod commands;

use std::sync::Arc;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};

pub struct AppState {
    pub config_manager: std::sync::Mutex<config::ConfigManager>,
    pub watcher: std::sync::Mutex<core::watcher::SaveWatcher>,
    pub debouncer: core::debouncer::Debouncer,
    pub uploader: core::uploader::Uploader,
    pub monitoring_active: std::sync::Mutex<bool>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::get_config,
            commands::save_config,
            commands::get_profiles,
            commands::add_profile,
            commands::update_profile,
            commands::remove_profile,
            commands::detect_save_path,
            commands::manual_backup_all,
            commands::test_git_connection,
            commands::toggle_monitoring,
            commands::is_monitoring_active,
            commands::select_directory,
            commands::select_file,
            commands::fetch_game_cover_art,
            commands::search_game_covers,
            commands::get_backups,
            commands::restore_backup,
            commands::rename_backup,
            commands::delete_backup,
            commands::open_backup_directory,
            commands::manual_backup_profile,
            commands::get_log_history,
            commands::clear_log_history,
            commands::trigger_git_sync,
            commands::launch_game,
            commands::get_profile_storage_stats,
            commands::prune_profile_backups,
            commands::scan_steam_library,
            commands::get_system_storage_stats,
        ])
        .setup(|app| {
            let config_manager = config::ConfigManager::new();
            let config_dir = config_manager.config_dir.clone();

            let app_handle = app.handle().clone();
            let uploader = core::uploader::Uploader::new(app_handle.clone(), config_dir);

            // 1. Setup debouncer callback (triggers zip archival & cloud sync)
            let app_handle_clone1 = app_handle.clone();
            let debouncer_callback = move |profile_id: String| {
                let app_handle = app_handle_clone1.clone();
                let state = app_handle.state::<AppState>();
                let config = state.config_manager.lock().unwrap();

                if let Some(profile) = config.data.profiles.iter().find(|p| p.id == profile_id) {
                    if !profile.enabled {
                        return;
                    }

                    let name = profile.name.clone();
                    let source_path = std::path::PathBuf::from(&profile.source_path);
                    let backups_dir = config.backups_dir.clone();
                    let max_backups = config.data.global.max_backups;
                    let providers = config.data.providers.clone();
                    let uploader_clone = state.uploader.clone_sender();
                    let app_handle_clone2 = app_handle.clone();

                    tauri::async_runtime::spawn(async move {
                        let archiver = core::archiver::Archiver::new(backups_dir);
                        commands::log_message(
                            &app_handle_clone2,
                            format!("Initiating compression for {}...", name),
                        );

                        match archiver.archive_profile(
                            &profile_id,
                            &name,
                            &source_path,
                            max_backups,
                        ) {
                            Ok(zip_path) => {
                                let file_size =
                                    std::fs::metadata(&zip_path).map(|m| m.len()).unwrap_or(0);
                                {
                                    let state = app_handle_clone2.state::<AppState>();
                                    let mut config = state.config_manager.lock().unwrap();
                                    config.data.stats.total_backups += 1;
                                    config.data.stats.last_backup_time = chrono::Local::now()
                                        .format("%Y-%m-%d %H:%M:%S")
                                        .to_string();
                                    let mb_size = file_size as f64 / (1024.0 * 1024.0);
                                    config.data.stats.total_size_mb =
                                        (config.data.stats.total_size_mb + mb_size * 100.0).round()
                                            / 100.0;
                                    config.save();
                                }

                                uploader_clone.enqueue(core::uploader::UploadTask {
                                    file_path: zip_path,
                                    profile_name: name.clone(),
                                    providers,
                                });

                                let _ = app_handle_clone2.emit("stats-updated", ());
                            }
                            Err(e) => {
                                commands::log_message(
                                    &app_handle_clone2,
                                    format!("Archival failed: {}", e),
                                );
                            }
                        }
                    });
                }
            };

            let debouncer = core::debouncer::Debouncer::new(Arc::new(debouncer_callback));

            // 2. Setup watcher callback (routes events to the debouncer)
            let app_handle_clone3 = app_handle.clone();
            let watcher_callback = move |profile_id: String| {
                let app_handle = app_handle_clone3.clone();
                let state = app_handle.state::<AppState>();
                let config = state.config_manager.lock().unwrap();
                let debounce_seconds = config.data.global.debounce_seconds;
                state.debouncer.on_change(profile_id, debounce_seconds);
            };

            let mut watcher = core::watcher::SaveWatcher::new(Arc::new(watcher_callback));

            // Start watcher initially with loaded profiles
            watcher.start(&config_manager.data.profiles);

            // Register global AppState
            app.manage(AppState {
                config_manager: std::sync::Mutex::new(config_manager),
                watcher: std::sync::Mutex::new(watcher),
                debouncer,
                uploader,
                monitoring_active: std::sync::Mutex::new(true),
            });

            // 3. System Tray configurations
            let show_item = MenuItem::with_id(app, "show", "Open UI", true, None::<&str>)?;
            let toggle_item = MenuItem::with_id(
                app,
                "toggle_monitor",
                "Toggle Monitoring",
                true,
                None::<&str>,
            )?;
            let quit_item = MenuItem::with_id(app, "quit", "Exit AtlasSave", true, None::<&str>)?;
            let tray_menu = Menu::with_items(app, &[&show_item, &toggle_item, &quit_item])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&tray_menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        app.exit(0);
                    }
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "toggle_monitor" => {
                        let state = app.state::<AppState>();
                        let is_active = commands::toggle_monitoring(app.clone(), state);
                        commands::log_message(
                            app,
                            format!("Monitoring state toggled via tray. Active: {}", is_active),
                        );
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: tauri::tray::MouseButton::Left,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            // 4. Intercept close event to minimize to tray
            let window = app.get_webview_window("main").unwrap();
            let window_clone = window.clone();
            window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window_clone.hide();
                    let app_handle = window_clone.app_handle();
                    commands::log_message(
                        app_handle,
                        "AtlasSave minimized to system tray.".to_string(),
                    );
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
