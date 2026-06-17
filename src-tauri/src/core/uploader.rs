use crate::config::ProvidersConfig;
use crate::AppState;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::mpsc::{self, UnboundedReceiver, UnboundedSender};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

pub struct UploadTask {
    pub file_path: PathBuf,
    pub profile_name: String,
    pub providers: ProvidersConfig,
}

#[derive(Clone)]
pub struct Uploader {
    sender: UnboundedSender<UploadTask>,
}

fn sanitize_profile_name(name: &str) -> String {
    name.chars()
        .filter(|c| c.is_alphanumeric() || *c == ' ' || *c == '_' || *c == '-')
        .collect::<String>()
        .trim()
        .replace(' ', "_")
}

impl Uploader {
    pub fn new(app_handle: AppHandle, config_dir: PathBuf) -> Self {
        let (sender, receiver) = mpsc::unbounded_channel::<UploadTask>();
        let git_dir = config_dir.join("git_repo");
        let backups_dir = config_dir.join("backups");
        let app_handle_clone = app_handle.clone();
        let git_dir_clone = git_dir.clone();
        let backups_dir_clone = backups_dir.clone();

        // 1. Spawn upload queue listener
        tauri::async_runtime::spawn(async move {
            Self::queue_worker_loop(app_handle, git_dir, receiver).await;
        });

        // 2. Spawn periodic sync scheduler
        tauri::async_runtime::spawn(async move {
            Self::sync_scheduler_loop(app_handle_clone, git_dir_clone, backups_dir_clone).await;
        });

        Uploader { sender }
    }

    pub fn clone_sender(&self) -> Self {
        self.clone()
    }

    pub fn enqueue(&self, task: UploadTask) {
        let _ = self.sender.send(task);
    }

    async fn queue_worker_loop(
        app_handle: AppHandle,
        git_dir: PathBuf,
        mut receiver: UnboundedReceiver<UploadTask>,
    ) {
        while let Some(task) = receiver.recv().await {
            let file_name = task
                .file_path
                .file_name()
                .unwrap()
                .to_string_lossy()
                .to_string();

            // 1. Local copy backup (NAS)
            if task.providers.local_backup.enabled
                && !task.providers.local_backup.destination_path.is_empty()
            {
                let dest_dir = Path::new(&task.providers.local_backup.destination_path);
                if let Err(e) = fs::create_dir_all(dest_dir) {
                    Self::log(
                        &app_handle,
                        format!("Local backup failed: folder creation error: {}", e),
                    );
                } else {
                    let dest_file = dest_dir.join(&file_name);
                    match fs::copy(&task.file_path, &dest_file) {
                        Ok(_) => Self::log(
                            &app_handle,
                            format!("Local copy backup successful: {}", file_name),
                        ),
                        Err(e) => {
                            Self::log(&app_handle, format!("Local copy backup failed: {}", e))
                        }
                    }
                }
            }

            // 2. Git backup (Stage local file copy)
            if task.providers.git.enabled && !task.providers.git.repo_url.is_empty() {
                let sanitized_game = sanitize_profile_name(&task.profile_name);
                let dest_dir = git_dir.join(&sanitized_game);

                Self::log(
                    &app_handle,
                    format!(
                        "Staging backup locally in Git repo under folder: {}",
                        sanitized_game
                    ),
                );

                if let Err(e) = fs::create_dir_all(&dest_dir) {
                    Self::log(
                        &app_handle,
                        format!("Git local stage failed: folder creation error: {}", e),
                    );
                } else {
                    let dest_file = dest_dir.join(&file_name);
                    match fs::copy(&task.file_path, &dest_file) {
                        Ok(_) => {
                            Self::log(
                                &app_handle,
                                format!("Local Git stage successful: {}", file_name),
                            );
                            // If sync interval is set to 0 (Real-time), trigger sync immediately
                            if task.providers.git.sync_interval_mins == 0 {
                                let backups_dir = git_dir.parent().unwrap().join("backups");
                                let app_handle_clone = app_handle.clone();
                                let git_dir_clone = git_dir.clone();
                                tauri::async_runtime::spawn(async move {
                                    let _ = Self::perform_full_sync(
                                        &app_handle_clone,
                                        &git_dir_clone,
                                        &backups_dir,
                                    )
                                    .await;
                                });
                            }
                        }
                        Err(e) => Self::log(&app_handle, format!("Git local stage failed: {}", e)),
                    }
                }
            }
        }
    }

