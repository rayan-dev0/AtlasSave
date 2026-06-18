use crate::config::Profile;
use notify::{Event, RecommendedWatcher, RecursiveMode, Watcher};
use std::collections::HashMap;
use std::path::Path;
use std::sync::{Arc, Mutex};

pub type WatcherCallback = Arc<dyn Fn(String) + Send + Sync + 'static>;

pub struct SaveWatcher {
    watcher: Option<RecommendedWatcher>,
    callback: WatcherCallback,
    active_watches: Arc<Mutex<HashMap<String, String>>>, // profile_id -> source_path
}

impl SaveWatcher {
    pub fn new(callback: WatcherCallback) -> Self {
        SaveWatcher {
            watcher: None,
            callback,
            active_watches: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn start(&mut self, profiles: &[Profile]) {
        if self.watcher.is_some() {
            self.stop();
        }

        let callback = Arc::clone(&self.callback);
        let active_watches_clone = Arc::clone(&self.active_watches);
        {
            let mut active_watches = active_watches_clone.lock().unwrap();
            active_watches.clear();
        }

        // Create the event handler closure
        let event_handler = move |res: Result<Event, notify::Error>| {
            if let Ok(event) = res {
                // Ignore directory-only creation/removal events, focus on data modifications
                if event.kind.is_access() || event.kind.is_other() {
                    return;
                }

                let matched_profile_id = {
                    let watches = active_watches_clone.lock().unwrap();
                    let mut matched = None;
                    'outer: for path in &event.paths {
                        for (profile_id, source_path) in watches.iter() {
                            let watch_path = Path::new(source_path);
                            if path.starts_with(watch_path) {
                                matched = Some(profile_id.clone());
                                break 'outer;
                            }
                        }
                    }
                    matched
                };

                if let Some(profile_id) = matched_profile_id {
                    (callback)(profile_id);
                }
            }
        };

        // Initialize the recommended watcher
        let mut watcher = match notify::recommended_watcher(event_handler) {
            Ok(w) => w,
            Err(e) => {
                eprintln!("Failed to create notify watcher: {:?}", e);
                return;
            }
        };

        let mut watch_count = 0;
        for profile in profiles {
            if !profile.enabled {
                continue;
            }

            let path = Path::new(&profile.source_path);
            if !path.exists() {
                eprintln!("Skipping watcher: path does not exist: {:?}", path);
                continue;
            }

            if watcher.watch(path, RecursiveMode::Recursive).is_ok() {
                self.active_watches
                    .lock()
                    .unwrap()
                    .insert(profile.id.clone(), profile.source_path.clone());
                watch_count += 1;
            } else {
                eprintln!("Failed to watch path: {:?}", path);
            }
        }

        if watch_count > 0 {
            self.watcher = Some(watcher);
            println!(
                "SaveWatcher: Started monitoring {} profile(s).",
                watch_count
            );
        } else {
            println!("SaveWatcher: No active folders to monitor.");
        }
    }

    pub fn stop_watching_profile(&mut self, profile_id: &str) {
        if let Some(ref mut watcher) = self.watcher {
            let mut watches = self.active_watches.lock().unwrap();
            if let Some(path_str) = watches.remove(profile_id) {
                let path = Path::new(&path_str);
                let _ = watcher.unwatch(path);
                println!(
                    "SaveWatcher: Temporarily paused monitoring for profile {}",
                    profile_id
                );
            }
        }
    }

    pub fn start_watching_profile(&mut self, profile: &Profile) {
        if let Some(ref mut watcher) = self.watcher {
            let path = Path::new(&profile.source_path);
            if path.exists() && watcher.watch(path, RecursiveMode::Recursive).is_ok() {
                self.active_watches
                    .lock()
                    .unwrap()
                    .insert(profile.id.clone(), profile.source_path.clone());
                println!("SaveWatcher: Resumed monitoring for profile {}", profile.id);
            }
        }
    }

    pub fn stop(&mut self) {
        if let Some(mut watcher) = self.watcher.take() {
            let watches = self.active_watches.lock().unwrap();
            for (_, path_str) in watches.iter() {
                let path = Path::new(path_str);
                let _ = watcher.unwatch(path);
            }
            println!("SaveWatcher: Stopped directory monitoring.");
        }
        self.active_watches.lock().unwrap().clear();
    }
}
