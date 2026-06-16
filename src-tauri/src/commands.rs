use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager, State};
use uuid::Uuid;
use crate::config::{Config, Profile};
use crate::core::uploader::{UploadTask, Uploader};
use crate::core::archiver::Archiver;
use crate::utils::detector;
use crate::AppState;

pub fn log_message(app: &AppHandle, message: String) {
    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let formatted = format!("[{}] {}", now, message);
    println!("{}", formatted);
    let _ = app.emit("log-event", formatted.clone());

    if let Some(state) = app.try_state::<AppState>() {
        if let Ok(config) = state.config_manager.lock() {
            let log_file_path = config.config_dir.join("atlas_save.log");
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
}

#[tauri::command]
pub fn get_config(state: State<'_, AppState>) -> Config {
    let config = state.config_manager.lock().unwrap();
    config.data.clone()
}

#[tauri::command]
pub fn save_config(app_handle: AppHandle, state: State<'_, AppState>, new_config: Config) -> Result<(), String> {
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

    let profile = Profile {
        id: Uuid::new_v4().to_string(),
        name: name.clone(),
        source_path: absolute_path,
        enabled: true,
        cover_url: final_cover_url,
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
pub fn update_profile(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    id: String,
    name: String,
    source_path: String,
    enabled: bool,
    cover_url: Option<String>,
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
        log_message(&app_handle, "Manual backup skip: No enabled game profiles.".to_string());
        return Ok(());
    }

    let backups_root = config.backups_dir.clone();
    let max_backups = config.data.global.max_backups;
    let providers = config.data.providers.clone();
    let uploader_sender = state.uploader.clone_sender();
    let app_handle_clone = app_handle.clone();

    // Run manual backups in background tasks
    tauri::async_runtime::spawn(async move {
        let archiver = Archiver::new(backups_root);
        for profile in enabled_profiles {
            let name = profile.name.clone();
            let source_path = PathBuf::from(&profile.source_path);
            
            log_message(&app_handle_clone, format!("Manual backup starting for: {}", name));
            match archiver.archive_profile(&profile.id, &name, &source_path, max_backups) {
                Ok(zip_path) => {
                    let file_size = std::fs::metadata(&zip_path).map(|m| m.len()).unwrap_or(0);
                    {
                        let state = app_handle_clone.state::<AppState>();
                        let mut config = state.config_manager.lock().unwrap();
                        config.data.stats.total_backups += 1;
                        config.data.stats.last_backup_time = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
                        let mb_size = file_size as f64 / (1024.0 * 1024.0);
                        config.data.stats.total_size_mb = (config.data.stats.total_size_mb + mb_size * 100.0).round() / 100.0;
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
                    log_message(&app_handle_clone, format!("Manual backup failed for {}: {}", name, e));
                }
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub fn test_git_connection(repo_url: String) -> Result<String, String> {
    Uploader::test_git_connection(&repo_url)
}

#[tauri::command]
pub fn toggle_monitoring(app_handle: AppHandle, state: State<'_, AppState>) -> bool {
    let mut is_active = state.monitoring_active.lock().unwrap();
    *is_active = !*is_active;

    let config = state.config_manager.lock().unwrap();
    let mut watcher = state.watcher.lock().unwrap();

    if *is_active {
        watcher.start(&config.data.profiles);
        log_message(&app_handle, "File monitoring engine activated.".to_string());
    } else {
        watcher.stop();
        state.debouncer.cancel_all();
        log_message(&app_handle, "File monitoring engine paused.".to_string());
    }

    *is_active
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

fn fetch_steam_cover_art(game_name: &str) -> Option<String> {
    let encoded = urlencoding::encode(game_name);
    let url = format!("https://store.steampowered.com/api/storesearch/?term={}&l=english&cc=US", encoded);
    
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
    let url = format!("https://embed.gog.com/games/ajax/filtered?mediaType=game&search={}", encoded);
    
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
    
    let elements = body.get("data")?
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
    
    let preferred_types = ["OfferImageWide", "DieselGameBoxWide", "Thumbnail", "HorizontalPromo"];
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
pub fn fetch_game_cover_art(game_name: String) -> Result<String, String> {
    match fetch_cover_art_helper(&game_name) {
        Some(url) => Ok(url),
        None => Err("No matching game cover art found on Steam, GOG, or Epic Games Store.".to_string()),
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
    let url = format!("https://store.steampowered.com/api/storesearch/?term={}&l=english&cc=US", encoded);
    
    let response = ureq::get(&url).call().map_err(|e| e.to_string())?;
    let body: serde_json::Value = response.into_json().map_err(|e| e.to_string())?;
    
    let mut list = Vec::new();
    if let Some(items) = body.get("items").and_then(|i| i.as_array()) {
        for item in items.iter().take(3) {
            let title = item.get("name").and_then(|n| n.as_str()).unwrap_or("Unknown").to_string();
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
    let url = format!("https://embed.gog.com/games/ajax/filtered?mediaType=game&search={}", encoded);
    
    let response = ureq::get(&url).call().map_err(|e| e.to_string())?;
    let body: serde_json::Value = response.into_json().map_err(|e| e.to_string())?;
    
    let mut list = Vec::new();
    if let Some(products) = body.get("products").and_then(|p| p.as_array()) {
        for prod in products.iter().take(3) {
            let title = prod.get("title").and_then(|t| t.as_str()).unwrap_or("Unknown").to_string();
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
    
    let elements = body.get("data")
        .and_then(|d| d.get("Catalog"))
        .and_then(|c| c.get("searchStore"))
        .and_then(|s| s.get("elements"))
        .and_then(|e| e.as_array())
        .ok_or_else(|| "Failed to parse Epic store response".to_string())?;
        
    let mut list = Vec::new();
    for elem in elements.iter().take(3) {
        let title = elem.get("title").and_then(|t| t.as_str()).unwrap_or("Unknown").to_string();
        if let Some(key_images) = elem.get("keyImages").and_then(|i| i.as_array()) {
            if !key_images.is_empty() {
                let mut cover_url = None;
                let preferred_types = ["OfferImageWide", "DieselGameBoxWide", "Thumbnail", "HorizontalPromo"];
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
                    key_images[0].get("url").and_then(|u| u.as_str()).map(|s| s.to_string())
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
    let autocomplete_url = format!("https://www.steamgriddb.com/api/v2/search/autocomplete/{}", encoded);
    let auth_header = format!("Bearer {}", api_key);
    
    // 1. Get game ID from autocomplete
    let response = ureq::get(&autocomplete_url)
        .set("Authorization", &auth_header)
        .call()
        .map_err(|e| e.to_string())?;
        
    let body: serde_json::Value = response.into_json().map_err(|e| e.to_string())?;
    
    if !body.get("success").and_then(|s| s.as_bool()).unwrap_or(false) {
        return Err("SteamGridDB API search request unsuccessful".to_string());
    }
    
    let games = body.get("data")
        .and_then(|d| d.as_array())
        .ok_or_else(|| "Failed to parse SteamGridDB autocomplete data".to_string())?;
        
    if games.is_empty() {
        return Ok(Vec::new());
    }
    
    let game_id = games[0].get("id")
        .and_then(|id| id.as_i64())
        .ok_or_else(|| "Failed to parse SteamGridDB game ID".to_string())?;
        
    let game_title = games[0].get("name")
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
    
    if !grid_body.get("success").and_then(|s| s.as_bool()).unwrap_or(false) {
        return Err("SteamGridDB Grids request unsuccessful".to_string());
    }
    
    let grids = grid_body.get("data")
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
pub fn search_game_covers(
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
pub fn get_backups(state: State<'_, AppState>, profile_id: String) -> Result<Vec<BackupInfo>, String> {
    let config = state.config_manager.lock().unwrap();
    let profile_backup_dir = config.backups_dir.join(&profile_id);

    if !profile_backup_dir.exists() {
        return Ok(Vec::new());
    }

    let mut list = Vec::new();
    if let Ok(entries) = std::fs::read_dir(profile_backup_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() && path.extension().map_or(false, |ext| ext == "zip") {
                let filename = path.file_name().unwrap_or_default().to_string_lossy().to_string();
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
    let (source_path_str, backups_dir) = {
        let config = state.config_manager.lock().unwrap();
        let profile = config.data.profiles.iter().find(|p| p.id == profile_id)
            .ok_or_else(|| "Profile not found".to_string())?;
        (profile.source_path.clone(), config.backups_dir.clone())
    };

    let zip_path = backups_dir.join(&profile_id).join(&filename);
    let source_path = PathBuf::from(&source_path_str);

    log_message(&app_handle, format!("Starting save restore for profile: {}", profile_id));

    if !zip_path.exists() {
        return Err("Backup archive file does not exist.".to_string());
    }

    let app_handle_clone = app_handle.clone();
    tauri::async_runtime::spawn(async move {
        let temp_bak_path = source_path.with_extension("restore_bak");
        
        if source_path.exists() {
            if temp_bak_path.exists() {
                if let Err(e) = std::fs::remove_dir_all(&temp_bak_path) {
                    log_message(&app_handle_clone, format!("Restore failed (could not clear old temp bak): {}", e));
                    return;
                }
            }
            if let Err(e) = std::fs::rename(&source_path, &temp_bak_path) {
                log_message(&app_handle_clone, format!("Restore failed (could not backup existing files): {}", e));
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
                log_message(&app_handle_clone, format!("[SUCCESS] Restore completed successfully from {}", filename));
                let _ = app_handle_clone.emit("backups-updated", ());
            }
            Err(err) => {
                log_message(&app_handle_clone, format!("[ERROR] Restore failed during extraction: {}. Rolling back...", err));
                if temp_bak_path.exists() {
                    let _ = std::fs::remove_dir_all(&source_path);
                    if let Err(rollback_err) = std::fs::rename(&temp_bak_path, &source_path) {
                        log_message(&app_handle_clone, format!("[CRITICAL ERROR] Rollback failed: {}", rollback_err));
                    } else {
                        log_message(&app_handle_clone, "Rollback completed. Original files restored.".to_string());
                    }
                }
            }
        }
    });

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
        log_message(&app_handle, format!("[SUCCESS] Backup deleted: {}", filename));
        let _ = app_handle.emit("backups-updated", ());
        Ok(())
    } else {
        Err("Backup file not found".to_string())
    }
}

#[tauri::command]
pub fn open_backup_directory(
    state: State<'_, AppState>,
    profile_id: String,
) -> Result<(), String> {
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
        let name = profile.name.clone();
        let source_path = PathBuf::from(&profile.source_path);

        log_message(&app_handle_clone, format!("Manual backup starting for: {}", name));
        match archiver.archive_profile(&profile.id, &name, &source_path, max_backups) {
            Ok(zip_path) => {
                let file_size = std::fs::metadata(&zip_path).map(|m| m.len()).unwrap_or(0);
                {
                    let state = app_handle_clone.state::<AppState>();
                    let mut config = state.config_manager.lock().unwrap();
                    config.data.stats.total_backups += 1;
                    config.data.stats.last_backup_time = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
                    let mb_size = file_size as f64 / (1024.0 * 1024.0);
                    config.data.stats.total_size_mb = (config.data.stats.total_size_mb + mb_size * 100.0).round() / 100.0;
                    config.save();
                }

                uploader_sender.enqueue(UploadTask {
                    file_path: zip_path,
                    profile_name: name.clone(),
                    providers: providers.clone(),
                });

                let _ = app_handle_clone.emit("stats-updated", ());
                let _ = app_handle_clone.emit("backups-updated", ());
                log_message(&app_handle_clone, format!("[SUCCESS] Manual backup complete for: {}", name));
            }
            Err(e) => {
                log_message(&app_handle_clone, format!("Manual backup failed for {}: {}", name, e));
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub fn get_log_history(state: State<'_, AppState>) -> Result<Vec<String>, String> {
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
        (config.config_dir.join("git_repo"), config.backups_dir.clone())
    };

    tauri::async_runtime::spawn(async move {
        let _ = Uploader::perform_full_sync(&app_handle, &git_dir, &backups_dir).await;
    });

    Ok(())
}
