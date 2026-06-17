use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct GlobalConfig {
    pub run_on_startup: bool,
    pub max_backups: u32,
    pub debounce_seconds: u64,
    #[serde(default)]
    pub steamgriddb_api_key: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct StatsConfig {
    pub total_backups: u32,
    pub last_backup_time: String,
    pub total_size_mb: f64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Profile {
    pub id: String,
    pub name: String,
    pub source_path: String,
    pub enabled: bool,
    #[serde(default)]
    pub cover_url: Option<String>,
    #[serde(default)]
    pub exe_path: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct LocalBackupProvider {
    pub enabled: bool,
    pub destination_path: String,
}

fn default_sync_interval() -> u32 {
    15
}
fn default_true() -> bool {
    true
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct GitProvider {
    pub enabled: bool,
    pub repo_url: String,
    pub branch: String,
    #[serde(default = "default_sync_interval")]
    pub sync_interval_mins: u32,
    #[serde(default = "default_true")]
    pub auto_fetch: bool,
    #[serde(default)]
    pub user_name: String,
    #[serde(default)]
    pub user_email: String,
    #[serde(default)]
    pub ssh_key_path: String,
    #[serde(default = "default_true")]
    pub accept_new_hosts: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ProvidersConfig {
    pub local_backup: LocalBackupProvider,
    pub git: GitProvider,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Config {
    pub global: GlobalConfig,
    pub stats: StatsConfig,
    pub profiles: Vec<Profile>,
    pub providers: ProvidersConfig,
}

impl Default for Config {
    fn default() -> Self {
        Config {
            global: GlobalConfig {
                run_on_startup: false,
                max_backups: 10,
                debounce_seconds: 5,
                steamgriddb_api_key: "".to_string(),
            },
            stats: StatsConfig {
                total_backups: 0,
                last_backup_time: "Never".to_string(),
                total_size_mb: 0.0,
            },
            profiles: Vec::new(),
            providers: ProvidersConfig {
                local_backup: LocalBackupProvider {
                    enabled: false,
                    destination_path: "".to_string(),
                },
                git: GitProvider {
                    enabled: false,
                    repo_url: "".to_string(),
                    branch: "main".to_string(),
                    sync_interval_mins: 15,
                    auto_fetch: true,
                    user_name: "".to_string(),
                    user_email: "".to_string(),
                    ssh_key_path: "".to_string(),
                    accept_new_hosts: true,
                },
            },
        }
    }
}

pub struct ConfigManager {
    pub config_dir: PathBuf,
    pub config_file: PathBuf,
    pub backups_dir: PathBuf,
    pub data: Config,
}

impl ConfigManager {
    pub fn new() -> Self {
        let appdata_dir = dirs::data_dir();
        let config_dir = match appdata_dir {
            Some(mut p) => {
                p.push("AtlasSave");
                p
            }
            None => {
                let mut p = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
                p.push(".atlassave");
                p
            }
        };

        let config_file = config_dir.join("config.json");
        let backups_dir = config_dir.join("backups");

        // Ensure directories exist
        fs::create_dir_all(&config_dir).unwrap_or_default();
        fs::create_dir_all(&backups_dir).unwrap_or_default();

        let mut manager = ConfigManager {
            config_dir,
            config_file,
            backups_dir,
            data: Config::default(),
        };

        manager.load();
        manager
    }

    pub fn load(&mut self) {
        if self.config_file.exists() {
            if let Ok(content) = fs::read_to_string(&self.config_file) {
                if let Ok(loaded_data) = serde_json::from_str::<Config>(&content) {
                    self.data = loaded_data;
                    return;
                }
            }
        }
        self.save();
    }

    pub fn save(&self) {
        if let Ok(serialized) = serde_json::to_string_pretty(&self.data) {
            let _ = fs::write(&self.config_file, serialized);
        }
    }
}
