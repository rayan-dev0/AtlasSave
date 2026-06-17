use std::fs::{self, File};
use std::io;
use std::path::{Path, PathBuf};
use std::time::Duration;
use walkdir::WalkDir;
use zip::write::SimpleFileOptions;

pub struct Archiver {
    pub backups_root: PathBuf,
}

impl Archiver {
    pub fn new(backups_root: PathBuf) -> Self {
        Archiver { backups_root }
    }

    pub fn archive_profile(
        &self,
        profile_id: &str,
        name: &str,
        source_path: &Path,
        max_backups: u32,
    ) -> Result<PathBuf, String> {
        if !source_path.exists() {
            return Err(format!(
                "Source directory does not exist: {:?}",
                source_path
            ));
        }

        let profile_backup_dir = self.backups_root.join(profile_id);
        fs::create_dir_all(&profile_backup_dir).map_err(|e| e.to_string())?;

        let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S").to_string();
        // Sanitize name for Windows file naming conventions
        let safe_name: String = name
            .chars()
            .filter(|c| c.is_alphanumeric() || *c == ' ' || *c == '_' || *c == '-')
            .collect::<String>()
            .trim()
            .replace(' ', "_");
        let zip_filename = format!("{}_{}.zip", safe_name, timestamp);
        let zip_path = profile_backup_dir.join(&zip_filename);

        let max_retries = 5;
        let mut backoff = Duration::from_secs(1);
        let mut success = false;
        let mut last_err = String::new();

        for attempt in 1..=max_retries {
            match self.zip_directory(source_path, &zip_path) {
                Ok(_) => {
                    success = true;
                    break;
                }
                Err(e) => {
                    last_err = e.to_string();
                    eprintln!(
                        "Zip attempt {}/{} failed for {}: {}. Retrying in {:?}...",
                        attempt, max_retries, name, e, backoff
                    );
                    if zip_path.exists() {
                        let _ = fs::remove_file(&zip_path);
                    }
                    std::thread::sleep(backoff);
                    backoff *= 2;
                }
            }
        }

        if !success {
            return Err(format!(
                "Failed to archive profile {} after {} attempts: {}",
                name, max_retries, last_err
            ));
        }

        println!("Archiver: Created local backup archive {:?}", zip_filename);

        // Prune old backups
        self.prune_backups(&profile_backup_dir, max_backups);

        Ok(zip_path)
    }

    fn zip_directory(&self, src: &Path, dst: &Path) -> Result<(), io::Error> {
        let file = File::create(dst)?;
        let mut zip = zip::ZipWriter::new(file);
        let options =
            SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

        for entry in WalkDir::new(src) {
            let entry = entry.map_err(io::Error::other)?;
            let path = entry.path();
            let name = path.strip_prefix(src).map_err(io::Error::other)?;

            if path.is_file() {
                let name_str = name.to_string_lossy().replace('\\', "/");
                zip.start_file(name_str, options)?;
                let mut f = File::open(path)?;
                io::copy(&mut f, &mut zip)?;
            } else if !name.as_os_str().is_empty() {
                let name_str = name.to_string_lossy().replace('\\', "/");
                zip.add_directory(name_str, options)?;
            }
        }

        zip.finish()?;
        Ok(())
    }

    pub fn prune_backups(&self, dir: &Path, max_backups: u32) {
        if let Ok(entries) = fs::read_dir(dir) {
            let mut zip_files = Vec::new();
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() && path.extension().is_some_and(|ext| ext == "zip") {
                    if let Ok(metadata) = entry.metadata() {
                        if let Ok(mtime) = metadata.modified() {
                            zip_files.push((path, mtime));
                        }
                    }
                }
            }

            // Sort by modification time (oldest first)
            zip_files.sort_by_key(|k| k.1);

            if zip_files.len() > max_backups as usize {
                let prune_count = zip_files.len() - max_backups as usize;
                println!(
                    "Archiver: Pruning {} old backup(s) in {:?}",
                    prune_count, dir
                );
                for file_info in zip_files.iter().take(prune_count) {
                    let _ = fs::remove_file(&file_info.0);
                }
            }
        }
    }
}
