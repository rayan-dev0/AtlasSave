use crate::config::{Config, Profile};
use crate::core::archiver::Archiver;
use crate::core::uploader::{UploadTask, Uploader};
use crate::utils::detector;
use crate::AppState;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager, State};
use uuid::Uuid;

struct BackupGuard<'a> {
    app_handle: &'a AppHandle,
}

impl<'a> Drop for BackupGuard<'a> {
    fn drop(&mut self) {
        let _ = self.app_handle.emit("backup-status", "idle");
    }
}

pub fn log_message(app: &AppHandle, message: String) {
    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let formatted = format!("[{}] {}", now, message);
    println!("{}", formatted);
    let _ = app.emit("log-event", formatted.clone());

    if let Some(state) = app.try_state::<AppState>() {
        let log_file_path = state.config_dir.join("atlas_save.log");
        if let Ok(mut file) = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_file_path)
        {
            use std::io::Write;
            let _ = writeln!(file, "{}", formatted);
        }
    }
}

#[tauri::command]
pub fn get_config(state: State<'_, AppState>) -> Config {
    let config = state.config_manager.lock().unwrap();
    config.data.clone()
}

#[tauri::command]
pub fn save_config(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    new_config: Config,
) -> Result<(), String> {
    let mut config = state.config_manager.lock().unwrap();
    config.data = new_config;
    config.save();

    // Trigger watcher reload
    let mut watcher = state.watcher.lock().unwrap();
    let is_active = *state.monitoring_active.lock().unwrap();
    if is_active {
        watcher.start(&config.data.profiles);
    }

    log_message(&app_handle, "Configuration updated and saved.".to_string());

    // Mirror config change to uploader (saving config as a backup item)
    state.uploader.enqueue(UploadTask {
        file_path: config.config_file.clone(),
        profile_name: "Config".to_string(),
        providers: config.data.providers.clone(),
    });

    Ok(())
}

#[tauri::command]
pub fn get_profiles(state: State<'_, AppState>) -> Vec<Profile> {
    let config = state.config_manager.lock().unwrap();
    config.data.profiles.clone()
}

