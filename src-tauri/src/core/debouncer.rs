use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::async_runtime::JoinHandle;

pub type DebounceCallback = Arc<dyn Fn(String) + Send + Sync + 'static>;

pub struct Debouncer {
    timers: Arc<Mutex<HashMap<String, JoinHandle<()>>>>,
    callback: DebounceCallback,
}

impl Debouncer {
    pub fn new(callback: DebounceCallback) -> Self {
        Debouncer {
            timers: Arc::new(Mutex::new(HashMap::new())),
            callback,
        }
    }

    pub fn on_change(&self, profile_id: String, debounce_seconds: u64) {
        let mut timers = self.timers.lock().unwrap();

        // Cancel existing timer for this profile if it exists
        if let Some(handle) = timers.remove(&profile_id) {
            handle.abort();
        }

        let timers_clone = Arc::clone(&self.timers);
        let profile_id_clone = profile_id.clone();
        let callback_clone = Arc::clone(&self.callback);

        // Spawn a new debounce timer task
        let handle = tauri::async_runtime::spawn(async move {
            tokio::time::sleep(Duration::from_secs(debounce_seconds)).await;

            // Remove ourselves from the map when fired
            {
                let mut timers = timers_clone.lock().unwrap();
                timers.remove(&profile_id_clone);
            }

            // Execute the callback
            (callback_clone)(profile_id_clone);
        });

        timers.insert(profile_id, handle);
    }

    pub fn cancel_all(&self) {
        let mut timers = self.timers.lock().unwrap();
        for (_, handle) in timers.drain() {
            handle.abort();
        }
    }
}

impl Drop for Debouncer {
    fn drop(&mut self) {
        self.cancel_all();
    }
}
