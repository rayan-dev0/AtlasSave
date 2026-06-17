export interface GlobalConfig {
  run_on_startup: boolean;
  max_backups: number;
  debounce_seconds: number;
  steamgriddb_api_key: string;
}

export interface StatsConfig {
  total_backups: number;
  last_backup_time: string;
  total_size_mb: number;
}

export interface SaveProfile {
  id: string;
  name: string;
  created_at: string;
}

export interface Profile {
  id: string;
  name: string;
  source_path: string;
  enabled: boolean;
  cover_url?: string | null;
  exe_path?: string | null;
  save_profiles?: SaveProfile[];
  active_save_profile_id?: string | null;
}

export interface LocalBackupProvider {
  enabled: boolean;
  destination_path: string;
}

export interface GitProvider {
  enabled: boolean;
  repo_url: string;
  branch: string;
  sync_interval_mins: number;
  auto_fetch: boolean;
  user_name: string;
  user_email: string;
  ssh_key_path: string;
  accept_new_hosts: boolean;
}

export interface ProvidersConfig {
  local_backup: LocalBackupProvider;
  git: GitProvider;
}

export interface Config {
  global: GlobalConfig;
  stats: StatsConfig;
  profiles: Profile[];
  providers: ProvidersConfig;
}

export interface BackupInfo {
  filename: string;
  path: string;
  size_bytes: number;
  created_at: string;
}
