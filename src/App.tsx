import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import './App.css';

// Import types
import { Config, Profile } from './types';

// Import components & views
import {
  ShieldIcon,
  DashboardIcon,
  GamepadIcon,
  CloudIcon,
  SettingsIcon,
} from './components/Icons';
import { DashboardView } from './components/Dashboard';
import { GameProfilesView } from './components/GameProfiles';
import { ProvidersView } from './components/Providers';
import { SettingsPanel } from './components/Settings';
import { OnboardingView } from './components/Onboarding';
import { SaveTreeView } from './components/SaveTree';

const DEFAULT_CONFIG: Config = {
  global: { run_on_startup: false, max_backups: 10, debounce_seconds: 5, steamgriddb_api_key: '' },
  stats: { total_backups: 0, last_backup_time: 'Never', total_size_mb: 0.0 },
  profiles: [],
  providers: {
    local_backup: { enabled: false, destination_path: '' },
    git: {
      enabled: false,
      repo_url: '',
      branch: 'main',
      sync_interval_mins: 15,
      auto_fetch: true,
      user_name: '',
      user_email: '',
      ssh_key_path: '',
      accept_new_hosts: true,
    },
  },
};

function App() {
  const [activeView, setActiveView] = useState<
    'onboarding' | 'dashboard' | 'profiles' | 'providers' | 'save_tree' | 'settings'
  >('dashboard');
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [monitoringActive, setMonitoringActive] = useState<boolean>(true);
  const [logs, setLogs] = useState<string[]>([]);

  // Onboarding Step State
  const [onboardingStep, setOnboardingStep] = useState<
    'welcome' | 'providers' | 'settings' | 'ready'
  >('welcome');

  // Forms states
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfilePath, setNewProfilePath] = useState('');
  const [gameExePath, setGameExePath] = useState('');
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Auto-detect UI Feedback
  const [detectionMessage, setDetectionMessage] = useState<{
    text: string;
    isError: boolean;
  } | null>(null);
  const [detecting, setDetecting] = useState(false);

  // Provider forms
  const [gitEnabled, setGitEnabled] = useState(false);
  const [gitUrl, setGitUrl] = useState('');
  const [gitBranch, setGitBranch] = useState('main');
  const [gitTestStatus, setGitTestStatus] = useState<string | null>(null);
  const [gitTesting, setGitTesting] = useState(false);
  const [gitSyncInterval, setGitSyncInterval] = useState(15);
  const [gitAutoFetch, setGitAutoFetch] = useState(true);
  const [gitUserName, setGitUserName] = useState('');
  const [gitUserEmail, setGitUserEmail] = useState('');
  const [gitSshKeyPath, setGitSshKeyPath] = useState('');
  const [gitAcceptNewHosts, setAcceptNewHosts] = useState(true);
  const [gitSyncing, setGitSyncing] = useState(false);
  const [backingUp, setBackingUp] = useState(false);

  // Contextual redirect state for Save Playthrough Controller
  const [saveTreeInitialProfileId, setSaveTreeInitialProfileId] = useState<string | null>(null);
  const [saveTreeInitialOpenCreate, setSaveTreeInitialOpenCreate] = useState<boolean>(false);

  const handleNavigateToSaveTree = (profileId: string, openCreate: boolean = false) => {
    setSaveTreeInitialProfileId(profileId);
    setSaveTreeInitialOpenCreate(openCreate);
    setActiveView('save_tree');
  };

  const [localEnabled, setLocalEnabled] = useState(false);
  const [localPath, setLocalPath] = useState('');

  const [onboardMaxBackups, setOnboardMaxBackups] = useState(10);
  const [onboardDebounce, setOnboardDebounce] = useState(5);
  const [onboardStartup, setOnboardStartup] = useState(false);

  const appendLocalLog = (msg: string) => {
    const now = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev.slice(-150), `[${now}] ${msg}`]);
  };

  const checkWatcherState = async () => {
    try {
      const active: boolean = await invoke('is_monitoring_active');
      setMonitoringActive(active);
    } catch (err) {
      appendLocalLog(`[ERROR] Failed to read monitoring state: ${err}`);
    }
  };

  const loadConfig = async () => {
    try {
      const data: Config = await invoke('get_config');
      setConfig(data);

      // Mirror state for inputs
      setGitEnabled(data.providers.git.enabled);
      setGitUrl(data.providers.git.repo_url);
      setGitBranch(data.providers.git.branch);
      setGitSyncInterval(data.providers.git.sync_interval_mins ?? 15);
      setGitAutoFetch(data.providers.git.auto_fetch ?? true);
      setGitUserName(data.providers.git.user_name ?? '');
      setGitUserEmail(data.providers.git.user_email ?? '');
      setGitSshKeyPath(data.providers.git.ssh_key_path ?? '');
      setAcceptNewHosts(data.providers.git.accept_new_hosts ?? true);

      setLocalEnabled(data.providers.local_backup.enabled);
      setLocalPath(data.providers.local_backup.destination_path);

      setOnboardMaxBackups(data.global.max_backups);
      setOnboardDebounce(data.global.debounce_seconds);
      setOnboardStartup(data.global.run_on_startup);

      // Routing checks (Onboarding if fresh install)
      if (
        data.profiles.length === 0 &&
        !data.providers.local_backup.enabled &&
        !data.providers.git.enabled
      ) {
        setActiveView('onboarding');
        setOnboardingStep('welcome');
      } else if (activeView === 'onboarding') {
        setActiveView('dashboard');
      }
    } catch (err) {
      appendLocalLog(`[ERROR] Failed to load configuration: ${err}`);
    }
  };

  // Load configuration on mount

  // Load configuration on mount
  useEffect(() => {
    // Load and apply saved theme
    const savedTheme = localStorage.getItem('atlas_theme') || 'stitch';
    document.documentElement.className = savedTheme === 'stitch' ? '' : `theme-${savedTheme}`;

    loadConfig();
    checkWatcherState();

    // Load log history
    invoke<string[]>('get_log_history')
      .then((history) => {
        setLogs(history);
        appendLocalLog('AtlasSave UI window loaded. Initializing event listeners...');
      })
      .catch((err) => {
        appendLocalLog(`[ERROR] Failed to load log history: ${err}`);
      });

    // Event listeners for logs streamed from Rust
    const unlistenLog = listen<string>('log-event', (event) => {
      setLogs((prev) => [...prev.slice(-150), event.payload]);
    });

    const unlistenUploader = listen<string>('uploader-log', (event) => {
      const formatted = `[UPLOADER] ${event.payload}`;
      setLogs((prev) => [...prev.slice(-150), formatted]);
    });

    const unlistenStats = listen('stats-updated', () => {
      loadConfig();
    });

    const unlistenBackups = listen('backups-updated', () => {
      window.dispatchEvent(new CustomEvent('refresh-backups'));
    });

    const unlistenGitSyncStatus = listen<string>('git-sync-status', (event) => {
      setGitSyncing(event.payload === 'running');
    });

    const unlistenBackupStatus = listen<string>('backup-status', (event) => {
      setBackingUp(event.payload === 'running');
    });

    return () => {
      unlistenLog.then((f) => f());
      unlistenUploader.then((f) => f());
      unlistenStats.then((f) => f());
      unlistenBackups.then((f) => f());
      unlistenGitSyncStatus.then((f) => f());
      unlistenBackupStatus.then((f) => f());
    };
  }, []);

  const handleClearLogs = async () => {
    try {
      await invoke('clear_log_history');
      setLogs([]);
      appendLocalLog('Log history cleared on disk and console.');
    } catch (err) {
      appendLocalLog(`[ERROR] Failed to clear log history: ${err}`);
    }
  };

  const handleToggleMonitoring = async () => {
    try {
      const res: boolean = await invoke('toggle_monitoring');
      setMonitoringActive(res);
    } catch (err) {
      appendLocalLog(`[ERROR] Toggle monitoring command failed: ${err}`);
    }
  };

  const handleManualBackup = async () => {
    const confirm = window.confirm(
      'Are you sure you want to back up all enabled game profiles now? This will compress and archive active saves.'
    );
    if (!confirm) return;

    try {
      await invoke('manual_backup_all');
      appendLocalLog('[SUCCESS] Manual backup dispatch triggered successfully.');
    } catch (err) {
      appendLocalLog(`[ERROR] Manual backup command failed: ${err}`);
    }
  };

  // Directory picking helpers
  const handleBrowseDir = async (setter: (val: string) => void) => {
    try {
      const selected: string | null = await invoke('select_directory');
      if (selected) {
        setter(selected);
      }
    } catch (err) {
      appendLocalLog(`[ERROR] Folder picker dialog error: ${err}`);
    }
  };

  const handleBrowseFileAndDetect = async () => {
    setDetecting(true);
    setDetectionMessage(null);
    try {
      const selected: string | null = await invoke('select_file');
      if (selected) {
        setGameExePath(selected);
        appendLocalLog(`Scanning game executable for saves: ${selected}`);

        // Auto-extract game name from the chosen executable file path
        const gameName = extractGameNameFromPath(selected);
        setNewProfileName(gameName);

        const detected: string | null = await invoke('detect_save_path', {
          executablePath: selected,
        });
        if (detected) {
          setNewProfilePath(detected);
          setDetectionMessage({
            text: `Success! Auto-detected save directory: ${detected}`,
            isError: false,
          });
          appendLocalLog(`[SUCCESS] Auto-detected save directory: ${detected}`);
        } else {
          setDetectionMessage({
            text: 'Auto-detection unsuccessful. Please select the folder path manually.',
            isError: true,
          });
          appendLocalLog('[WARNING] Auto-detection unsuccessful for scanned executable.');
        }
      }
    } catch (err) {
      setDetectionMessage({ text: `Error scanning executable: ${err}`, isError: true });
      appendLocalLog(`[ERROR] File picker dialog error: ${err}`);
    } finally {
      setDetecting(false);
    }
  };

  // CRUD Profiles
  const handleAddProfile = async (
    name: string,
    path: string,
    coverUrl: string | null,
    exePath: string | null = null
  ) => {
    if (!name.trim() || !path.trim()) return;

    try {
      await invoke('add_profile', {
        name: name.trim(),
        sourcePath: path.trim(),
        coverUrl,
        exePath,
      });
      setNewProfileName('');
      setNewProfilePath('');
      setGameExePath('');
      setDetectionMessage(null);
      loadConfig();
    } catch (err) {
      appendLocalLog(`[ERROR] Failed to add profile: ${err}`);
    }
  };

  const handleSaveProfileEdit = async (
    id: string,
    name: string,
    path: string,
    enabled: boolean,
    coverUrl?: string | null,
    exePath?: string | null
  ) => {
    try {
      await invoke('update_profile', { id, name, sourcePath: path, enabled, coverUrl, exePath });
      setEditingProfileId(null);
      loadConfig();
    } catch (err) {
      appendLocalLog(`[ERROR] Failed to update profile: ${err}`);
    }
  };

  const handleRemoveProfile = async (id: string) => {
    try {
      await invoke('remove_profile', { id });
      setConfirmDeleteId(null);
      loadConfig();
    } catch (err) {
      appendLocalLog(`[ERROR] Failed to remove profile: ${err}`);
    }
  };

  const handleToggleProfileEnabled = async (profile: Profile) => {
    try {
      await invoke('update_profile', {
        id: profile.id,
        name: profile.name,
        sourcePath: profile.source_path,
        enabled: !profile.enabled,
        coverUrl: profile.cover_url,
        exePath: profile.exe_path,
      });
      loadConfig();
    } catch (err) {
      appendLocalLog(`[ERROR] Failed to toggle profile: ${err}`);
    }
  };

  // Onboarding Wizard - Complete & Finalize
  const handleCompleteOnboarding = async () => {
    try {
      // 1. Prepare and save config
      const updated = {
        ...config,
        global: {
          run_on_startup: onboardStartup,
          max_backups: onboardMaxBackups,
          debounce_seconds: onboardDebounce,
          steamgriddb_api_key: config.global.steamgriddb_api_key || '',
        },
        providers: {
          local_backup: {
            enabled: localEnabled,
            destination_path: localPath,
          },
          git: {
            enabled: gitEnabled,
            repo_url: gitUrl,
            branch: gitBranch,
            sync_interval_mins: gitSyncInterval,
            auto_fetch: gitAutoFetch,
            user_name: gitUserName,
            user_email: gitUserEmail,
            ssh_key_path: gitSshKeyPath,
            accept_new_hosts: gitAcceptNewHosts,
          },
        },
      };
      await invoke('save_config', { newConfig: updated });

      // 2. Add the first profile if specified
      if (newProfileName.trim() && newProfilePath.trim()) {
        await invoke('add_profile', {
          name: newProfileName.trim(),
          sourcePath: newProfilePath.trim(),
        });
      }

      // 3. Reset form variables
      setNewProfileName('');
      setNewProfilePath('');
      setGameExePath('');
      setDetectionMessage(null);

      // 4. Reload config & route to dashboard
      appendLocalLog('[SUCCESS] AtlasSave onboarding complete. Opening dashboard.');
      await loadConfig();
      setActiveView('dashboard');
    } catch (err) {
      appendLocalLog(`[ERROR] Onboarding finalization failed: ${err}`);
    }
  };

  // Git Save and Test
  const handleSaveGit = async () => {
    try {
      const updated = { ...config };
      updated.providers.git.enabled = gitEnabled;
      updated.providers.git.repo_url = gitUrl;
      updated.providers.git.branch = gitBranch;
      updated.providers.git.sync_interval_mins = gitSyncInterval;
      updated.providers.git.auto_fetch = gitAutoFetch;
      updated.providers.git.user_name = gitUserName;
      updated.providers.git.user_email = gitUserEmail;
      updated.providers.git.ssh_key_path = gitSshKeyPath;
      updated.providers.git.accept_new_hosts = gitAcceptNewHosts;

      await invoke('save_config', { newConfig: updated });
      loadConfig();
    } catch (err) {
      appendLocalLog(`[ERROR] Saving Git settings failed: ${err}`);
    }
  };

  const handleTriggerGitSync = async () => {
    appendLocalLog('Initiating manual Git cloud sync (Pull + Push)...');
    try {
      await invoke('trigger_git_sync');
    } catch (err) {
      appendLocalLog(`[ERROR] Git sync failed to start: ${err}`);
    }
  };

  const handleTestGit = async () => {
    if (!gitUrl.trim()) {
      setGitTestStatus('Error: Repository URL is required.');
      return;
    }
    setGitTesting(true);
    setGitTestStatus('Testing connection...');
    try {
      const res: string = await invoke('test_git_connection', { repoUrl: gitUrl });
      setGitTestStatus(res);
      appendLocalLog(`[SUCCESS] Git test connection result: ${res}`);
    } catch (err) {
      setGitTestStatus(`Connection failed: ${err}`);
      appendLocalLog(`[ERROR] Git connection failed: ${err}`);
    } finally {
      setGitTesting(false);
    }
  };

  // Local Sync Save
  const handleSaveLocal = async () => {
    try {
      const updated = { ...config };
      updated.providers.local_backup.enabled = localEnabled;
      updated.providers.local_backup.destination_path = localPath;

      await invoke('save_config', { newConfig: updated });
      loadConfig();
    } catch (err) {
      appendLocalLog(`[ERROR] Saving Local destination path failed: ${err}`);
    }
  };

  // General Settings Save
  const handleSaveGeneralSettings = async (
    maxBackups: number,
    debounce: number,
    startup: boolean,
    steamgriddbApiKey: string
  ) => {
    try {
      const updated = { ...config };
      updated.global.max_backups = maxBackups;
      updated.global.debounce_seconds = debounce;
      updated.global.run_on_startup = startup;
      updated.global.steamgriddb_api_key = steamgriddbApiKey;

      await invoke('save_config', { newConfig: updated });
      loadConfig();
    } catch (err) {
      appendLocalLog(`[ERROR] Saving general settings failed: ${err}`);
    }
  };

  // Render Onboarding Stepper
  if (activeView === 'onboarding') {
    return (
      <OnboardingView
        onboardingStep={onboardingStep}
        setOnboardingStep={setOnboardingStep}
        gitEnabled={gitEnabled}
        setGitEnabled={setGitEnabled}
        gitUrl={gitUrl}
        setGitUrl={setGitUrl}
        gitBranch={gitBranch}
        setGitBranch={setGitBranch}
        gitTestStatus={gitTestStatus}
        gitTesting={gitTesting}
        handleTestGit={handleTestGit}
        localEnabled={localEnabled}
        setLocalEnabled={setLocalEnabled}
        localPath={localPath}
        setLocalPath={setLocalPath}
        handleBrowseDir={handleBrowseDir}
        onboardMaxBackups={onboardMaxBackups}
        setOnboardMaxBackups={setOnboardMaxBackups}
        onboardDebounce={onboardDebounce}
        setOnboardDebounce={setOnboardDebounce}
        onboardStartup={onboardStartup}
        setOnboardStartup={setOnboardStartup}
        handleCompleteOnboarding={handleCompleteOnboarding}
      />
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* 1. Left Sidebar Navigation */}
      <aside className="w-[240px] bg-[#040808]/85 backdrop-blur-[10px] border-r border-tech-border flex flex-col p-0 shrink-0 z-10">
        {/* Sidebar Header & Logo */}
        <div className="flex flex-col gap-1.5 py-6 px-6 border-b border-tech-border/25 bg-[#010303]/40">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <ShieldIcon
                className={`w-[22px] h-[22px] transition-all duration-300 ${monitoringActive ? 'text-green drop-shadow-[0_0_8px_var(--color-green)]' : 'text-cyan drop-shadow-[0_0_6px_var(--color-cyan)]'}`}
              />
              {monitoringActive && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green rounded-full animate-ping opacity-75" />
              )}
            </div>
            <span className="font-sans font-black text-[16px] tracking-[2px] text-white bg-gradient-to-br from-white via-white to-cyan bg-clip-text text-transparent drop-shadow-[0_0_10px_rgba(0,242,254,0.15)]">
              ATLAS SAVE
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`w-1.5 h-1.5 rounded-full ${monitoringActive ? 'bg-green animate-pulse shadow-[0_0_4px_var(--color-green)]' : 'bg-yellow shadow-[0_0_4px_var(--color-yellow)]'}`}
            ></span>
            <span className="font-mono text-[9px] font-bold tracking-[0.5px] text-gray uppercase">
              {monitoringActive ? 'Engine: Active' : 'Engine: Paused'}
            </span>
          </div>
        </div>

        {/* Scrollable Navigation Area */}
        <nav className="flex flex-col gap-2.5 py-6 px-3 grow overflow-y-auto scrollbar">
          <button
            onClick={() => setActiveView('dashboard')}
            className={`group flex items-center w-full border-y border-r border-transparent border-l-2 cursor-pointer outline-none relative rounded-r-lg overflow-hidden transition-all duration-200 py-3 px-4 gap-3.5 text-left font-sans text-[11.5px] tracking-[0.8px] font-semibold
              ${
                activeView === 'dashboard'
                  ? 'bg-gradient-to-r from-cyan/8 to-cyan/[0.01] text-cyan border-l-cyan shadow-[0_0_12px_rgba(0,242,254,0.03)]'
                  : 'bg-transparent text-gray hover:bg-white/[0.03] hover:text-white hover:translate-x-1 border-l-transparent hover:border-l-cyan/30'
              }`}
          >
            <DashboardIcon
              className={`transition-all duration-200 ${activeView === 'dashboard' ? 'text-cyan scale-110 drop-shadow-[0_0_5px_var(--color-cyan)]' : 'text-gray/50 group-hover:text-white group-hover:scale-105'}`}
            />
            DASHBOARD
          </button>

          <button
            onClick={() => setActiveView('profiles')}
            className={`group flex items-center w-full border-y border-r border-transparent border-l-2 cursor-pointer outline-none relative rounded-r-lg overflow-hidden transition-all duration-200 py-3 px-4 gap-3.5 text-left font-sans text-[11.5px] tracking-[0.8px] font-semibold
              ${
                activeView === 'profiles'
                  ? 'bg-gradient-to-r from-cyan/8 to-cyan/[0.01] text-cyan border-l-cyan shadow-[0_0_12px_rgba(0,242,254,0.03)]'
                  : 'bg-transparent text-gray hover:bg-white/[0.03] hover:text-white hover:translate-x-1 border-l-transparent hover:border-l-cyan/30'
              }`}
          >
            <GamepadIcon
              className={`transition-all duration-200 ${activeView === 'profiles' ? 'text-cyan scale-110 drop-shadow-[0_0_5px_var(--color-cyan)]' : 'text-gray/50 group-hover:text-white group-hover:scale-105'}`}
            />
            GAME PROFILES
          </button>

          <button
            onClick={() => setActiveView('providers')}
            className={`group flex items-center w-full border-y border-r border-transparent border-l-2 cursor-pointer outline-none relative rounded-r-lg overflow-hidden transition-all duration-200 py-3 px-4 gap-3.5 text-left font-sans text-[11.5px] tracking-[0.8px] font-semibold
              ${
                activeView === 'providers'
                  ? 'bg-gradient-to-r from-cyan/8 to-cyan/[0.01] text-cyan border-l-cyan shadow-[0_0_12px_rgba(0,242,254,0.03)]'
                  : 'bg-transparent text-gray hover:bg-white/[0.03] hover:text-white hover:translate-x-1 border-l-transparent hover:border-l-cyan/30'
              }`}
          >
            <CloudIcon
              className={`transition-all duration-200 ${activeView === 'providers' ? 'text-cyan scale-110 drop-shadow-[0_0_5px_var(--color-cyan)]' : 'text-gray/50 group-hover:text-white group-hover:scale-105'}`}
            />
            PROVIDERS
          </button>

          <button
            onClick={() => {
              setSaveTreeInitialProfileId(null);
              setSaveTreeInitialOpenCreate(false);
              setActiveView('save_tree');
            }}
            className={`group flex items-center w-full border-y border-r border-transparent border-l-2 cursor-pointer outline-none relative rounded-r-lg overflow-hidden transition-all duration-200 py-3 px-4 gap-3.5 text-left font-sans text-[11.5px] tracking-[0.8px] font-semibold
              ${
                activeView === 'save_tree'
                  ? 'bg-gradient-to-r from-cyan/8 to-cyan/[0.01] text-cyan border-l-cyan shadow-[0_0_12px_rgba(0,242,254,0.03)]'
                  : 'bg-transparent text-gray hover:bg-white/[0.03] hover:text-white hover:translate-x-1 border-l-transparent hover:border-l-cyan/30'
              }`}
          >
            <SaveTreeIcon
              className={`transition-all duration-200 ${activeView === 'save_tree' ? 'text-cyan scale-110 drop-shadow-[0_0_5px_var(--color-cyan)]' : 'text-gray/50 group-hover:text-white group-hover:scale-105'}`}
            />
            VIEW SAVE TREE
          </button>

          <button
            onClick={() => setActiveView('settings')}
            className={`group flex items-center w-full border-y border-r border-transparent border-l-2 cursor-pointer outline-none relative rounded-r-lg overflow-hidden transition-all duration-200 py-3 px-4 gap-3.5 text-left font-sans text-[11.5px] tracking-[0.8px] font-semibold
              ${
                activeView === 'settings'
                  ? 'bg-gradient-to-r from-cyan/8 to-cyan/[0.01] text-cyan border-l-cyan shadow-[0_0_12px_rgba(0,242,254,0.03)]'
                  : 'bg-transparent text-gray hover:bg-white/[0.03] hover:text-white hover:translate-x-1 border-l-transparent hover:border-l-cyan/30'
              }`}
          >
            <SettingsIcon
              className={`transition-all duration-200 ${activeView === 'settings' ? 'text-cyan scale-110 drop-shadow-[0_0_5px_var(--color-cyan)]' : 'text-gray/50 group-hover:text-white group-hover:scale-105'}`}
            />
            SETTINGS
          </button>
        </nav>

        {/* Sidebar Status Footer */}
        <div className="mt-auto border-t border-tech-border/20 bg-[#020505]/45 p-4 flex flex-col gap-3 shrink-0">
          {/* Watcher Engine Control */}
          <div className="flex flex-col gap-1.5 p-2.5 rounded-lg border border-tech-border/15 bg-bg-dark/40 hover:border-cyan/25 transition-all duration-200">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray uppercase tracking-wider font-semibold select-none">
                SAVE WATCHER
              </span>
              <span
                className={`inline-flex items-center gap-1 text-[9.5px] font-bold ${monitoringActive ? 'text-green' : 'text-yellow'} select-none`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${monitoringActive ? 'bg-green animate-pulse shadow-[0_0_5px_var(--color-green)]' : 'bg-yellow'}`}
                ></span>
                {monitoringActive ? 'WATCHING' : 'PAUSED'}
              </span>
            </div>

            <button
              onClick={handleToggleMonitoring}
              className={`w-full py-1.5 px-2 text-[10px] rounded border font-mono tracking-[0.5px] transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5
                ${
                  monitoringActive
                    ? 'border-yellow/25 bg-yellow/5 hover:bg-yellow/10 text-yellow hover:border-yellow'
                    : 'border-green/25 bg-green/5 hover:bg-green/10 text-green font-bold hover:border-green'
                }`}
            >
              {monitoringActive ? 'PAUSE WATCHING' : 'RESUME WATCHING'}
            </button>
          </div>

          {/* Quick Metrics Panel */}
          <div className="flex flex-col gap-1.5 text-[11px] text-gray/90 px-1 font-sans select-none">
            <div className="flex items-center justify-between">
              <span>Game Profiles:</span>
              <span className="font-mono text-[11.5px] text-white font-semibold">
                {config.profiles.filter((p) => p.enabled).length}{' '}
                <span className="text-gray/40">/</span> {config.profiles.length}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Total Backups:</span>
              <span className="font-mono text-[11.5px] text-white font-semibold">
                {config.stats.total_backups}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Disk Storage:</span>
              <span className="font-mono text-[11.5px] text-white font-semibold">
                {config.stats.total_size_mb.toFixed(1)} MB
              </span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-tech-border/10">
              <span>Cloud Sync:</span>
              <span className="font-mono text-[10.5px]">
                {gitEnabled ? (
                  gitSyncing ? (
                    <span className="text-cyan animate-pulse font-bold flex items-center gap-1.5">
                      <span className="w-1 h-1 bg-cyan rounded-full animate-ping"></span>
                      SYNCING...
                    </span>
                  ) : (
                    <span className="text-green font-bold">READY</span>
                  )
                ) : (
                  <span className="text-gray/55">DISABLED</span>
                )}
              </span>
            </div>
            {backingUp && (
              <div className="flex items-center justify-between pt-1 border-t border-tech-border/10 text-[10.5px]">
                <span className="text-cyan font-bold">Backup Task:</span>
                <span className="text-cyan animate-pulse font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-cyan rounded-full animate-bounce"></span>
                  RUNNING
                </span>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* 2. Main Content Routing Panels */}
      <main
        className={`grow flex flex-col py-8 px-10 relative z-5 h-full min-h-0 ${activeView === 'dashboard' ? 'overflow-hidden' : 'overflow-y-auto'}`}
      >
        {activeView === 'dashboard' && (
          <DashboardView
            config={config}
            monitoringActive={monitoringActive}
            logs={logs}
            handleToggleMonitoring={handleToggleMonitoring}
            handleManualBackup={handleManualBackup}
            clearLogs={handleClearLogs}
            gitSyncing={gitSyncing}
            handleTriggerGitSync={handleTriggerGitSync}
            backingUp={backingUp}
            reloadConfig={loadConfig}
            onNavigateToSaveTree={handleNavigateToSaveTree}
          />
        )}

        {activeView === 'profiles' && (
          <GameProfilesView
            config={config}
            newProfileName={newProfileName}
            setNewProfileName={setNewProfileName}
            newProfilePath={newProfilePath}
            setNewProfilePath={setNewProfilePath}
            gameExePath={gameExePath}
            setGameExePath={setGameExePath}
            editingProfileId={editingProfileId}
            setEditingProfileId={setEditingProfileId}
            confirmDeleteId={confirmDeleteId}
            setConfirmDeleteId={setConfirmDeleteId}
            detectionMessage={detectionMessage}
            setDetectionMessage={setDetectionMessage}
            detecting={detecting}
            handleBrowseDir={handleBrowseDir}
            handleBrowseFileAndDetect={handleBrowseFileAndDetect}
            handleAddProfile={handleAddProfile}
            handleSaveProfileEdit={handleSaveProfileEdit}
            handleRemoveProfile={handleRemoveProfile}
            handleToggleProfileEnabled={handleToggleProfileEnabled}
            backingUp={backingUp}
            reloadConfig={loadConfig}
            onNavigateToSaveTree={handleNavigateToSaveTree}
          />
        )}

        {activeView === 'providers' && (
          <ProvidersView
            gitEnabled={gitEnabled}
            setGitEnabled={setGitEnabled}
            gitUrl={gitUrl}
            setGitUrl={setGitUrl}
            gitBranch={gitBranch}
            setGitBranch={setGitBranch}
            gitTestStatus={gitTestStatus}
            gitTesting={gitTesting}
            handleTestGit={handleTestGit}
            handleSaveGit={handleSaveGit}
            reloadConfig={loadConfig}
            gitSyncInterval={gitSyncInterval}
            setGitSyncInterval={setGitSyncInterval}
            gitAutoFetch={gitAutoFetch}
            setGitAutoFetch={setGitAutoFetch}
            gitUserName={gitUserName}
            setGitUserName={setGitUserName}
            gitUserEmail={gitUserEmail}
            setGitUserEmail={setGitUserEmail}
            gitSshKeyPath={gitSshKeyPath}
            setGitSshKeyPath={setGitSshKeyPath}
            gitAcceptNewHosts={gitAcceptNewHosts}
            setAcceptNewHosts={setAcceptNewHosts}
            localEnabled={localEnabled}
            setLocalEnabled={setLocalEnabled}
            localPath={localPath}
            setLocalPath={setLocalPath}
            handleBrowseDir={handleBrowseDir}
            handleSaveLocal={handleSaveLocal}
          />
        )}

        {activeView === 'settings' && (
          <SettingsPanel globalConfig={config.global} onSave={handleSaveGeneralSettings} />
        )}

        {activeView === 'save_tree' && (
          <SaveTreeView
            config={config}
            reloadConfig={loadConfig}
            initialProfileId={saveTreeInitialProfileId}
            initialOpenCreate={saveTreeInitialOpenCreate}
          />
        )}
      </main>
    </div>
  );
}

const extractGameNameFromPath = (path: string): string => {
  const normalized = path.replace(/\\/g, '/');
  const parts = normalized.split('/');
  const cleanParts = parts.filter((p) => p.trim().length > 0);
  if (cleanParts.length === 0) return '';

  const exeFilename = cleanParts[cleanParts.length - 1];
  const exeName = exeFilename.substring(0, exeFilename.lastIndexOf('.')) || exeFilename;

  const genericNames = [
    'game',
    'bin',
    'x64',
    'win64',
    'win32',
    'shipping',
    'launcher',
    'system',
    'client',
  ];
  let folderIndex = cleanParts.length - 2;

  while (folderIndex >= 0) {
    const folderName = cleanParts[folderIndex];
    if (genericNames.includes(folderName.toLowerCase())) {
      folderIndex--;
    } else {
      break;
    }
  }

  if (folderIndex >= 0) {
    return cleanFolderOrExeName(cleanParts[folderIndex]);
  }

  return cleanFolderOrExeName(exeName);
};

const cleanFolderOrExeName = (name: string): string => {
  let clean = name.replace(/[_-]/g, ' ');
  clean = clean.replace(/([a-z])([A-Z])/g, '$1 $2');
  return clean
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
    .trim();
};

const SaveTreeIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    viewBox="0 0 24 24"
    width="16"
    height="16"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 2v20M12 12H6a3 3 0 01-3-3V7a3 3 0 013-3h6m0 8h6a3 3 0 003 3v2a3 3 0 00-3 3h-6"
    />
  </svg>
);

export default App;
