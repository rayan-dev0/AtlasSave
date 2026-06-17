use std::env;
use std::fs;
use std::path::{Path, PathBuf};

fn clean_name(s: &str) -> String {
    s.chars()
        .filter(|c| c.is_alphanumeric())
        .collect::<String>()
        .to_lowercase()
}

fn is_fuzzy_match(dir_name: &str, target_name: &str) -> bool {
    let c_dir = clean_name(dir_name);
    let c_target = clean_name(target_name);
    if c_dir.is_empty() || c_target.is_empty() {
        return false;
    }
    c_dir == c_target || c_dir.contains(&c_target) || c_target.contains(&c_dir)
}

fn refine_save_path(save_path: PathBuf) -> PathBuf {
    let common_subdirs = [
        "saved/savegames",
        "saved/saves",
        "saved games",
        "saves",
        "save",
        "remote",
        "savegames",
        "storage",
        "profiles",
        "profile",
    ];

    // 1. Check common subdirs
    for sub in &common_subdirs {
        let deep_path = save_path.join(sub);
        if deep_path.exists() && deep_path.is_dir() {
            println!("Detector: Refining path to deeper folder: {:?}", deep_path);
            return deep_path;
        }
    }

    // 2. Unreal Engine structure checks
    let saved_folder = save_path.join("Saved");
    if saved_folder.exists() && saved_folder.is_dir() {
        for sub in &["SaveGames", "Saves", "Save"] {
            let deep_path = saved_folder.join(sub);
            if deep_path.exists() && deep_path.is_dir() {
                println!(
                    "Detector: Refining path to deeper UE folder: {:?}",
                    deep_path
                );
                return deep_path;
            }
        }
    }

    // 3. Numeric Steam ID folder refinement
    if let Ok(entries) = fs::read_dir(&save_path) {
        let children: Vec<PathBuf> = entries
            .flatten()
            .map(|e| e.path())
            .filter(|p| p.is_dir())
            .collect();
        if children.len() == 1 {
            if let Some(folder_name) = children[0].file_name().and_then(|n| n.to_str()) {
                if folder_name.chars().all(|c| c.is_ascii_digit()) && folder_name.len() >= 7 {
                    println!(
                        "Detector: Refining path to numeric Steam account ID folder: {:?}",
                        children[0]
                    );
                    return children[0].clone();
                }
            }
        }
    }

    save_path
}