    async fn sync_scheduler_loop(app_handle: AppHandle, git_dir: PathBuf, backups_dir: PathBuf) {
        // Delay 10 seconds on startup to let app initialize fully
        tokio::time::sleep(tokio::time::Duration::from_secs(10)).await;

        let git_config_startup = {
            if let Some(state) = app_handle.try_state::<AppState>() {
                if let Ok(config) = state.config_manager.lock() {
                    config.data.providers.git.clone()
                } else {
                    return;
                }
            } else {
                return;
            }
        };

        // If auto fetch is enabled, do a sync on startup
        if git_config_startup.enabled
            && !git_config_startup.repo_url.is_empty()
            && git_config_startup.auto_fetch
        {
            Self::log(
                &app_handle,
                "Auto-fetch enabled. Running startup Git sync...".to_string(),
            );
            let _ = Self::perform_full_sync(&app_handle, &git_dir, &backups_dir).await;
        }

        let mut last_sync = std::time::Instant::now();
        loop {
            tokio::time::sleep(tokio::time::Duration::from_secs(60)).await;

            let git_config = {
                if let Some(state) = app_handle.try_state::<AppState>() {
                    if let Ok(config) = state.config_manager.lock() {
                        config.data.providers.git.clone()
                    } else {
                        continue;
                    }
                } else {
                    continue;
                }
            };

            if git_config.enabled
                && !git_config.repo_url.is_empty()
                && git_config.sync_interval_mins > 0
            {
                let elapsed = last_sync.elapsed().as_secs() / 60;
                if elapsed >= git_config.sync_interval_mins as u64 {
                    let _ = Self::perform_full_sync(&app_handle, &git_dir, &backups_dir).await;
                    last_sync = std::time::Instant::now();
                }
            }
        }
    }

    fn ensure_git_repo_init(
        app_handle: &AppHandle,
        git_dir: &Path,
        git_config: &crate::config::GitProvider,
    ) -> Result<(), String> {
        fs::create_dir_all(git_dir).map_err(|e| e.to_string())?;

        if !git_dir.join(".git").exists() {
            Self::log(
                app_handle,
                "Initializing local Git repository...".to_string(),
            );
            Self::run_git_cmd(git_dir, &["init"])?;

            let _ = Self::run_git_cmd(git_dir, &["remote", "add", "origin", &git_config.repo_url]);
            let _ = Self::run_git_cmd(git_dir, &["branch", "-M", &git_config.branch]);
        } else {
            let _ = Self::run_git_cmd(
                git_dir,
                &["remote", "set-url", "origin", &git_config.repo_url],
            );
        }

        // Apply config options
        let user_name = if git_config.user_name.trim().is_empty() {
            "AtlasSave Bot"
        } else {
            &git_config.user_name
        };
        let user_email = if git_config.user_email.trim().is_empty() {
            "bot@atlassave.local"
        } else {
            &git_config.user_email
        };
        Self::run_git_cmd(git_dir, &["config", "user.name", user_name])?;
        Self::run_git_cmd(git_dir, &["config", "user.email", user_email])?;

        // Apply SSH options
        let ssh_command = if git_config.accept_new_hosts {
            if !git_config.ssh_key_path.trim().is_empty() {
                format!(
                    "ssh -i \"{}\" -o StrictHostKeyChecking=accept-new",
                    git_config.ssh_key_path
                )
            } else {
                "ssh -o StrictHostKeyChecking=accept-new".to_string()
            }
        } else {
            if !git_config.ssh_key_path.trim().is_empty() {
                format!("ssh -i \"{}\"", git_config.ssh_key_path)
            } else {
                "ssh".to_string()
            }
        };
        Self::run_git_cmd(git_dir, &["config", "core.sshCommand", &ssh_command])?;

        Ok(())
    }