#[tauri::command]
pub fn add_profile(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    name: String,
    source_path: String,
    cover_url: Option<String>,
    exe_path: Option<String>,
) -> Result<Profile, String> {
    let mut config = state.config_manager.lock().unwrap();

    let resolved_path = PathBuf::from(&source_path);
    let absolute_path = resolved_path
        .canonicalize()
        .unwrap_or(resolved_path)
        .to_string_lossy()
        .to_string();

    let final_cover_url = match cover_url {
        Some(url) => Some(url),
        None => fetch_cover_art_helper(&name),
    };

    let default_sp_id = Uuid::new_v4().to_string();
    let default_sp = crate::config::SaveProfile {
        id: default_sp_id.clone(),
        name: "Default Profile".to_string(),
        created_at: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
    };

    let profile = Profile {
        id: Uuid::new_v4().to_string(),
        name: name.clone(),
        source_path: absolute_path,
        enabled: true,
        cover_url: final_cover_url,
        exe_path,
        save_profiles: vec![default_sp],
        active_save_profile_id: Some(default_sp_id),
    };

    config.data.profiles.push(profile.clone());
    config.save();

    // Reload watcher
    let mut watcher = state.watcher.lock().unwrap();
    let is_active = *state.monitoring_active.lock().unwrap();
    if is_active {
        watcher.start(&config.data.profiles);
    }

    log_message(&app_handle, format!("Game profile added: {}", name));
    Ok(profile)
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn update_profile(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    id: String,
    name: String,
    source_path: String,
    enabled: bool,
    cover_url: Option<String>,
    exe_path: Option<String>,
) -> Result<bool, String> {
    let mut config = state.config_manager.lock().unwrap();
    let mut found = false;

    for profile in &mut config.data.profiles {
        if profile.id == id {
            profile.name = name.clone();

            let resolved_path = PathBuf::from(&source_path);
            profile.source_path = resolved_path
                .canonicalize()
                .unwrap_or(resolved_path)
                .to_string_lossy()
                .to_string();

            profile.enabled = enabled;
            profile.cover_url = cover_url.clone();
            profile.exe_path = exe_path.clone();

            found = true;
            break;
        }
    }

    if found {
        config.save();
        let mut watcher = state.watcher.lock().unwrap();
        let is_active = *state.monitoring_active.lock().unwrap();
        if is_active {
            watcher.start(&config.data.profiles);
        }
        log_message(&app_handle, format!("Game profile updated: {}", name));
        Ok(true)
    } else {
        Err("Profile not found".to_string())
    }
}

#[tauri::command]
pub fn remove_profile(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<bool, String> {
    let mut config = state.config_manager.lock().unwrap();
    let original_len = config.data.profiles.len();

    config.data.profiles.retain(|p| p.id != id);

    if config.data.profiles.len() < original_len {
        config.save();
        let mut watcher = state.watcher.lock().unwrap();
        let is_active = *state.monitoring_active.lock().unwrap();
        if is_active {
            watcher.start(&config.data.profiles);
        }
        log_message(&app_handle, "Game profile removed.".to_string());
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub fn detect_save_path(executable_path: String) -> Option<String> {
    let path = PathBuf::from(executable_path);
    detector::detect_save_directory(path).map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
pub fn manual_backup_all(app_handle: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let config = state.config_manager.lock().unwrap();
    let enabled_profiles: Vec<Profile> = config
        .data
        .profiles
        .iter()
        .filter(|p| p.enabled)
        .cloned()
        .collect();

    if enabled_profiles.is_empty() {
        log_message(
            &app_handle,
            "Manual backup skip: No enabled game profiles.".to_string(),
        );
        return Ok(());
    }

    let backups_root = config.backups_dir.clone();
    let max_backups = config.data.global.max_backups;
    let providers = config.data.providers.clone();
    let uploader_sender = state.uploader.clone_sender();
    let app_handle_clone = app_handle.clone();

    let _ = app_handle.emit("backup-status", "running");
    // Run manual backups in background tasks
    tauri::async_runtime::spawn(async move {
        let _guard = BackupGuard {
            app_handle: &app_handle_clone,
        };
        let archiver = Archiver::new(backups_root);
        for profile in enabled_profiles {
            let active_sp_name = if let Some(active_id) = &profile.active_save_profile_id {
                profile
                    .save_profiles
                    .iter()
                    .find(|sp| &sp.id == active_id)
                    .map(|sp| sp.name.clone())
            } else {
                None
            };
            let profile_name_combined = match active_sp_name {
                Some(sp_name) => format!("{} - {}", profile.name, sp_name),
                None => profile.name.clone(),
            };
            let name = format!("{}_manual", profile_name_combined);
            let source_path = PathBuf::from(&profile.source_path);

            log_message(
                &app_handle_clone,
                format!("Manual backup starting for: {}", profile.name),
            );
            match archiver.archive_profile(&profile.id, &name, &source_path, max_backups) {
                Ok(zip_path) => {
                    let file_size = std::fs::metadata(&zip_path).map(|m| m.len()).unwrap_or(0);
                    {
                        let state = app_handle_clone.state::<AppState>();
                        let mut config = state.config_manager.lock().unwrap();
                        config.data.stats.total_backups += 1;
                        config.data.stats.last_backup_time =
                            chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
                        let mb_size = file_size as f64 / (1024.0 * 1024.0);
                        config.data.stats.total_size_mb =
                            (config.data.stats.total_size_mb + mb_size * 100.0).round() / 100.0;
                        config.save();
                    }

                    uploader_sender.enqueue(UploadTask {
                        file_path: zip_path,
                        profile_name: name.clone(),
                        providers: providers.clone(),
                    });

                    let _ = app_handle_clone.emit("stats-updated", ());
                }
                Err(e) => {
                    log_message(
                        &app_handle_clone,
                        format!("Manual backup failed for {}: {}", name, e),
                    );
                }
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn test_git_connection(repo_url: String) -> Result<String, String> {
    Uploader::test_git_connection(&repo_url)
}

#[tauri::command]
pub async fn import_remote_git_config(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    git_config: crate::config::GitProvider,
) -> Result<Option<String>, String> {
    log_message(
        &app_handle,
        "Checking remote Git repository for existing config...".to_string(),
    );

    let config_dir = {
        let config = state.config_manager.lock().unwrap();
        config.config_dir.clone()
    };
    let git_dir = config_dir.join("git_repo");

    // 1. Initialize git repo locally if needed and apply configurations
    if let Err(e) = Uploader::ensure_git_repo_init(&app_handle, &git_dir, &git_config) {
        log_message(
            &app_handle,
            format!("Failed to initialize Git repository: {}", e),
        );
        return Err(format!("Git initialization failed: {}", e));
    }

    // 2. Fetch and Pull remote changes (using remote changes in case of conflict)
    log_message(&app_handle, "Pulling remote updates...".to_string());
    let _ = Uploader::run_git_cmd(&git_dir, &["fetch", "origin"]);
    let pull_res = Uploader::run_git_cmd(
        &git_dir,
        &[
            "pull",
            "origin",
            &git_config.branch,
            "--rebase",
            "-X",
            "theirs",
        ],
    );

    match pull_res {
        Ok(_) => log_message(&app_handle, "Pull complete.".to_string()),
        Err(e) => {
            log_message(
                &app_handle,
                format!("Pull error: {}. Attempting to proceed...", e),
            );
        }
    }

    // 3. Check if remote config exists
    let remote_config_path = git_dir.join("Config").join("config.json");
    if !remote_config_path.exists() {
        log_message(&app_handle, "No existing AtlasSave config found in remote repository. Initializing remote with local settings...".to_string());

        // Save the entered Git config normally to local config.json
        let mut config_mgr = state.config_manager.lock().unwrap();
        config_mgr.data.providers.git = git_config.clone();
        config_mgr.save();

        let local_config = config_mgr.data.clone();
        let backups_dir = config_mgr.backups_dir.clone();
        drop(config_mgr);

        // Create Config directory inside local git_repo clone
        let git_config_dir = git_dir.join("Config");
        if let Err(e) = std::fs::create_dir_all(&git_config_dir) {
            log_message(
                &app_handle,
                format!("Failed to create remote Config directory: {}", e),
            );
            return Err(format!("Failed to create Config directory: {}", e));
        }

        // Write local config to git_repo/Config/config.json
        let remote_config_file = git_config_dir.join("config.json");
        let serialized = serde_json::to_string_pretty(&local_config)
            .map_err(|e| format!("Failed to serialize config: {}", e))?;
        if let Err(e) = std::fs::write(&remote_config_file, serialized) {
            log_message(
                &app_handle,
                format!("Failed to write configuration file to git repo: {}", e),
            );
            return Err(format!("Failed to write configuration to git repo: {}", e));
        }

        // Copy any existing local backups to git_repo folder so they get pushed
        log_message(
            &app_handle,
            "Staging existing local backups to git repository...".to_string(),
        );
        for profile in &local_config.profiles {
            let sanitized_name = crate::core::uploader::sanitize_profile_name(&profile.name);
            let profile_git_dir = git_dir.join(&sanitized_name);
            let profile_backups_dir = backups_dir.join(&profile.id);
            if profile_backups_dir.exists() && profile_backups_dir.is_dir() {
                if let Err(e) = std::fs::create_dir_all(&profile_git_dir) {
                    log_message(
                        &app_handle,
                        format!("Failed to create folder for {}: {}", profile.name, e),
                    );
                    continue;
                }
                if let Ok(entries) = std::fs::read_dir(profile_backups_dir) {
                    for entry in entries.flatten() {
                        let path = entry.path();
                        if path.is_file() && path.extension().is_some_and(|ext| ext == "zip") {
                            if let Some(filename) = path.file_name() {
                                let dest_file = profile_git_dir.join(filename);
                                if !dest_file.exists() {
                                    let _ = std::fs::copy(&path, &dest_file);
                                }
                            }
                        }
                    }
                }
            }
        }

        // Commit and Push
        log_message(&app_handle, "Staging files for commit...".to_string());
        if let Err(e) = Uploader::run_git_cmd(&git_dir, &["add", "."]) {
            log_message(&app_handle, format!("Git add failed: {}", e));
            return Err(format!("Git add failed: {}", e));
        }

        log_message(
            &app_handle,
            "Committing initial configuration...".to_string(),
        );
        let commit_msg = "Initial AtlasSave config and backup push".to_string();
        if let Err(e) = Uploader::run_git_cmd(&git_dir, &["commit", "-m", &commit_msg]) {
            log_message(&app_handle, format!("Git commit notice: {}", e));
        }

        log_message(
            &app_handle,
            "Pushing configuration and backups to remote...".to_string(),
        );
        match Uploader::run_git_cmd(&git_dir, &["push", "origin", &git_config.branch]) {
            Ok(_) => {
                log_message(
                    &app_handle,
                    "Initial push completed successfully!".to_string(),
                );
            }
            Err(e) => {
                log_message(
                    &app_handle,
                    format!("Push failed: {}. Retrying with pull rebase...", e),
                );
                let _ = Uploader::run_git_cmd(
                    &git_dir,
                    &[
                        "pull",
                        "origin",
                        &git_config.branch,
                        "--rebase",
                        "-X",
                        "theirs",
                    ],
                );
                if let Err(e2) =
                    Uploader::run_git_cmd(&git_dir, &["push", "origin", &git_config.branch])
                {
                    log_message(&app_handle, format!("Git push failed: {}", e2));
                    return Err(format!("Git push failed: {}. Please ensure the remote repository is empty or reachable.", e2));
                }
            }
        }

        return Ok(Some("No remote configuration was found.\nSuccessfully initialized repository and uploaded local settings/backups.".to_string()));
    }

    log_message(
        &app_handle,
        "Existing AtlasSave config found. Importing configuration...".to_string(),
    );

    // 4. Read and parse remote config
    let content = std::fs::read_to_string(&remote_config_path)
        .map_err(|e| format!("Failed to read remote config: {}", e))?;
    let remote_config: Config = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse remote config: {}", e))?;

    // 5. Merge config and save locally
    let mut local_config_mgr = state.config_manager.lock().unwrap();

    local_config_mgr.data.profiles = remote_config.profiles.clone();
    local_config_mgr.data.global.max_backups = remote_config.global.max_backups;
    local_config_mgr.data.global.debounce_seconds = remote_config.global.debounce_seconds;
    if !remote_config.global.steamgriddb_api_key.is_empty() {
        local_config_mgr.data.global.steamgriddb_api_key =
            remote_config.global.steamgriddb_api_key.clone();
    }

    // Set the user's entered Git settings
    local_config_mgr.data.providers.git = git_config;
    local_config_mgr.save();

    let local_config = local_config_mgr.data.clone();
    let backups_dir = local_config_mgr.backups_dir.clone();
    drop(local_config_mgr); // Release lock before copying and extracting

    // 6. Copy remote backups ZIPs to local backups folder
    log_message(
        &app_handle,
        "Importing remote save backup archives...".to_string(),
    );
    for profile in &local_config.profiles {
        let sanitized_name = crate::core::uploader::sanitize_profile_name(&profile.name);
        let profile_git_dir = git_dir.join(&sanitized_name);
        if profile_git_dir.exists() && profile_git_dir.is_dir() {
            let profile_backups_dir = backups_dir.join(&profile.id);
            if let Err(e) = std::fs::create_dir_all(&profile_backups_dir) {
                log_message(
                    &app_handle,
                    format!(
                        "Failed to create backups folder for {}: {}",
                        profile.name, e
                    ),
                );
                continue;
            }
            if let Ok(entries) = std::fs::read_dir(profile_git_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_file() && path.extension().is_some_and(|ext| ext == "zip") {
                        if let Some(filename) = path.file_name() {
                            let dest_file = profile_backups_dir.join(filename);
                            if !dest_file.exists() {
                                if let Err(e) = std::fs::copy(&path, &dest_file) {
                                    log_message(
                                        &app_handle,
                                        format!(
                                            "Failed to copy backup {}: {}",
                                            filename.to_string_lossy(),
                                            e
                                        ),
                                    );
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // 7. Extract/Restore the latest backup for each active profile
    log_message(
        &app_handle,
        "Restoring latest game saves to their directories...".to_string(),
    );
    let mut restored_profiles = Vec::new();
    for profile in &local_config.profiles {
        if !profile.enabled {
            continue;
        }
        let profile_backups_dir = backups_dir.join(&profile.id);
        if !profile_backups_dir.exists() {
            continue;
        }

        let mut latest_zip: Option<(PathBuf, std::time::SystemTime)> = None;
        if let Ok(entries) = std::fs::read_dir(&profile_backups_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() && path.extension().is_some_and(|ext| ext == "zip") {
                    if let Ok(metadata) = entry.metadata() {
                        if let Ok(mtime) = metadata.modified() {
                            match &latest_zip {
                                Some((_, old_mtime)) => {
                                    if mtime > *old_mtime {
                                        latest_zip = Some((path, mtime));
                                    }
                                }
                                None => {
                                    latest_zip = Some((path, mtime));
                                }
                            }
                        }
                    }
                }
            }
        }

        if let Some((zip_path, _)) = latest_zip {
            let source_path = PathBuf::from(&profile.source_path);
            let zip_filename = zip_path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            log_message(
                &app_handle,
                format!(
                    "Restoring save files for profile: {} from {}",
                    profile.name, zip_filename
                ),
            );

            let extract_result = (|| -> Result<(), Box<dyn std::error::Error>> {
                std::fs::create_dir_all(&source_path)?;
                let file = std::fs::File::open(&zip_path)?;
                let mut archive = zip::ZipArchive::new(file)?;
                for i in 0..archive.len() {
                    let mut file = archive.by_index(i)?;
                    let outpath = match file.enclosed_name() {
                        Some(path) => source_path.join(path),
                        None => continue,
                    };
                    if file.name().ends_with('/') {
                        std::fs::create_dir_all(&outpath)?;
                    } else {
                        if let Some(p) = outpath.parent() {
                            if !p.exists() {
                                std::fs::create_dir_all(p)?;
                            }
                        }
                        let mut outfile = std::fs::File::create(&outpath)?;
                        std::io::copy(&mut file, &mut outfile)?;
                    }
                }
                Ok(())
            })();

            match extract_result {
                Ok(_) => {
                    log_message(
                        &app_handle,
                        format!(
                            "[SUCCESS] Restored save files for profile: {}",
                            profile.name
                        ),
                    );
                    restored_profiles.push(profile.name.clone());
                }
                Err(e) => {
                    log_message(
                        &app_handle,
                        format!(
                            "[ERROR] Failed to restore save for profile {}: {}",
                            profile.name, e
                        ),
                    );
                }
            }
        }
    }

    // 8. Reload watcher and trigger frontend updates
    let mut watcher = state.watcher.lock().unwrap();
    let is_active = *state.monitoring_active.lock().unwrap();
    if is_active {
        watcher.start(&local_config.profiles);
    }

    let _ = app_handle.emit("stats-updated", ());
    let _ = app_handle.emit("backups-updated", ());

    let count = local_config.profiles.len();
    let msg = if restored_profiles.is_empty() {
        format!("Imported configuration with {} profiles.", count)
    } else {
        format!(
            "Imported configuration with {} profiles and restored save files for: {}.",
            count,
            restored_profiles.join(", ")
        )
    };

    Ok(Some(msg))
}

#[tauri::command]
pub async fn import_local_backup_config(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    destination_path: String,
) -> Result<Option<String>, String> {
    log_message(
        &app_handle,
        format!(
            "Checking local backup directory for existing config: {}",
            destination_path
        ),
    );

    let local_path = PathBuf::from(&destination_path);
    if !local_path.exists() || !local_path.is_dir() {
        return Ok(None);
    }

    let remote_config_path = local_path.join("config.json");
    if !remote_config_path.exists() {
        return Ok(None);
    }

    log_message(
        &app_handle,
        "Existing AtlasSave config found in local backup path. Importing configuration..."
            .to_string(),
    );

    // 1. Read and parse remote config
    let content = std::fs::read_to_string(&remote_config_path)
        .map_err(|e| format!("Failed to read config from local backup path: {}", e))?;
    let remote_config: Config = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse config from local backup path: {}", e))?;

    // 2. Merge config and save locally
    let mut local_config_mgr = state.config_manager.lock().unwrap();

    local_config_mgr.data.profiles = remote_config.profiles.clone();
    local_config_mgr.data.global.max_backups = remote_config.global.max_backups;
    local_config_mgr.data.global.debounce_seconds = remote_config.global.debounce_seconds;
    if !remote_config.global.steamgriddb_api_key.is_empty() {
        local_config_mgr.data.global.steamgriddb_api_key =
            remote_config.global.steamgriddb_api_key.clone();
    }

    // Keep the local backup path configured
    local_config_mgr.data.providers.local_backup.enabled = true;
    local_config_mgr
        .data
        .providers
        .local_backup
        .destination_path = destination_path;
    local_config_mgr.save();

    let local_config = local_config_mgr.data.clone();
    let backups_dir = local_config_mgr.backups_dir.clone();
    drop(local_config_mgr); // Release lock

    // 3. Copy backups from local backup path back to our local backups directory
    log_message(
        &app_handle,
        "Importing backup archives from local secondary path...".to_string(),
    );
    for profile in &local_config.profiles {
        let sanitized_name = crate::core::uploader::sanitize_profile_name(&profile.name);
        let profile_backups_dir = backups_dir.join(&profile.id);
        if let Err(e) = std::fs::create_dir_all(&profile_backups_dir) {
            log_message(
                &app_handle,
                format!(
                    "Failed to create backups folder for {}: {}",
                    profile.name, e
                ),
            );
            continue;
        }

        let prefix_manual = format!("{}_manual", sanitized_name);
        let prefix_auto = format!("{}_auto", sanitized_name);

        if let Ok(entries) = std::fs::read_dir(&local_path) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() && path.extension().is_some_and(|ext| ext == "zip") {
                    if let Some(filename) = path.file_name() {
                        let filename_str = filename.to_string_lossy();
                        if filename_str.starts_with(&prefix_manual)
                            || filename_str.starts_with(&prefix_auto)
                            || filename_str.starts_with(&sanitized_name)
                        {
                            let dest_file = profile_backups_dir.join(filename);
                            if !dest_file.exists() {
                                let _ = std::fs::copy(&path, &dest_file);
                            }
                        }
                    }
                }
            }
        }
    }

    // 4. Extract/Restore the latest backup for each active profile
    log_message(
        &app_handle,
        "Restoring latest game saves to their directories...".to_string(),
    );
    let mut restored_profiles = Vec::new();
    for profile in &local_config.profiles {
        if !profile.enabled {
            continue;
        }
        let profile_backups_dir = backups_dir.join(&profile.id);
        if !profile_backups_dir.exists() {
            continue;
        }

        let mut latest_zip: Option<(PathBuf, std::time::SystemTime)> = None;
        if let Ok(entries) = std::fs::read_dir(&profile_backups_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() && path.extension().is_some_and(|ext| ext == "zip") {
                    if let Ok(metadata) = entry.metadata() {
                        if let Ok(mtime) = metadata.modified() {
                            match &latest_zip {
                                Some((_, old_mtime)) => {
                                    if mtime > *old_mtime {
                                        latest_zip = Some((path, mtime));
                                    }
                                }
                                None => {
                                    latest_zip = Some((path, mtime));
                                }
                            }
                        }
                    }
                }
            }
        }

        if let Some((zip_path, _)) = latest_zip {
            let source_path = PathBuf::from(&profile.source_path);
            let zip_filename = zip_path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            log_message(
                &app_handle,
                format!(
                    "Restoring save files for profile: {} from {}",
                    profile.name, zip_filename
                ),
            );

            let extract_result = (|| -> Result<(), Box<dyn std::error::Error>> {
                std::fs::create_dir_all(&source_path)?;
                let file = std::fs::File::open(&zip_path)?;
                let mut archive = zip::ZipArchive::new(file)?;
                for i in 0..archive.len() {
                    let mut file = archive.by_index(i)?;
                    let outpath = match file.enclosed_name() {
                        Some(path) => source_path.join(path),
                        None => continue,
                    };
                    if file.name().ends_with('/') {
                        std::fs::create_dir_all(&outpath)?;
                    } else {
                        if let Some(p) = outpath.parent() {
                            if !p.exists() {
                                std::fs::create_dir_all(p)?;
                            }
                        }
                        let mut outfile = std::fs::File::create(&outpath)?;
                        std::io::copy(&mut file, &mut outfile)?;
                    }
                }
                Ok(())
            })();

            match extract_result {
                Ok(_) => {
                    log_message(
                        &app_handle,
                        format!(
                            "[SUCCESS] Restored save files for profile: {}",
                            profile.name
                        ),
                    );
                    restored_profiles.push(profile.name.clone());
                }
                Err(e) => {
                    log_message(
                        &app_handle,
                        format!(
                            "[ERROR] Failed to restore save for profile {}: {}",
                            profile.name, e
                        ),
                    );
                }
            }
        }
    }

    // 5. Reload watcher and trigger frontend updates
    let mut watcher = state.watcher.lock().unwrap();
    let is_active = *state.monitoring_active.lock().unwrap();
    if is_active {
        watcher.start(&local_config.profiles);
    }

    let _ = app_handle.emit("stats-updated", ());
    let _ = app_handle.emit("backups-updated", ());

    let count = local_config.profiles.len();
    let msg = if restored_profiles.is_empty() {
        format!("Imported configuration with {} profiles.", count)
    } else {
        format!(
            "Imported configuration with {} profiles and restored save files for: {}.",
            count,
            restored_profiles.join(", ")
        )
    };

    Ok(Some(msg))
}

#[tauri::command]
pub fn toggle_monitoring(app_handle: AppHandle, state: State<'_, AppState>) -> bool {
    let is_active = {
        let mut active = state.monitoring_active.lock().unwrap();
        *active = !*active;
        *active
    };

    let config = state.config_manager.lock().unwrap();
    let mut watcher = state.watcher.lock().unwrap();

    if is_active {
        watcher.start(&config.data.profiles);
        log_message(&app_handle, "File monitoring engine activated.".to_string());
    } else {
        watcher.stop();
        state.debouncer.cancel_all();
        log_message(&app_handle, "File monitoring engine paused.".to_string());
    }

    is_active
}

#[tauri::command]
pub fn is_monitoring_active(state: State<'_, AppState>) -> bool {
    *state.monitoring_active.lock().unwrap()
}

#[tauri::command]
pub fn select_directory() -> Option<String> {
    let folder = rfd::FileDialog::new()
        .set_title("Select Game Save Directory")
        .pick_folder();
    folder.map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
pub fn select_file() -> Option<String> {
    let file = rfd::FileDialog::new()
        .set_title("Select Game Executable")
        .add_filter("Executables", &["exe"])
        .pick_file();
    file.map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
pub fn select_ssh_key_file() -> Option<String> {
    let file = rfd::FileDialog::new()
        .set_title("Select SSH Private Key")
        .pick_file();
    file.map(|p| p.to_string_lossy().to_string())
}

fn fetch_steam_cover_art(game_name: &str) -> Option<String> {
    let encoded = urlencoding::encode(game_name);
    let url = format!(
        "https://store.steampowered.com/api/storesearch/?term={}&l=english&cc=US",
        encoded
    );

    let response = ureq::get(&url).call().ok()?;
    let body: serde_json::Value = response.into_json().ok()?;

    if let Some(items) = body.get("items").and_then(|i| i.as_array()) {
        if !items.is_empty() {
            if let Some(appid) = items[0].get("id").and_then(|id| id.as_i64()) {
                return Some(format!("https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/{}/header.jpg", appid));
            }
        }
    }
    None
}

fn fetch_gog_cover_art(game_name: &str) -> Option<String> {
    let encoded = urlencoding::encode(game_name);
    let url = format!(
        "https://embed.gog.com/games/ajax/filtered?mediaType=game&search={}",
        encoded
    );

    let response = ureq::get(&url).call().ok()?;
    let body: serde_json::Value = response.into_json().ok()?;

    if let Some(products) = body.get("products").and_then(|p| p.as_array()) {
        if !products.is_empty() {
            if let Some(img_path) = products[0].get("image").and_then(|i| i.as_str()) {
                let clean_path = if img_path.starts_with("//") {
                    format!("https:{}", img_path)
                } else if img_path.starts_with('/') {
                    format!("https:/{}", img_path)
                } else if !img_path.starts_with("http") {
                    format!("https://{}", img_path)
                } else {
                    img_path.to_string()
                };
                return Some(clean_path);
            }
        }
    }
    None
}

fn fetch_epic_cover_art(game_name: &str) -> Option<String> {
    let payload = serde_json::json!({
        "query": "query search($keywords: String) { Catalog { searchStore(keywords: $keywords) { elements { keyImages { type url } } } } }",
        "variables": {
            "keywords": game_name
        }
    });

    let response = ureq::post("https://graphql.epicgames.com/graphql")
        .send_json(payload)
        .ok()?;

    let body: serde_json::Value = response.into_json().ok()?;

    let elements = body
        .get("data")?
        .get("Catalog")?
        .get("searchStore")?
        .get("elements")?
        .as_array()?;

    if elements.is_empty() {
        return None;
    }

    let key_images = elements[0].get("keyImages")?.as_array()?;
    if key_images.is_empty() {
        return None;
    }

    let preferred_types = [
        "OfferImageWide",
        "DieselGameBoxWide",
        "Thumbnail",
        "HorizontalPromo",
    ];
    for pref_type in &preferred_types {
        for img in key_images {
            if let Some(t) = img.get("type").and_then(|t| t.as_str()) {
                if t == *pref_type {
                    if let Some(url) = img.get("url").and_then(|u| u.as_str()) {
                        return Some(url.to_string());
                    }
                }
            }
        }
    }

    if let Some(url) = key_images[0].get("url").and_then(|u| u.as_str()) {
        return Some(url.to_string());
    }

    None
}

fn fetch_cover_art_helper(game_name: &str) -> Option<String> {
    // 1. Try Steam primary
    if let Some(url) = fetch_steam_cover_art(game_name) {
        return Some(url);
    }
    // 2. Fallback to GOG
    if let Some(url) = fetch_gog_cover_art(game_name) {
        return Some(url);
    }
    // 3. Fallback to Epic Games Store
    if let Some(url) = fetch_epic_cover_art(game_name) {
        return Some(url);
    }
    None
}

#[tauri::command]
pub async fn fetch_game_cover_art(game_name: String) -> Result<String, String> {
    match fetch_cover_art_helper(&game_name) {
        Some(url) => Ok(url),
        None => {
            Err("No matching game cover art found on Steam, GOG, or Epic Games Store.".to_string())
        }
    }
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct CoverSearchResult {
    pub title: String,
    pub cover_url: String,
    pub source: String,
}

fn search_steam_covers(term: &str) -> Result<Vec<CoverSearchResult>, String> {
    let encoded = urlencoding::encode(term);
    let url = format!(
        "https://store.steampowered.com/api/storesearch/?term={}&l=english&cc=US",
        encoded
    );

    let response = ureq::get(&url).call().map_err(|e| e.to_string())?;
    let body: serde_json::Value = response.into_json().map_err(|e| e.to_string())?;

    let mut list = Vec::new();
    if let Some(items) = body.get("items").and_then(|i| i.as_array()) {
        for item in items.iter().take(3) {
            let title = item
                .get("name")
                .and_then(|n| n.as_str())
                .unwrap_or("Unknown")
                .to_string();
            if let Some(appid) = item.get("id").and_then(|id| id.as_i64()) {
                let cover_url = format!("https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/{}/header.jpg", appid);
                list.push(CoverSearchResult {
                    title,
                    cover_url,
                    source: "Steam".to_string(),
                });
            }
        }
    }
    Ok(list)
}

fn search_gog_covers(term: &str) -> Result<Vec<CoverSearchResult>, String> {
    let encoded = urlencoding::encode(term);
    let url = format!(
        "https://embed.gog.com/games/ajax/filtered?mediaType=game&search={}",
        encoded
    );

    let response = ureq::get(&url).call().map_err(|e| e.to_string())?;
    let body: serde_json::Value = response.into_json().map_err(|e| e.to_string())?;

    let mut list = Vec::new();
    if let Some(products) = body.get("products").and_then(|p| p.as_array()) {
        for prod in products.iter().take(3) {
            let title = prod
                .get("title")
                .and_then(|t| t.as_str())
                .unwrap_or("Unknown")
                .to_string();
            if let Some(img_path) = prod.get("image").and_then(|i| i.as_str()) {
                let clean_path = if img_path.starts_with("//") {
                    format!("https:{}", img_path)
                } else if img_path.starts_with('/') {
                    format!("https:/{}", img_path)
                } else if !img_path.starts_with("http") {
                    format!("https://{}", img_path)
                } else {
                    img_path.to_string()
                };
                list.push(CoverSearchResult {
                    title,
                    cover_url: clean_path,
                    source: "GOG".to_string(),
                });
            }
        }
    }
    Ok(list)
}

fn search_epic_covers(term: &str) -> Result<Vec<CoverSearchResult>, String> {
    let payload = serde_json::json!({
        "query": "query search($keywords: String) { Catalog { searchStore(keywords: $keywords) { elements { title keyImages { type url } } } } }",
        "variables": {
            "keywords": term
        }
    });

    let response = ureq::post("https://graphql.epicgames.com/graphql")
        .send_json(payload)
        .map_err(|e| e.to_string())?;

    let body: serde_json::Value = response.into_json().map_err(|e| e.to_string())?;

    let elements = body
        .get("data")
        .and_then(|d| d.get("Catalog"))
        .and_then(|c| c.get("searchStore"))
        .and_then(|s| s.get("elements"))
        .and_then(|e| e.as_array())
        .ok_or_else(|| "Failed to parse Epic store response".to_string())?;

    let mut list = Vec::new();
    for elem in elements.iter().take(3) {
        let title = elem
            .get("title")
            .and_then(|t| t.as_str())
            .unwrap_or("Unknown")
            .to_string();
        if let Some(key_images) = elem.get("keyImages").and_then(|i| i.as_array()) {
            if !key_images.is_empty() {
                let mut cover_url = None;
                let preferred_types = [
                    "OfferImageWide",
                    "DieselGameBoxWide",
                    "Thumbnail",
                    "HorizontalPromo",
                ];
                for pref_type in &preferred_types {
                    for img in key_images {
                        if let Some(t) = img.get("type").and_then(|t| t.as_str()) {
                            if t == *pref_type {
                                if let Some(url) = img.get("url").and_then(|u| u.as_str()) {
                                    cover_url = Some(url.to_string());
                                    break;
                                }
                            }
                        }
                    }
                    if cover_url.is_some() {
                        break;
                    }
                }

                let final_url = cover_url.or_else(|| {
                    key_images[0]
                        .get("url")
                        .and_then(|u| u.as_str())
                        .map(|s| s.to_string())
                });

                if let Some(url) = final_url {
                    list.push(CoverSearchResult {
                        title,
                        cover_url: url,
                        source: "Epic".to_string(),
                    });
                }
            }
        }
    }
    Ok(list)
}

fn search_steamgrid_covers(api_key: &str, term: &str) -> Result<Vec<CoverSearchResult>, String> {
    if api_key.trim().is_empty() {
        return Ok(Vec::new());
    }

    let encoded = urlencoding::encode(term);
    let autocomplete_url = format!(
        "https://www.steamgriddb.com/api/v2/search/autocomplete/{}",
        encoded
    );
    let auth_header = format!("Bearer {}", api_key);

    // 1. Get game ID from autocomplete
    let response = ureq::get(&autocomplete_url)
        .set("Authorization", &auth_header)
        .call()
        .map_err(|e| e.to_string())?;

    let body: serde_json::Value = response.into_json().map_err(|e| e.to_string())?;

    if !body
        .get("success")
        .and_then(|s| s.as_bool())
        .unwrap_or(false)
    {
        return Err("SteamGridDB API search request unsuccessful".to_string());
    }

    let games = body
        .get("data")
        .and_then(|d| d.as_array())
        .ok_or_else(|| "Failed to parse SteamGridDB autocomplete data".to_string())?;

    if games.is_empty() {
        return Ok(Vec::new());
    }

    let game_id = games[0]
        .get("id")
        .and_then(|id| id.as_i64())
        .ok_or_else(|| "Failed to parse SteamGridDB game ID".to_string())?;

    let game_title = games[0]
        .get("name")
        .and_then(|n| n.as_str())
        .unwrap_or(term)
        .to_string();

    // 2. Fetch grids (covers) for this game
    let grids_url = format!("https://www.steamgriddb.com/api/v2/grids/game/{}", game_id);
    let grid_response = ureq::get(&grids_url)
        .set("Authorization", &auth_header)
        .call()
        .map_err(|e| e.to_string())?;

    let grid_body: serde_json::Value = grid_response.into_json().map_err(|e| e.to_string())?;

    if !grid_body
        .get("success")
        .and_then(|s| s.as_bool())
        .unwrap_or(false)
    {
        return Err("SteamGridDB Grids request unsuccessful".to_string());
    }

    let grids = grid_body
        .get("data")
        .and_then(|d| d.as_array())
        .ok_or_else(|| "Failed to parse SteamGridDB grids data".to_string())?;

    let mut list = Vec::new();
    for grid in grids.iter().take(3) {
        if let Some(cover_url) = grid.get("url").and_then(|u| u.as_str()) {
            list.push(CoverSearchResult {
                title: game_title.clone(),
                cover_url: cover_url.to_string(),
                source: "SteamGridDB".to_string(),
            });
        }
    }

    Ok(list)
}

#[tauri::command]
pub async fn search_game_covers(
    state: State<'_, AppState>,
    search_term: String,
) -> Result<Vec<CoverSearchResult>, String> {
    let mut results = Vec::new();

    let api_key = {
        let config = state.config_manager.lock().unwrap();
        config.data.global.steamgriddb_api_key.clone()
    };

    // 0. Try SteamGridDB search if API key is present
    if !api_key.trim().is_empty() {
        if let Ok(sg_results) = search_steamgrid_covers(&api_key, &search_term) {
            results.extend(sg_results);
        }
    }

    // 1. Search Steam
    if let Ok(steam_results) = search_steam_covers(&search_term) {
        results.extend(steam_results);
    }

    // 2. Search GOG
    if let Ok(gog_results) = search_gog_covers(&search_term) {
        results.extend(gog_results);
    }

    // 3. Search Epic
    if let Ok(epic_results) = search_epic_covers(&search_term) {
        results.extend(epic_results);
    }

    Ok(results)
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct BackupInfo {
    pub filename: String,
    pub path: String,
    pub size_bytes: u64,
    pub created_at: String,
}

#[tauri::command]
pub async fn get_backups(
    state: State<'_, AppState>,
    profile_id: String,
) -> Result<Vec<BackupInfo>, String> {
    let config = state.config_manager.lock().unwrap();
    let profile_backup_dir = config.backups_dir.join(&profile_id);

    if !profile_backup_dir.exists() {
        return Ok(Vec::new());
    }

    let mut list = Vec::new();
    if let Ok(entries) = std::fs::read_dir(profile_backup_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() && path.extension().is_some_and(|ext| ext == "zip") {
                let filename = path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();
                let metadata = entry.metadata().map_err(|e| e.to_string())?;
                let size_bytes = metadata.len();

                let modified = metadata.modified().map_err(|e| e.to_string())?;
                let dt: chrono::DateTime<chrono::Local> = modified.into();
                let created_at = dt.format("%Y-%m-%d %H:%M:%S").to_string();

                list.push(BackupInfo {
                    filename,
                    path: path.to_string_lossy().to_string(),
                    size_bytes,
                    created_at,
                });
            }
        }
    }

    list.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(list)
}

#[tauri::command]
pub fn restore_backup(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    profile_id: String,
    filename: String,
) -> Result<(), String> {
    let (profile_name, source_path_str, backups_dir, max_backups) = {
        let config = state.config_manager.lock().unwrap();
        let profile = config
            .data
            .profiles
            .iter()
            .find(|p| p.id == profile_id)
            .ok_or_else(|| "Profile not found".to_string())?;
        (
            profile.name.clone(),
            profile.source_path.clone(),
            config.backups_dir.clone(),
            config.data.global.max_backups,
        )
    };

    let zip_path = backups_dir.join(&profile_id).join(&filename);
    let source_path = PathBuf::from(&source_path_str);

    log_message(
        &app_handle,
        format!("Starting save restore for profile: {}", profile_id),
    );

    if !zip_path.exists() {
        return Err("Backup archive file does not exist.".to_string());
    }

    let app_handle_clone = app_handle.clone();
    tauri::async_runtime::spawn(async move {
        let archiver = Archiver::new(backups_dir.clone());
        if source_path.exists() {
            log_message(
                &app_handle_clone,
                format!("Creating rollback backup for: {}", profile_name),
            );
            let rollback_name = format!("{}_rollback", profile_name);
            match archiver.archive_profile(&profile_id, &rollback_name, &source_path, max_backups) {
                Ok(zip_path) => {
                    log_message(
                        &app_handle_clone,
                        format!("Created permanent rollback backup: {:?}", zip_path),
                    );
                    let file_size = std::fs::metadata(&zip_path).map(|m| m.len()).unwrap_or(0);
                    {
                        let state = app_handle_clone.state::<AppState>();
                        let mut config = state.config_manager.lock().unwrap();
                        config.data.stats.total_backups += 1;
                        config.data.stats.last_backup_time =
                            chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
                        let mb_size = file_size as f64 / (1024.0 * 1024.0);
                        config.data.stats.total_size_mb =
                            (config.data.stats.total_size_mb + mb_size * 100.0).round() / 100.0;
                        config.save();
                    }
                    let _ = app_handle_clone.emit("stats-updated", ());
                }
                Err(e) => {
                    log_message(
                        &app_handle_clone,
                        format!("Failed to create rollback backup: {}", e),
                    );
                }
            }
        }

        let temp_bak_path = source_path.with_extension("restore_bak");

        if source_path.exists() {
            if temp_bak_path.exists() {
                if let Err(e) = std::fs::remove_dir_all(&temp_bak_path) {
                    log_message(
                        &app_handle_clone,
                        format!("Restore failed (could not clear old temp bak): {}", e),
                    );
                    return;
                }
            }
            if let Err(e) = std::fs::rename(&source_path, &temp_bak_path) {
                log_message(
                    &app_handle_clone,
                    format!("Restore failed (could not backup existing files): {}", e),
                );
                return;
            }
        }

        let extract_result = (|| -> Result<(), Box<dyn std::error::Error>> {
            std::fs::create_dir_all(&source_path)?;
            let file = std::fs::File::open(&zip_path)?;
            let mut archive = zip::ZipArchive::new(file)?;
            for i in 0..archive.len() {
                let mut file = archive.by_index(i)?;
                let outpath = match file.enclosed_name() {
                    Some(path) => source_path.join(path),
                    None => continue,
                };

                if file.name().ends_with('/') {
                    std::fs::create_dir_all(&outpath)?;
                } else {
                    if let Some(p) = outpath.parent() {
                        if !p.exists() {
                            std::fs::create_dir_all(p)?;
                        }
                    }
                    let mut outfile = std::fs::File::create(&outpath)?;
                    std::io::copy(&mut file, &mut outfile)?;
                }
            }
            Ok(())
        })();

        match extract_result {
            Ok(_) => {
                if temp_bak_path.exists() {
                    let _ = std::fs::remove_dir_all(&temp_bak_path);
                }
                log_message(
                    &app_handle_clone,
                    format!("[SUCCESS] Restore completed successfully from {}", filename),
                );
                let _ = app_handle_clone.emit("backups-updated", ());
            }
            Err(err) => {
                log_message(
                    &app_handle_clone,
                    format!(
                        "[ERROR] Restore failed during extraction: {}. Rolling back...",
                        err
                    ),
                );
                if temp_bak_path.exists() {
                    let _ = std::fs::remove_dir_all(&source_path);
                    if let Err(rollback_err) = std::fs::rename(&temp_bak_path, &source_path) {
                        log_message(
                            &app_handle_clone,
                            format!("[CRITICAL ERROR] Rollback failed: {}", rollback_err),
                        );
                    } else {
                        log_message(
                            &app_handle_clone,
                            "Rollback completed. Original files restored.".to_string(),
                        );
                    }
                }
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub fn rename_backup(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    profile_id: String,
    filename: String,
    new_label: String,
) -> Result<(), String> {
    let backups_dir = {
        let config = state.config_manager.lock().unwrap();
        config.backups_dir.clone()
    };

    let profile_backups_dir = backups_dir.join(&profile_id);
    let old_path = profile_backups_dir.join(&filename);

    if !old_path.exists() {
        return Err("Backup file does not exist".to_string());
    }

    // Sanitize the new label name
    let safe_label: String = new_label
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == ' ' || *c == '_' || *c == '-')
        .collect::<String>()
        .trim()
        .replace(' ', "_");

    if safe_label.is_empty() {
        return Err("New label is empty or invalid".to_string());
    }

    let old_name_without_ext = old_path
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();

    // Check if the old filename ends with a timestamp formatted as _YYYYMMDD_HHMMSS
    // Timestamp contains 15 chars: _YYYYMMDD_HHMMSS (e.g. _20260617_145710)
    let timestamp = if old_name_without_ext.len() >= 16 {
        let suffix = &old_name_without_ext[old_name_without_ext.len() - 15..];
        let chars: Vec<char> = suffix.chars().collect();
        if chars[0] == '_'
            && chars[9] == '_'
            && chars[1..9].iter().all(|c| c.is_ascii_digit())
            && chars[10..16].iter().all(|c| c.is_ascii_digit())
        {
            suffix.to_string()
        } else {
            format!("_{}", chrono::Local::now().format("%Y%m%d_%H%M%S"))
        }
    } else {
        format!("_{}", chrono::Local::now().format("%Y%m%d_%H%M%S"))
    };

    let new_filename = format!("{}{}.zip", safe_label, timestamp);
    let new_path = profile_backups_dir.join(&new_filename);

    if new_path.exists() {
        return Err("A backup with that name/timestamp already exists".to_string());
    }

    std::fs::rename(&old_path, &new_path).map_err(|e| e.to_string())?;

    log_message(
        &app_handle,
        format!(
            "[SUCCESS] Backup renamed from {} to {}",
            filename, new_filename
        ),
    );
    let _ = app_handle.emit("backups-updated", ());

    Ok(())
}

#[tauri::command]
pub fn delete_backup(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    profile_id: String,
    filename: String,
) -> Result<(), String> {
    let backups_dir = {
        let config = state.config_manager.lock().unwrap();
        config.backups_dir.clone()
    };

    let zip_path = backups_dir.join(&profile_id).join(&filename);
    if zip_path.exists() {
        std::fs::remove_file(&zip_path).map_err(|e| e.to_string())?;
        log_message(
            &app_handle,
            format!("[SUCCESS] Backup deleted: {}", filename),
        );
        let _ = app_handle.emit("backups-updated", ());
        Ok(())
    } else {
        Err("Backup file not found".to_string())
    }
}

#[tauri::command]
pub fn open_backup_directory(state: State<'_, AppState>, profile_id: String) -> Result<(), String> {
    let backups_dir = {
        let config = state.config_manager.lock().unwrap();
        config.backups_dir.join(&profile_id)
    };

    if !backups_dir.exists() {
        std::fs::create_dir_all(&backups_dir).map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let mut cmd = std::process::Command::new("explorer.exe");
        cmd.arg(&backups_dir);
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        cmd.spawn().map_err(|e| e.to_string())?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        return Err("Unsupported OS".to_string());
    }

    Ok(())
}

#[tauri::command]
pub fn manual_backup_profile(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    profile_id: String,
) -> Result<(), String> {
    let config = state.config_manager.lock().unwrap();
    let profile = config
        .data
        .profiles
        .iter()
        .find(|p| p.id == profile_id)
        .cloned()
        .ok_or_else(|| "Profile not found".to_string())?;

    let backups_root = config.backups_dir.clone();
    let max_backups = config.data.global.max_backups;
    let providers = config.data.providers.clone();
    let uploader_sender = state.uploader.clone_sender();
    let app_handle_clone = app_handle.clone();

    tauri::async_runtime::spawn(async move {
        let archiver = Archiver::new(backups_root);
        let active_sp_name = if let Some(active_id) = &profile.active_save_profile_id {
            profile
                .save_profiles
                .iter()
                .find(|sp| &sp.id == active_id)
                .map(|sp| sp.name.clone())
        } else {
            None
        };
        let profile_name_combined = match active_sp_name {
            Some(sp_name) => format!("{} - {}", profile.name, sp_name),
            None => profile.name.clone(),
        };
        let name = format!("{}_manual", profile_name_combined);
        let source_path = PathBuf::from(&profile.source_path);

        log_message(
            &app_handle_clone,
            format!("Manual backup starting for: {}", profile.name),
        );
        match archiver.archive_profile(&profile.id, &name, &source_path, max_backups) {
            Ok(zip_path) => {
                let file_size = std::fs::metadata(&zip_path).map(|m| m.len()).unwrap_or(0);
                {
                    let state = app_handle_clone.state::<AppState>();
                    let mut config = state.config_manager.lock().unwrap();
                    config.data.stats.total_backups += 1;
                    config.data.stats.last_backup_time =
                        chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
                    let mb_size = file_size as f64 / (1024.0 * 1024.0);
                    config.data.stats.total_size_mb =
                        (config.data.stats.total_size_mb + mb_size * 100.0).round() / 100.0;
                    config.save();
                }

                uploader_sender.enqueue(UploadTask {
                    file_path: zip_path,
                    profile_name: name.clone(),
                    providers: providers.clone(),
                });

                let _ = app_handle_clone.emit("stats-updated", ());
                let _ = app_handle_clone.emit("backups-updated", ());
                log_message(
                    &app_handle_clone,
                    format!("[SUCCESS] Manual backup complete for: {}", name),
                );
            }
            Err(e) => {
                log_message(
                    &app_handle_clone,
                    format!("Manual backup failed for {}: {}", name, e),
                );
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn get_log_history(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    let config = state.config_manager.lock().unwrap();
    let log_file_path = config.config_dir.join("atlas_save.log");

    if !log_file_path.exists() {
        return Ok(Vec::new());
    }

    let content = std::fs::read_to_string(&log_file_path).map_err(|e| e.to_string())?;
    let lines: Vec<String> = content.lines().map(|s| s.to_string()).collect();

    let len = lines.len();
    if len > 500 {
        Ok(lines[len - 500..].to_vec())
    } else {
        Ok(lines)
    }
}

#[tauri::command]
pub fn clear_log_history(state: State<'_, AppState>) -> Result<(), String> {
    let config = state.config_manager.lock().unwrap();
    let log_file_path = config.config_dir.join("atlas_save.log");
    if log_file_path.exists() {
        let _ = std::fs::remove_file(&log_file_path);
    }
    Ok(())
}

#[tauri::command]
pub fn trigger_git_sync(app_handle: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let (git_dir, backups_dir) = {
        let config = state.config_manager.lock().unwrap();
        (
            config.config_dir.join("git_repo"),
            config.backups_dir.clone(),
        )
    };

    tauri::async_runtime::spawn(async move {
        let _ = Uploader::perform_full_sync(&app_handle, &git_dir, &backups_dir).await;
    });

    Ok(())
}

fn trigger_backup_for_profile(
    app_handle: &AppHandle,
    state: &AppState,
    profile: Profile,
) -> Result<(), String> {
    let config = state.config_manager.lock().unwrap();
    let backups_root = config.backups_dir.clone();
    let max_backups = config.data.global.max_backups;
    let providers = config.data.providers.clone();
    let uploader_sender = state.uploader.clone_sender();
    let app_handle_clone = app_handle.clone();

    let _ = app_handle.emit("backup-status", "running");
    tauri::async_runtime::spawn(async move {
        let _guard = BackupGuard {
            app_handle: &app_handle_clone,
        };
        let archiver = Archiver::new(backups_root);
        let active_sp_name = if let Some(active_id) = &profile.active_save_profile_id {
            profile
                .save_profiles
                .iter()
                .find(|sp| &sp.id == active_id)
                .map(|sp| sp.name.clone())
        } else {
            None
        };
        let profile_name_combined = match active_sp_name {
            Some(sp_name) => format!("{} - {}", profile.name, sp_name),
            None => profile.name.clone(),
        };
        let name = profile_name_combined;
        let source_path = PathBuf::from(&profile.source_path);

        log_message(
            &app_handle_clone,
            format!("Post-game auto backup starting for: {}", name),
        );
        match archiver.archive_profile(&profile.id, &name, &source_path, max_backups) {
            Ok(zip_path) => {
                {
                    let state = app_handle_clone.state::<AppState>();
                    let mut config = state.config_manager.lock().unwrap();
                    config.data.stats.total_backups += 1;
                    config.data.stats.last_backup_time =
                        chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
                    let file_size = std::fs::metadata(&zip_path).map(|m| m.len()).unwrap_or(0);
                    let mb_size = file_size as f64 / (1024.0 * 1024.0);
                    config.data.stats.total_size_mb =
                        (config.data.stats.total_size_mb + mb_size * 100.0).round() / 100.0;
                    config.save();
                }

                uploader_sender.enqueue(UploadTask {
                    file_path: zip_path,
                    profile_name: name.clone(),
                    providers: providers.clone(),
                });

                let _ = app_handle_clone.emit("stats-updated", ());
                let _ = app_handle_clone.emit("backups-updated", ());
                log_message(
                    &app_handle_clone,
                    format!("[SUCCESS] Auto backup complete for: {}", name),
                );
            }
            Err(e) => {
                log_message(
                    &app_handle_clone,
                    format!("Auto backup failed for {}: {}", name, e),
                );
            }
        }
    });

    Ok(())
}

fn is_process_running(process_name: &str) -> bool {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let mut cmd = std::process::Command::new("tasklist");
        cmd.args(["/NH", "/FI", &format!("IMAGENAME eq {}", process_name)]);
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        if let Ok(output) = cmd.output() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            return stdout.contains(process_name);
        }
    }
    false
}

#[tauri::command]
pub fn launch_game(
    app_handle: AppHandle,
    profile_id: String,
    exe_path: String,
) -> Result<(), String> {
    let path = std::path::Path::new(&exe_path);
    if !path.exists() {
        return Err("Executable file does not exist at path.".to_string());
    }

    let process_name = path
        .file_name()
        .ok_or_else(|| "Invalid executable filename".to_string())?
        .to_string_lossy()
        .to_string();

    let exe_dir = path
        .parent()
        .ok_or_else(|| "Invalid executable directory".to_string())?
        .to_path_buf();

    // Spawn the game process
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let mut cmd = std::process::Command::new(&exe_path);
        cmd.current_dir(&exe_dir);
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        cmd.spawn()
            .map_err(|e| format!("Failed to launch game executable: {}", e))?;
    }

    // Monitor in background Tokio task
    let app_handle_clone = app_handle.clone();
    let state_clone = app_handle.state::<AppState>();

    // De-serialize profile
    let profile = {
        let config = state_clone.config_manager.lock().unwrap();
        config
            .data
            .profiles
            .iter()
            .find(|p| p.id == profile_id)
            .cloned()
    };

    if let Some(profile_data) = profile {
        tauri::async_runtime::spawn(async move {
            // 1. Pause watcher for this profile
            {
                let state = app_handle_clone.state::<AppState>();
                let mut watcher = state.watcher.lock().unwrap();
                watcher.stop_watching_profile(&profile_data.id);
            }
            log_message(
                &app_handle_clone,
                format!(
                    "Game Launched: {}. Pausing file system watcher for profile.",
                    profile_data.name
                ),
            );

            // Wait a few seconds for game process to appear
            tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;

            // 2. Query process list periodically
            loop {
                tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
                if !is_process_running(&process_name) {
                    break;
                }
            }

            // 3. Exited! Resume watcher and backup
            log_message(
                &app_handle_clone,
                format!(
                    "Game Exited: {}. Resuming watcher and triggering backup.",
                    profile_data.name
                ),
            );

            {
                let state = app_handle_clone.state::<AppState>();
                let mut watcher = state.watcher.lock().unwrap();
                watcher.start_watching_profile(&profile_data);
            }

            let state = app_handle_clone.state::<AppState>();
            let _ = trigger_backup_for_profile(&app_handle_clone, &state, profile_data);
        });
    }

    Ok(())
}

#[derive(serde::Serialize)]
pub struct StorageStats {
    pub total_size_bytes: u64,
    pub backup_count: usize,
    pub oldest_backup_time: String,
    pub newest_backup_time: String,
}

#[tauri::command]
pub async fn get_profile_storage_stats(
    state: State<'_, AppState>,
    profile_id: String,
) -> Result<StorageStats, String> {
    let backups_dir = {
        let config = state.config_manager.lock().unwrap();
        config.backups_dir.join(&profile_id)
    };

    let mut total_size_bytes = 0;
    let mut backup_count = 0;
    let mut oldest_time = None;
    let mut newest_time = None;

    if backups_dir.exists() && backups_dir.is_dir() {
        if let Ok(entries) = std::fs::read_dir(backups_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() && path.extension().is_some_and(|ext| ext == "zip") {
                    backup_count += 1;
                    if let Ok(meta) = path.metadata() {
                        total_size_bytes += meta.len();
                        if let Ok(modified) = meta.modified() {
                            let datetime: chrono::DateTime<chrono::Local> = modified.into();
                            let formatted = datetime.format("%Y-%m-%d %H:%M:%S").to_string();
                            if oldest_time.is_none() || formatted < *oldest_time.as_ref().unwrap() {
                                oldest_time = Some(formatted.clone());
                            }
                            if newest_time.is_none() || formatted > *newest_time.as_ref().unwrap() {
                                newest_time = Some(formatted);
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(StorageStats {
        total_size_bytes,
        backup_count,
        oldest_backup_time: oldest_time.unwrap_or_else(|| "N/A".to_string()),
        newest_backup_time: newest_time.unwrap_or_else(|| "N/A".to_string()),
    })
}

#[tauri::command]
pub fn prune_profile_backups(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    profile_id: String,
    keep_count: usize,
) -> Result<usize, String> {
    let backups_dir = {
        let config = state.config_manager.lock().unwrap();
        config.backups_dir.join(&profile_id)
    };

    if !backups_dir.exists() || !backups_dir.is_dir() {
        return Ok(0);
    }

    let mut zip_files = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&backups_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() && path.extension().is_some_and(|ext| ext == "zip") {
                if let Ok(meta) = path.metadata() {
                    if let Ok(modified) = meta.modified() {
                        zip_files.push((path, modified));
                    }
                }
            }
        }
    }

    // Sort by modified time descending (newest first)
    zip_files.sort_by_key(|b| std::cmp::Reverse(b.1));

    let mut deleted_count = 0;
    if zip_files.len() > keep_count {
        for (path, _) in &zip_files[keep_count..] {
            if std::fs::remove_file(path).is_ok() {
                deleted_count += 1;
            }
        }
    }

    log_message(
        &app_handle,
        format!(
            "Pruned {} older backup files for profile {}.",
            deleted_count, profile_id
        ),
    );

    let _ = app_handle.emit("backups-updated", ());
    Ok(deleted_count)
}

#[derive(serde::Serialize)]
pub struct DetectedGame {
    pub name: String,
    pub exe_path: String,
    pub save_path_suggestion: Option<String>,
}

#[tauri::command]
pub async fn scan_steam_library() -> Result<Vec<DetectedGame>, String> {
    let mut detected_games = Vec::new();

    // 1. Get Steam installation path
    let program_files_86 = std::env::var("ProgramFiles(x86)")
        .unwrap_or_else(|_| "C:\\Program Files (x86)".to_string());
    let default_steam_dir = std::path::PathBuf::from(&program_files_86).join("Steam");
    let mut steam_dirs = vec![default_steam_dir];

    // Try registry lookup
    #[cfg(target_os = "windows")]
    {
        use winreg::enums::*;
        use winreg::RegKey;
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        if let Ok(steam_key) = hkcu.open_subkey("Software\\Valve\\Steam") {
            if let Ok(path_str) = steam_key.get_value::<String, _>("SteamPath") {
                let path = std::path::PathBuf::from(path_str.replace('/', "\\"));
                if path.exists() && !steam_dirs.contains(&path) {
                    steam_dirs.push(path);
                }
            }
        }
    }

    let mut library_paths = Vec::new();
    for steam_dir in &steam_dirs {
        if steam_dir.exists() {
            library_paths.push(steam_dir.clone());

            // Read libraryfolders.vdf
            let lib_vdf = steam_dir.join("steamapps").join("libraryfolders.vdf");
            if lib_vdf.exists() {
                if let Ok(content) = std::fs::read_to_string(&lib_vdf) {
                    // Quick parse path lines
                    for line in content.lines() {
                        let trimmed = line.trim();
                        if trimmed.to_lowercase().contains("\"path\"") {
                            let parts: Vec<&str> = trimmed.split('"').collect();
                            if parts.len() >= 4 {
                                let path_str = parts[3].replace("\\\\", "\\");
                                let path = std::path::PathBuf::from(path_str);
                                if path.exists() && !library_paths.contains(&path) {
                                    library_paths.push(path);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // 2. Scan each library for common folders
    for lib in &library_paths {
        let common_dir = lib.join("steamapps").join("common");
        if common_dir.exists() && common_dir.is_dir() {
            if let Ok(entries) = std::fs::read_dir(common_dir) {
                for game_dir_entry in entries.flatten() {
                    let game_dir = game_dir_entry.path();
                    if game_dir.is_dir() {
                        // Scan for game executable
                        if let Some(game_name) = game_dir.file_name().and_then(|n| n.to_str()) {
                            let exes = find_game_executables(&game_dir);
                            for exe in exes {
                                // Try auto-detection
                                let suggestion = detector::detect_save_directory(exe.clone())
                                    .map(|p| p.to_string_lossy().to_string());

                                detected_games.push(DetectedGame {
                                    name: game_name.to_string(),
                                    exe_path: exe.to_string_lossy().to_string(),
                                    save_path_suggestion: suggestion,
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(detected_games)
}

fn find_game_executables(game_dir: &std::path::Path) -> Vec<std::path::PathBuf> {
    let mut exes = Vec::new();

    // Look for executables in main dir and Binaries/Win64
    let paths_to_check = vec![
        game_dir.to_path_buf(),
        game_dir.join("Binaries").join("Win64"),
        game_dir.join("bin").join("x64"),
        game_dir.join("Bin"),
    ];

    for dir in paths_to_check {
        if dir.exists() && dir.is_dir() {
            if let Ok(entries) = std::fs::read_dir(dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_file() && path.extension().is_some_and(|ext| ext == "exe") {
                        if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                            let lower = name.to_lowercase();
                            // Skip installers, webview helpers, steam_helper, crash reporter
                            if !lower.contains("crash")
                                && !lower.contains("unity")
                                && !lower.contains("cef")
                                && !lower.contains("helper")
                                && !lower.contains("install")
                                && !lower.contains("setup")
                                && !lower.contains("config")
                            {
                                exes.push(path);
                            }
                        }
                    }
                }
            }
        }
    }

    // Keep only the largest exe if multiple found
    if exes.len() > 1 {
        exes.sort_by(|a, b| {
            let size_a = std::fs::metadata(a).map(|m| m.len()).unwrap_or(0);
            let size_b = std::fs::metadata(b).map(|m| m.len()).unwrap_or(0);
            size_b.cmp(&size_a)
        });
        exes.truncate(1);
    }

    exes
}

#[cfg(target_os = "windows")]
extern "system" {
    fn GetDiskFreeSpaceExW(
        lpDirectoryName: *const u16,
        lpFreeBytesAvailableToCaller: *mut u64,
        lpTotalNumberOfBytes: *mut u64,
        lpTotalNumberOfFreeBytes: *mut u64,
    ) -> i32;
}

#[cfg(target_os = "windows")]
fn get_disk_space_info<P: AsRef<std::path::Path>>(path: P) -> Option<(u64, u64)> {
    use std::os::windows::ffi::OsStrExt;
    let path = path.as_ref();
    let mut wide_path: Vec<u16> = path.as_os_str().encode_wide().collect();
    wide_path.push(0);

    let mut free_bytes = 0u64;
    let mut total_bytes = 0u64;
    let mut total_free_bytes = 0u64;

    unsafe {
        let res = GetDiskFreeSpaceExW(
            wide_path.as_ptr(),
            &mut free_bytes,
            &mut total_bytes,
            &mut total_free_bytes,
        );
        if res != 0 {
            Some((total_bytes, free_bytes))
        } else {
            if let Some(parent) = path.parent() {
                let mut wide_parent: Vec<u16> = parent.as_os_str().encode_wide().collect();
                wide_parent.push(0);
                let res = GetDiskFreeSpaceExW(
                    wide_parent.as_ptr(),
                    &mut free_bytes,
                    &mut total_bytes,
                    &mut total_free_bytes,
                );
                if res != 0 {
                    return Some((total_bytes, free_bytes));
                }
            }
            None
        }
    }
}

#[cfg(not(target_os = "windows"))]
fn get_disk_space_info<P: AsRef<std::path::Path>>(_path: P) -> Option<(u64, u64)> {
    Some((512 * 1024 * 1024 * 1024, 256 * 1024 * 1024 * 1024))
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct SystemStorageStats {
    pub primary_total_gb: f64,
    pub primary_used_gb: f64,
    pub primary_free_gb: f64,
    pub primary_percent: f64,

    pub cloud_total_gb: f64,
    pub cloud_used_gb: f64,
    pub cloud_free_gb: f64,
    pub cloud_percent: f64,
}

#[tauri::command]
pub async fn get_system_storage_stats(
    state: State<'_, AppState>,
) -> Result<SystemStorageStats, String> {
    let (backups_dir, providers, total_size_mb) = {
        let config = state.config_manager.lock().unwrap();
        (
            config.backups_dir.clone(),
            config.data.providers.clone(),
            config.data.stats.total_size_mb,
        )
    };

    // 1. Primary Disk Space Info
    let mut primary_total_gb = 128.0;
    let mut primary_free_gb = 43.8;
    let mut primary_used_gb = 84.2;
    let mut primary_percent = 65.0;

    if let Some((total_bytes, free_bytes)) = get_disk_space_info(&backups_dir) {
        primary_total_gb = total_bytes as f64 / (1024.0 * 1024.0 * 1024.0);
        primary_free_gb = free_bytes as f64 / (1024.0 * 1024.0 * 1024.0);
        primary_used_gb = primary_total_gb - primary_free_gb;
        primary_percent = if primary_total_gb > 0.0 {
            (primary_used_gb / primary_total_gb * 100.0).clamp(0.0, 100.0)
        } else {
            0.0
        };
    }

    // 2. Cloud Disk Space Info
    let mut cloud_total_gb = 256.0;
    let mut cloud_free_gb = 256.0;
    let mut cloud_used_gb = 0.0;
    let mut cloud_percent = 0.0;

    if providers.local_backup.enabled {
        let dest_path = std::path::PathBuf::from(&providers.local_backup.destination_path);
        if dest_path.exists() {
            if let Some((total_bytes, free_bytes)) = get_disk_space_info(&dest_path) {
                cloud_total_gb = total_bytes as f64 / (1024.0 * 1024.0 * 1024.0);
                cloud_free_gb = free_bytes as f64 / (1024.0 * 1024.0 * 1024.0);
                cloud_used_gb = cloud_total_gb - cloud_free_gb;
                cloud_percent = if cloud_total_gb > 0.0 {
                    (cloud_used_gb / cloud_total_gb * 100.0).clamp(0.0, 100.0)
                } else {
                    0.0
                };
            }
        }
    } else if providers.git.enabled {
        // Mock a 5 GB storage limit for Git repository
        cloud_total_gb = 5.0;
        cloud_used_gb = total_size_mb / 1024.0;
        cloud_free_gb = (cloud_total_gb - cloud_used_gb).max(0.0);
        cloud_percent = if cloud_total_gb > 0.0 {
            (cloud_used_gb / cloud_total_gb * 100.0).clamp(0.0, 100.0)
        } else {
            0.0
        };
    }

    Ok(SystemStorageStats {
        primary_total_gb: (primary_total_gb * 10.0).round() / 10.0,
        primary_used_gb: (primary_used_gb * 10.0).round() / 10.0,
        primary_free_gb: (primary_free_gb * 10.0).round() / 10.0,
        primary_percent: primary_percent.round(),

        cloud_total_gb: (cloud_total_gb * 10.0).round() / 10.0,
        cloud_used_gb: (cloud_used_gb * 10.0).round() / 10.0,
        cloud_free_gb: (cloud_free_gb * 10.0).round() / 10.0,
        cloud_percent: cloud_percent.round(),
    })
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct GitCommitInfo {
    pub hash: String,
    pub author: String,
    pub date: String,
    pub message: String,
}

#[tauri::command]
pub fn get_git_branches(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    let config = state.config_manager.lock().unwrap();
    let git_dir = config.config_dir.join("git_repo");
    if !git_dir.exists() || !git_dir.join(".git").exists() {
        return Ok(Vec::new());
    }
    match crate::core::uploader::Uploader::run_git_cmd(&git_dir, &["branch", "-a"]) {
        Ok(output) => {
            let branches: Vec<String> = output
                .lines()
                .map(|line| line.replace('*', "").trim().to_string())
                .filter(|line| !line.is_empty())
                .collect();
            Ok(branches)
        }
        Err(e) => Err(e),
    }
}

#[tauri::command]
pub fn get_git_commits(
    state: State<'_, AppState>,
    max_count: usize,
) -> Result<Vec<GitCommitInfo>, String> {
    let config = state.config_manager.lock().unwrap();
    let git_dir = config.config_dir.join("git_repo");
    if !git_dir.exists() || !git_dir.join(".git").exists() {
        return Ok(Vec::new());
    }
    let count_str = max_count.to_string();
    match crate::core::uploader::Uploader::run_git_cmd(
        &git_dir,
        &[
            "log",
            "--pretty=format:%H|%an|%ad|%s",
            "--date=short",
            "-n",
            &count_str,
        ],
    ) {
        Ok(output) => {
            let mut commits = Vec::new();
            for line in output.lines() {
                let parts: Vec<&str> = line.split('|').collect();
                if parts.len() >= 4 {
                    commits.push(GitCommitInfo {
                        hash: parts[0].to_string(),
                        author: parts[1].to_string(),
                        date: parts[2].to_string(),
                        message: parts[3..].join("|"),
                    });
                }
            }
            Ok(commits)
        }
        Err(e) => Err(e),
    }
}

#[tauri::command]
pub fn checkout_git_branch(state: State<'_, AppState>, branch: String) -> Result<String, String> {
    let config = state.config_manager.lock().unwrap();
    let git_dir = config.config_dir.join("git_repo");
    if !git_dir.exists() || !git_dir.join(".git").exists() {
        return Err("Git repository not initialized".to_string());
    }
    crate::core::uploader::Uploader::run_git_cmd(&git_dir, &["checkout", &branch])
}

#[tauri::command]
pub fn create_git_branch(state: State<'_, AppState>, branch: String) -> Result<String, String> {
    let config = state.config_manager.lock().unwrap();
    let git_dir = config.config_dir.join("git_repo");
    if !git_dir.exists() || !git_dir.join(".git").exists() {
        return Err("Git repository not initialized".to_string());
    }
    crate::core::uploader::Uploader::run_git_cmd(&git_dir, &["checkout", "-b", &branch])
}

#[tauri::command]
pub fn restore_git_commit(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    profile_id: String,
    commit_hash: String,
) -> Result<(), String> {
    let (profile_name, source_path_str, branch_name) = {
        let config = state.config_manager.lock().unwrap();
        let profile = config
            .data
            .profiles
            .iter()
            .find(|p| p.id == profile_id)
            .ok_or_else(|| "Profile not found".to_string())?;
        (
            profile.name.clone(),
            profile.source_path.clone(),
            config.data.providers.git.branch.clone(),
        )
    };

    let config_dir = {
        let config = state.config_manager.lock().unwrap();
        config.config_dir.clone()
    };
    let git_dir = config_dir.join("git_repo");
    if !git_dir.exists() || !git_dir.join(".git").exists() {
        return Err("Git repository not initialized".to_string());
    }

    log_message(
        &app_handle,
        format!(
            "Restoring save from Git Commit Hash {} for Profile {}",
            commit_hash, profile_name
        ),
    );

    // 1. Checkout commit
    crate::core::uploader::Uploader::run_git_cmd(&git_dir, &["checkout", &commit_hash])?;

    // 2. Find the zip file for the profile inside the checked-out folder
    let sanitized_name = crate::core::uploader::sanitize_profile_name(&profile_name);
    let profile_git_dir = git_dir.join(&sanitized_name);

    if !profile_git_dir.exists() || !profile_git_dir.is_dir() {
        // Checkout main branch back first
        let _ = crate::core::uploader::Uploader::run_git_cmd(&git_dir, &["checkout", &branch_name]);
        return Err(format!(
            "No backups found in commit {} for game {}",
            commit_hash, profile_name
        ));
    }

    // Find the latest zip file in that folder (at that commit)
    let mut zip_files = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&profile_git_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() && path.extension().is_some_and(|ext| ext == "zip") {
                if let Ok(metadata) = entry.metadata() {
                    if let Ok(modified) = metadata.modified() {
                        zip_files.push((path, modified));
                    }
                }
            }
        }
    }

    zip_files.sort_by_key(|b| std::cmp::Reverse(b.1));

    if zip_files.is_empty() {
        let _ = crate::core::uploader::Uploader::run_git_cmd(&git_dir, &["checkout", &branch_name]);
        return Err("No backup zip files found in commit folder.".to_string());
    }

    let target_zip = zip_files[0].0.clone();
    let source_path = PathBuf::from(&source_path_str);

    // 3. Extract the ZIP to source path
    let extract_result = (|| -> Result<(), Box<dyn std::error::Error>> {
        std::fs::create_dir_all(&source_path)?;
        let file = std::fs::File::open(&target_zip)?;
        let mut archive = zip::ZipArchive::new(file)?;
        for i in 0..archive.len() {
            let mut file = archive.by_index(i)?;
            let outpath = match file.enclosed_name() {
                Some(path) => source_path.join(path),
                None => continue,
            };
            if file.name().ends_with('/') {
                std::fs::create_dir_all(&outpath)?;
            } else {
                if let Some(p) = outpath.parent() {
                    if !p.exists() {
                        std::fs::create_dir_all(p)?;
                    }
                }
                let mut outfile = std::fs::File::create(&outpath)?;
                std::io::copy(&mut file, &mut outfile)?;
            }
        }
        Ok(())
    })();

    // 4. Checkout branch back
    let _ = crate::core::uploader::Uploader::run_git_cmd(&git_dir, &["checkout", &branch_name]);

    match extract_result {
        Ok(_) => {
            log_message(
                &app_handle,
                format!(
                    "[SUCCESS] Restored save files from commit {} for profile: {}",
                    commit_hash, profile_name
                ),
            );
            let _ = app_handle.emit("backups-updated", ());
            Ok(())
        }
        Err(e) => {
            log_message(
                &app_handle,
                format!("[ERROR] Failed to extract commit save: {}", e),
            );
            Err(e.to_string())
        }
    }
}

#[tauri::command]
pub fn gc_git_repository(state: State<'_, AppState>) -> Result<String, String> {
    let config = state.config_manager.lock().unwrap();
    let git_dir = config.config_dir.join("git_repo");
    if !git_dir.exists() || !git_dir.join(".git").exists() {
        return Err("Git repository not initialized".to_string());
    }
    crate::core::uploader::Uploader::run_git_cmd(&git_dir, &["gc", "--prune=now"])
}

// =========================================================================
// PLAYTHROUGH / SAVE PROFILING HELPERS & COMMANDS
// =========================================================================

fn copy_dir_all(
    src: impl AsRef<std::path::Path>,
    dst: impl AsRef<std::path::Path>,
) -> std::io::Result<()> {
    std::fs::create_dir_all(&dst)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        if ty.is_dir() {
            copy_dir_all(entry.path(), dst.as_ref().join(entry.file_name()))?;
        } else {
            std::fs::copy(entry.path(), dst.as_ref().join(entry.file_name()))?;
        }
    }
    Ok(())
}

fn clear_dir_contents(dir: impl AsRef<std::path::Path>) -> std::io::Result<()> {
    if dir.as_ref().exists() {
        for entry in std::fs::read_dir(dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_dir() {
                std::fs::remove_dir_all(&path)?;
            } else {
                std::fs::remove_file(&path)?;
            }
        }
    }
    Ok(())
}

fn get_save_profile_dir(config_dir: &std::path::Path, profile_id: &str, sp_id: &str) -> PathBuf {
    config_dir
        .join("save_profiles")
        .join(profile_id)
        .join(sp_id)
}

fn save_active_saves_to_profile(
    config_dir: &std::path::Path,
    profile_id: &str,
    sp_id: &str,
    source_path: &str,
) -> Result<(), String> {
    let source_dir = PathBuf::from(source_path);
    if !source_dir.exists() {
        return Ok(());
    }
    let sp_dir = get_save_profile_dir(config_dir, profile_id, sp_id);
    let _ = std::fs::remove_dir_all(&sp_dir);
    std::fs::create_dir_all(&sp_dir)
        .map_err(|e| format!("Failed to create save profile folder: {}", e))?;
    copy_dir_all(&source_dir, &sp_dir)
        .map_err(|e| format!("Failed to copy active saves to storage: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn create_save_profile(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    profile_id: String,
    name: String,
    init_type: String,
    source_backup_zip: Option<String>,
) -> Result<crate::config::SaveProfile, String> {
    let mut config_mgr = state.config_manager.lock().unwrap();
    let config_dir = config_mgr.config_dir.clone();
    let backups_dir = config_mgr.backups_dir.clone();

    // 1. Find profile
    let profile = config_mgr
        .data
        .profiles
        .iter_mut()
        .find(|p| p.id == profile_id)
        .ok_or_else(|| "Game profile not found".to_string())?;

    let source_path_str = profile.source_path.clone();

    // 2. Ensure current save profile is initialized and save its active state
    if let Some(active_id) = &profile.active_save_profile_id {
        if let Err(e) =
            save_active_saves_to_profile(&config_dir, &profile_id, active_id, &source_path_str)
        {
            log_message(
                &app_handle,
                format!("[WARNING] Failed to save active playthrough saves: {}", e),
            );
        }
    }

    // 3. Create new save profile
    let new_sp_id = Uuid::new_v4().to_string();
    let new_sp = crate::config::SaveProfile {
        id: new_sp_id.clone(),
        name: name.clone(),
        created_at: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
    };

    let new_sp_dir = get_save_profile_dir(&config_dir, &profile_id, &new_sp_id);
    std::fs::create_dir_all(&new_sp_dir)
        .map_err(|e| format!("Failed to create save profile directory: {}", e))?;

    // 4. Handle initialization type
    match init_type.as_str() {
        "fresh" => {
            if let Err(e) = clear_dir_contents(&source_path_str) {
                log_message(
                    &app_handle,
                    format!("[WARNING] Failed to clear active saves folder: {}", e),
                );
            }
        }
        "copy_current" => {
            let source_path = PathBuf::from(&source_path_str);
            if source_path.exists() {
                if let Err(e) = copy_dir_all(&source_path, &new_sp_dir) {
                    return Err(format!("Failed to copy current saves: {}", e));
                }
            }
        }
        "copy_backup" => {
            if let Some(zip_filename) = source_backup_zip {
                let zip_path = backups_dir.join(&profile_id).join(&zip_filename);
                if !zip_path.exists() {
                    return Err("Source backup zip file does not exist.".to_string());
                }

                // Clear current active folder
                if let Err(e) = clear_dir_contents(&source_path_str) {
                    log_message(
                        &app_handle,
                        format!("[WARNING] Failed to clear active saves folder: {}", e),
                    );
                }

                // Extract zip into source_path
                let source_path = PathBuf::from(&source_path_str);
                std::fs::create_dir_all(&source_path).map_err(|e| e.to_string())?;
                let file = std::fs::File::open(&zip_path).map_err(|e| e.to_string())?;
                let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
                for i in 0..archive.len() {
                    let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
                    let outpath = match file.enclosed_name() {
                        Some(path) => source_path.join(path),
                        None => continue,
                    };
                    if file.name().ends_with('/') {
                        std::fs::create_dir_all(&outpath).map_err(|e| e.to_string())?;
                    } else {
                        if let Some(p) = outpath.parent() {
                            if !p.exists() {
                                std::fs::create_dir_all(p).map_err(|e| e.to_string())?;
                            }
                        }
                        let mut outfile =
                            std::fs::File::create(&outpath).map_err(|e| e.to_string())?;
                        std::io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
                    }
                }

                // Copy from source_path to new_sp_dir
                if let Err(e) = copy_dir_all(&source_path, &new_sp_dir) {
                    return Err(format!("Failed to copy extracted backup: {}", e));
                }
            } else {
                return Err("No backup zip specified for copy_backup mode.".to_string());
            }
        }
        _ => return Err("Invalid initialization type".to_string()),
    }

    let profile_name = profile.name.clone();
    // 5. Update profile and save config
    profile.save_profiles.push(new_sp.clone());
    profile.active_save_profile_id = Some(new_sp_id);
    config_mgr.save();

    log_message(
        &app_handle,
        format!(
            "[SUCCESS] Created playthrough profile '{}' (type: {}) for game '{}'",
            name, init_type, profile_name
        ),
    );

    let _ = app_handle.emit("stats-updated", ());
    let _ = app_handle.emit("backups-updated", ());

    Ok(new_sp)
}

#[tauri::command]
pub fn switch_save_profile(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    profile_id: String,
    target_sp_id: String,
) -> Result<(), String> {
    let mut config_mgr = state.config_manager.lock().unwrap();
    let config_dir = config_mgr.config_dir.clone();

    // 1. Find profile
    let profile = config_mgr
        .data
        .profiles
        .iter_mut()
        .find(|p| p.id == profile_id)
        .ok_or_else(|| "Game profile not found".to_string())?;

    let source_path_str = profile.source_path.clone();

    let current_sp_id = match &profile.active_save_profile_id {
        Some(id) => id.clone(),
        None => {
            let default_id = Uuid::new_v4().to_string();
            let default_sp = crate::config::SaveProfile {
                id: default_id.clone(),
                name: "Default Profile".to_string(),
                created_at: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
            };
            profile.save_profiles.push(default_sp);
            profile.active_save_profile_id = Some(default_id.clone());
            default_id
        }
    };

    if current_sp_id == target_sp_id {
        return Ok(());
    }

    // Verify target exists
    if !profile.save_profiles.iter().any(|sp| sp.id == target_sp_id) {
        return Err("Target playthrough profile not found".to_string());
    }

    // 2. Save current active files to current playthrough directory
    if let Err(e) =
        save_active_saves_to_profile(&config_dir, &profile_id, &current_sp_id, &source_path_str)
    {
        log_message(
            &app_handle,
            format!(
                "[WARNING] Failed to save active files before playthrough swap: {}",
                e
            ),
        );
    }

    // 3. Clear active save directory
    if let Err(e) = clear_dir_contents(&source_path_str) {
        return Err(format!("Failed to clear active directory contents: {}", e));
    }

    // 4. Restore target playthrough files to source_path
    let target_sp_dir = get_save_profile_dir(&config_dir, &profile_id, &target_sp_id);
    if target_sp_dir.exists() {
        let source_path = PathBuf::from(&source_path_str);
        std::fs::create_dir_all(&source_path).map_err(|e| e.to_string())?;
        if let Err(e) = copy_dir_all(&target_sp_dir, &source_path) {
            return Err(format!("Failed to restore target playthrough files: {}", e));
        }
    }

    let target_name = profile
        .save_profiles
        .iter()
        .find(|sp| sp.id == target_sp_id)
        .map(|sp| sp.name.clone())
        .unwrap_or_else(|| "Unknown".to_string());
    let profile_name = profile.name.clone();

    // 5. Update config
    profile.active_save_profile_id = Some(target_sp_id);
    config_mgr.save();

    log_message(
        &app_handle,
        format!(
            "[SUCCESS] Swapped active playthrough to '{}' for game '{}'",
            target_name, profile_name
        ),
    );

    let _ = app_handle.emit("stats-updated", ());
    let _ = app_handle.emit("backups-updated", ());

    Ok(())
}

#[tauri::command]
pub fn delete_save_profile(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    profile_id: String,
    sp_id: String,
) -> Result<(), String> {
    let mut config_mgr = state.config_manager.lock().unwrap();
    let config_dir = config_mgr.config_dir.clone();

    // Find profile
    let profile = config_mgr
        .data
        .profiles
        .iter_mut()
        .find(|p| p.id == profile_id)
        .ok_or_else(|| "Game profile not found".to_string())?;

    if let Some(active_id) = &profile.active_save_profile_id {
        if active_id == &sp_id {
            return Err("Cannot delete the currently active playthrough profile.".to_string());
        }
    }

    let profile_name = profile.name.clone();
    let original_len = profile.save_profiles.len();
    profile.save_profiles.retain(|sp| sp.id != sp_id);

    if profile.save_profiles.len() < original_len {
        config_mgr.save();

        // Remove playthrough directory
        let sp_dir = get_save_profile_dir(&config_dir, &profile_id, &sp_id);
        if sp_dir.exists() {
            let _ = std::fs::remove_dir_all(&sp_dir);
        }

        log_message(
            &app_handle,
            format!(
                "[SUCCESS] Deleted playthrough profile from game '{}'",
                profile_name
            ),
        );
        let _ = app_handle.emit("stats-updated", ());
        let _ = app_handle.emit("backups-updated", ());
        Ok(())
    } else {
        Err("Playthrough profile not found".to_string())
    }
}

#[tauri::command]
pub fn rename_save_profile(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    profile_id: String,
    sp_id: String,
    new_name: String,
) -> Result<(), String> {
    let mut config_mgr = state.config_manager.lock().unwrap();

    let profile = config_mgr
        .data
        .profiles
        .iter_mut()
        .find(|p| p.id == profile_id)
        .ok_or_else(|| "Game profile not found".to_string())?;

    if let Some(sp) = profile.save_profiles.iter_mut().find(|sp| sp.id == sp_id) {
        let old_name = sp.name.clone();
        sp.name = new_name.clone();
        let profile_name = profile.name.clone();
        config_mgr.save();

        log_message(
            &app_handle,
            format!(
                "[SUCCESS] Renamed playthrough profile from '{}' to '{}' for game '{}'",
                old_name, new_name, profile_name
            ),
        );
        let _ = app_handle.emit("stats-updated", ());
        let _ = app_handle.emit("backups-updated", ());
        Ok(())
    } else {
        Err("Playthrough profile not found".to_string())
    }
}