fn find_steam_appid_from_manifest(game_dir: &Path) -> Option<String> {
    if let (Some(parent), Some(game_name)) = (game_dir.parent(), game_dir.file_name()) {
        if parent.file_name()?.to_string_lossy().to_lowercase() == "common" {
            if let Some(grandparent) = parent.parent() {
                if grandparent.file_name()?.to_string_lossy().to_lowercase() == "steamapps" {
                    if let Ok(entries) = fs::read_dir(grandparent) {
                        for entry in entries.flatten() {
                            let path = entry.path();
                            if path.is_file()
                                && path.file_name().and_then(|n| n.to_str()).is_some_and(|s| {
                                    s.starts_with("appmanifest_") && s.ends_with(".acf")
                                })
                            {
                                if let Ok(content) = fs::read_to_string(&path) {
                                    let game_name_str = game_name.to_string_lossy().to_string();
                                    let patterns = [
                                        format!("\"installdir\"\t\t\"{}\"", game_name_str),
                                        format!("\"installdir\" \"{}\"", game_name_str),
                                        format!("\"installdir\"\t\"{}\"", game_name_str),
                                    ];
                                    if patterns.iter().any(|p| content.contains(p)) {
                                        if let Some(stem) =
                                            path.file_stem().and_then(|s| s.to_str())
                                        {
                                            let parts: Vec<&str> = stem.split('_').collect();
                                            if parts.len() > 1 {
                                                println!("Detector: Found Steam AppID {} in manifest: {:?}", parts[1], path);
                                                return Some(parts[1].to_string());
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    None
}

fn expand_win_vars(input: &str) -> String {
    let mut output = input.to_string();
    if let Ok(appdata) = env::var("APPDATA") {
        output = output
            .replace("%APPDATA%", &appdata)
            .replace("%appdata%", &appdata);
    }
    if let Ok(localappdata) = env::var("LOCALAPPDATA") {
        output = output
            .replace("%LOCALAPPDATA%", &localappdata)
            .replace("%localappdata%", &localappdata);
    }
    if let Ok(public) = env::var("PUBLIC") {
        output = output
            .replace("%PUBLIC%", &public)
            .replace("%public%", &public);
    }
    if let Ok(userprofile) = env::var("USERPROFILE") {
        output = output
            .replace("%USERPROFILE%", &userprofile)
            .replace("%userprofile%", &userprofile);
    }
    output
}

pub fn detect_save_directory(target_path: PathBuf) -> Option<PathBuf> {
    if !target_path.exists() {
        return None;
    }

    let (game_dir, game_name) = if target_path.is_file() {
        (
            target_path.parent()?.to_path_buf(),
            target_path.file_stem()?.to_string_lossy().to_string(),
        )
    } else {
        (
            target_path.clone(),
            target_path.file_name()?.to_string_lossy().to_string(),
        )
    };

    println!(
        "Detector: Scanning save directory for game: {} inside {:?}",
        game_name, game_dir
    );

    // --- Strategy A: Parse Emulator Config Files ---
    let ini_files = ["steam_emu.ini", "tenoke.ini", "rune.ini"];
    for ini in &ini_files {
        let ini_path = game_dir.join(ini);
        if ini_path.exists() {
            if let Ok(content) = fs::read_to_string(&ini_path) {
                for line in content.lines() {
                    let trimmed = line.trim();
                    if trimmed.to_lowercase().starts_with("savepath=") {
                        let parts: Vec<&str> = trimmed.splitn(2, '=').collect();
                        if parts.len() == 2 {
                            let val = parts[1].trim();
                            if !val.is_empty() {
                                let expanded = expand_win_vars(val);
                                let mut resolved_path = PathBuf::from(expanded);
                                if !resolved_path.is_absolute() {
                                    resolved_path = game_dir.join(resolved_path);
                                }
                                if resolved_path.exists() {
                                    println!(
                                        "Detector: Found custom save path from {}: {:?}",
                                        ini, resolved_path
                                    );
                                    return Some(refine_save_path(resolved_path));
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // --- Strategy B: AppID-Based Emulator Save Search ---
    let mut appid = None;
    let appid_file = game_dir.join("steam_appid.txt");
    if appid_file.exists() {
        if let Ok(content) = fs::read_to_string(&appid_file) {
            let id = content.trim().to_string();
            if !id.is_empty() {
                println!("Detector: Steam AppID file detected: {}", id);
                appid = Some(id);
            }
        }
    }

    if appid.is_none() {
        appid = find_steam_appid_from_manifest(&game_dir);
    }

    if let Some(ref appid_val) = appid {
        let appdata = env::var("APPDATA").ok().map(PathBuf::from);
        let public_dir = env::var("PUBLIC").ok().map(PathBuf::from);

        let mut emu_paths = Vec::new();
        if let Some(ref ad) = appdata {
            emu_paths.push(ad.join("Goldberg SteamEmu Saves").join(appid_val));
            emu_paths.push(ad.join("Steam").join("CODEX").join(appid_val));
            emu_paths.push(ad.join("HOODLUM").join(appid_val));
        }

        if let Some(ref pd) = public_dir {
            let pub_docs = pd.join("Documents");
            emu_paths.push(pub_docs.join("Steam").join("CODEX").join(appid_val));
            emu_paths.push(pub_docs.join("Steam").join("RUNE").join(appid_val));
            emu_paths.push(pub_docs.join("Steam").join("PLAZA").join(appid_val));
        }

        for path in emu_paths {
            if path.exists() {
                println!(
                    "Detector: Located offline emulator save path for AppID {}: {:?}",
                    appid_val, path
                );
                return Some(refine_save_path(path));
            }
        }

        // Steam userdata check
        let program_files_86 =
            env::var("ProgramFiles(x86)").unwrap_or_else(|_| "C:\\Program Files (x86)".to_string());
        let program_files =
            env::var("ProgramFiles").unwrap_or_else(|_| "C:\\Program Files".to_string());
        let steam_paths = [
            PathBuf::from(program_files_86)
                .join("Steam")
                .join("userdata"),
            PathBuf::from(program_files).join("Steam").join("userdata"),
        ];

        for sp in &steam_paths {
            if sp.exists() {
                if let Ok(entries) = fs::read_dir(sp) {
                    for user_dir in entries.flatten() {
                        let user_path = user_dir.path();
                        if user_path.is_dir()
                            && user_path
                                .file_name()
                                .and_then(|n| n.to_str())
                                .is_some_and(|s| s.chars().all(|c| c.is_ascii_digit()))
                        {
                            let app_save_dir = user_path.join(appid_val);
                            if app_save_dir.exists() {
                                println!(
                                    "Detector: Located Steam userdata path for AppID {}: {:?}",
                                    appid_val, app_save_dir
                                );
                                return Some(refine_save_path(app_save_dir));
                            }
                        }
                    }
                }
            }
        }
    }

    // --- Strategy C: Scan game directory child folders ---
    let common_subdirs = [
        "saves",
        "save",
        "savegames",
        "save_games",
        "saved games",
        "remote",
        "storage",
        "profiles",
        "profile",
    ];

    if let Ok(entries) = fs::read_dir(&game_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                if let Some(folder_name) = path.file_name().and_then(|n| n.to_str()) {
                    if common_subdirs.contains(&folder_name.to_lowercase().as_str()) {
                        println!(
                            "Detector: Located save directory in game folder: {:?}",
                            path
                        );
                        return Some(refine_save_path(path));
                    }
                }

                // Check depth-2
                if let Ok(subentries) = fs::read_dir(&path) {
                    for subentry in subentries.flatten() {
                        let subpath = subentry.path();
                        if subpath.is_dir() {
                            if let Some(sub_name) = subpath.file_name().and_then(|n| n.to_str()) {
                                if common_subdirs.contains(&sub_name.to_lowercase().as_str()) {
                                    println!(
                                        "Detector: Located save directory in game subfolder: {:?}",
                                        subpath
                                    );
                                    return Some(refine_save_path(subpath));
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // --- Strategy D: Windows Standard Roots Fuzzy Matches ---
    let mut standard_roots = Vec::new();
    if let Some(home) = dirs::home_dir() {
        let saved_games = home.join("Saved Games");
        if saved_games.exists() {
            standard_roots.push(saved_games);
        }
        let my_games = home.join("Documents").join("My Games");
        if my_games.exists() {
            standard_roots.push(my_games);
        }
        let docs = home.join("Documents");
        if docs.exists() {
            standard_roots.push(docs);
        }
        let appdata_local = home.join("AppData").join("Local");
        if appdata_local.exists() {
            standard_roots.push(appdata_local);
        }
        let appdata_roaming = home.join("AppData").join("Roaming");
        if appdata_roaming.exists() {
            standard_roots.push(appdata_roaming);
        }
        let appdata_locallow = home.join("AppData").join("LocalLow");
        if appdata_locallow.exists() {
            standard_roots.push(appdata_locallow);
        }
    }

    if let Ok(public) = env::var("PUBLIC") {
        let pub_docs = PathBuf::from(public).join("Documents");
        if pub_docs.exists() {
            standard_roots.push(pub_docs.clone());
            let steam_pub = pub_docs.join("Steam");
            if steam_pub.exists() {
                standard_roots.push(steam_pub);
            }
        }
    }

    for root in &standard_roots {
        if let Ok(entries) = fs::read_dir(root) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                        // Level-1 match
                        if is_fuzzy_match(name, &game_name) {
                            println!(
                                "Detector: Fuzzy-detected save directory (Level-1) in {:?}: {:?}",
                                root, path
                            );
                            return Some(refine_save_path(path));
                        }

                        // Level-2 match
                        if let Ok(subentries) = fs::read_dir(&path) {
                            for subentry in subentries.flatten() {
                                let subpath = subentry.path();
                                if subpath.is_dir() {
                                    if let Some(sub_name) =
                                        subpath.file_name().and_then(|n| n.to_str())
                                    {
                                        if is_fuzzy_match(sub_name, &game_name) {
                                            println!("Detector: Fuzzy-detected save directory (Level-2) in {:?}: {:?}", root, subpath);
                                            return Some(refine_save_path(subpath));
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    println!(
        "Detector: Save folder auto-detect unsuccessful for: {}",
        game_name
    );
    None
}