    pub async fn perform_full_sync(
        app_handle: &AppHandle,
        git_dir: &Path,
        backups_dir: &Path,
    ) -> Result<(), String> {
        let git_config = {
            if let Some(state) = app_handle.try_state::<AppState>() {
                if let Ok(config) = state.config_manager.lock() {
                    config.data.providers.git.clone()
                } else {
                    return Err("Failed to lock config".to_string());
                }
            } else {
                return Err("Failed to retrieve AppState".to_string());
            }
        };

        if !git_config.enabled || git_config.repo_url.is_empty() {
            return Ok(());
        }

        Self::log(app_handle, "Starting full Git sync...".to_string());

        // 1. Initialize repository if needed and apply configurations
        if let Err(e) = Self::ensure_git_repo_init(app_handle, git_dir, &git_config) {
            Self::log(app_handle, format!("Git repo init error: {}", e));
            return Err(e);
        }

        // 2. Fetch and Pull remote changes (accepting remote changes in case of conflict)
        if git_config.auto_fetch {
            Self::log(app_handle, "Fetching remote updates...".to_string());
            let _ = Self::run_git_cmd(git_dir, &["fetch", "origin"]);

            let pull_res = Self::run_git_cmd(
                git_dir,
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
                Ok(_) => Self::log(app_handle, "Pull complete.".to_string()),
                Err(e) => Self::log(app_handle, format!("Pull notes: {}", e)),
            }

            // 3. Scan remote ZIPs and copy them back to local backups_dir
            if let Err(e) =
                Self::sync_remote_zips_to_local_backups(app_handle, git_dir, backups_dir)
            {
                Self::log(app_handle, format!("Importing remote saves failed: {}", e));
            }
        }

        // 4. Check status and commit/push any unsynced local backups
        match Self::run_git_cmd(git_dir, &["status", "--porcelain"]) {
            Ok(status) => {
                if !status.trim().is_empty() {
                    Self::log(
                        app_handle,
                        "Unsynced local saves detected. Committing and pushing...".to_string(),
                    );
                    if let Err(e) = Self::run_git_cmd(git_dir, &["add", "."]) {
                        Self::log(app_handle, format!("Git add error: {}", e));
                        return Err(e);
                    }
                    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
                    let commit_msg = format!("Auto-backup: saves synced - {}", now);
                    if let Err(e) = Self::run_git_cmd(git_dir, &["commit", "-m", &commit_msg]) {
                        Self::log(app_handle, format!("Git commit error: {}", e));
                        return Err(e);
                    }

                    // Push
                    match Self::run_git_cmd(git_dir, &["push", "origin", &git_config.branch]) {
                        Ok(_) => Self::log(
                            app_handle,
                            "Git sync pushes completed successfully!".to_string(),
                        ),
                        Err(e) => {
                            Self::log(
                                app_handle,
                                format!("Push failed: {}. Retrying push rebase...", e),
                            );
                            let _ = Self::run_git_cmd(
                                git_dir,
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
                                Self::run_git_cmd(git_dir, &["push", "origin", &git_config.branch])
                            {
                                Self::log(app_handle, format!("Git push retry failed: {}", e2));
                                return Err(e2);
                            }
                            Self::log(
                                app_handle,
                                "Git sync push retry completed successfully!".to_string(),
                            );
                        }
                    }
                } else {
                    Self::log(
                        app_handle,
                        "Git sync completed. Already up to date.".to_string(),
                    );
                }
            }
            Err(e) => {
                Self::log(app_handle, format!("Git status error: {}", e));
                return Err(e);
            }
        }

        let _ = app_handle.emit("backups-updated", ());
        Ok(())
    }

    fn sync_remote_zips_to_local_backups(
        app_handle: &AppHandle,
        git_dir: &Path,
        backups_dir: &Path,
    ) -> Result<(), String> {
        let profiles = {
            if let Some(state) = app_handle.try_state::<AppState>() {
                if let Ok(config) = state.config_manager.lock() {
                    config.data.profiles.clone()
                } else {
                    return Err("Failed to lock config".to_string());
                }
            } else {
                return Err("Failed to retrieve AppState".to_string());
            }
        };

        for profile in profiles {
            let sanitized_name = sanitize_profile_name(&profile.name);
            let profile_git_dir = git_dir.join(&sanitized_name);

            if profile_git_dir.exists() && profile_git_dir.is_dir() {
                let profile_backups_dir = backups_dir.join(&profile.id);
                std::fs::create_dir_all(&profile_backups_dir).map_err(|e| e.to_string())?;

                if let Ok(entries) = std::fs::read_dir(profile_git_dir) {
                    for entry in entries.flatten() {
                        let path = entry.path();
                        if path.is_file() && path.extension().is_some_and(|ext| ext == "zip") {
                            let filename = path.file_name().unwrap();
                            let dest_file = profile_backups_dir.join(filename);
                            if !dest_file.exists() {
                                std::fs::copy(&path, &dest_file).map_err(|e| e.to_string())?;
                                Self::log(
                                    app_handle,
                                    format!(
                                        "Sync: Imported remote backup file {}",
                                        filename.to_string_lossy()
                                    ),
                                );
                            }
                        }
                    }
                }
            }
        }
        Ok(())
    }

    fn run_git_cmd(git_dir: &Path, args: &[&str]) -> Result<String, String> {
        let mut cmd = Command::new("git");
        cmd.args(args).current_dir(git_dir);

        #[cfg(target_os = "windows")]
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

        let output = cmd.output().map_err(|e| e.to_string())?;

        if output.status.success() {
            Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
        } else {
            Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
        }
    }

    pub fn test_git_connection(repo_url: &str) -> Result<String, String> {
        let mut cmd = Command::new("git");
        cmd.args(["ls-remote", repo_url]);
        cmd.env("GIT_SSH_COMMAND", "ssh -o StrictHostKeyChecking=accept-new");

        #[cfg(target_os = "windows")]
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

        let output = cmd.output().map_err(|e| e.to_string())?;

        if output.status.success() {
            Ok("Git Connection Successful! Repository is reachable.".to_string())
        } else {
            Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
        }
    }

    fn log(app_handle: &AppHandle, message: String) {
        println!("Uploader: {}", message);
        let _ = app_handle.emit("uploader-log", message);
    }
}
