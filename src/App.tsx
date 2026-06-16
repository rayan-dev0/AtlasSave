import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "./App.css";

// Import types
import { Config, Profile } from "./types";

// Import components & views
import { ShieldIcon, DashboardIcon, GamepadIcon, CloudIcon, SettingsIcon } from "./components/Icons";
import { DashboardView } from "./components/Dashboard";
import { GameProfilesView } from "./components/GameProfiles";
import { ProvidersView } from "./components/Providers";
import { SettingsPanel } from "./components/Settings";
import { OnboardingView } from "./components/Onboarding";

const DEFAULT_CONFIG: Config = {
  global: { run_on_startup: false, max_backups: 10, debounce_seconds: 5, steamgriddb_api_key: "" },
  stats: { total_backups: 0, last_backup_time: "Never", total_size_mb: 0.0 },
  profiles: [],
  providers: {
    local_backup: { enabled: false, destination_path: "" },
    git: {
      enabled: false,
      repo_url: "",
      branch: "main",
      sync_interval_mins: 15,
      auto_fetch: true,
      user_name: "",
      user_email: "",
      ssh_key_path: "",
      accept_new_hosts: true,
    },
  },
};

function App() {
  const [activeView, setActiveView] = useState<"onboarding" | "dashboard" | "profiles" | "providers" | "settings">("dashboard");
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [monitoringActive, setMonitoringActive] = useState<boolean>(true);
  const [logs, setLogs] = useState<string[]>([]);
  
  // Onboarding Step State
  const [onboardingStep, setOnboardingStep] = useState<"welcome" | "providers" | "settings" | "ready">("welcome");
  
  // Forms states
  const [newProfileName, setNewProfileName] = useState("");
  const [newProfilePath, setNewProfilePath] = useState("");
  const [gameExePath, setGameExePath] = useState("");
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  
  // Auto-detect UI Feedback
  const [detectionMessage, setDetectionMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [detecting, setDetecting] = useState(false);

  // Provider forms
  const [gitEnabled, setGitEnabled] = useState(false);
  const [gitUrl, setGitUrl] = useState("");
  const [gitBranch, setGitBranch] = useState("main");
  const [gitTestStatus, setGitTestStatus] = useState<string | null>(null);
  const [gitTesting, setGitTesting] = useState(false);
  const [gitSyncInterval, setGitSyncInterval] = useState(15);
  const [gitAutoFetch, setGitAutoFetch] = useState(true);
  const [gitUserName, setGitUserName] = useState("");
  const [gitUserEmail, setGitUserEmail] = useState("");
  const [gitSshKeyPath, setGitSshKeyPath] = useState("");
  const [gitAcceptNewHosts, setAcceptNewHosts] = useState(true);
  const [gitSyncing, setGitSyncing] = useState(false);
  
  const [localEnabled, setLocalEnabled] = useState(false);
  const [localPath, setLocalPath] = useState("");

  // Onboarding specific settings (to avoid saving directly to global state until finalized)
  const [onboardMaxBackups, setOnboardMaxBackups] = useState(10);
  const [onboardDebounce, setOnboardDebounce] = useState(5);
  const [onboardStartup, setOnboardStartup] = useState(false);

  // Load configuration on mount
  useEffect(() => {
    loadConfig();
    checkWatcherState();

    // Load log history
    invoke<string[]>("get_log_history")
      .then((history) => {
        setLogs(history);
        appendLocalLog("AtlasSave UI window loaded. Initializing event listeners...");
      })
      .catch((err) => {
        appendLocalLog(`[ERROR] Failed to load log history: ${err}`);
      });

    // Event listeners for logs streamed from Rust
    const unlistenLog = listen<string>("log-event", (event) => {
      setLogs((prev) => [...prev.slice(-150), event.payload]);
    });

    const unlistenUploader = listen<string>("uploader-log", (event) => {
      const formatted = `[UPLOADER] ${event.payload}`;
      setLogs((prev) => [...prev.slice(-150), formatted]);
    });

    const unlistenStats = listen("stats-updated", () => {
      loadConfig();
    });

    const unlistenBackups = listen("backups-updated", () => {
      window.dispatchEvent(new CustomEvent("refresh-backups"));
    });

    return () => {
      unlistenLog.then((f) => f());
      unlistenUploader.then((f) => f());
      unlistenStats.then((f) => f());
      unlistenBackups.then((f) => f());
    };
  }, []);

  const loadConfig = async () => {
    try {
      const data: Config = await invoke("get_config");
      setConfig(data);
      
      // Mirror state for inputs
      setGitEnabled(data.providers.git.enabled);
      setGitUrl(data.providers.git.repo_url);
      setGitBranch(data.providers.git.branch);
      setGitSyncInterval(data.providers.git.sync_interval_mins ?? 15);
      setGitAutoFetch(data.providers.git.auto_fetch ?? true);
      setGitUserName(data.providers.git.user_name ?? "");
      setGitUserEmail(data.providers.git.user_email ?? "");
      setGitSshKeyPath(data.providers.git.ssh_key_path ?? "");
      setAcceptNewHosts(data.providers.git.accept_new_hosts ?? true);
      
      setLocalEnabled(data.providers.local_backup.enabled);
      setLocalPath(data.providers.local_backup.destination_path);

      setOnboardMaxBackups(data.global.max_backups);
      setOnboardDebounce(data.global.debounce_seconds);
      setOnboardStartup(data.global.run_on_startup);

      // Routing checks (Onboarding if fresh install)
      if (data.profiles.length === 0 && !data.providers.local_backup.enabled && !data.providers.git.enabled) {
        setActiveView("onboarding");
        setOnboardingStep("welcome");
      } else if (activeView === "onboarding") {
        setActiveView("dashboard");
      }
    } catch (err) {
      appendLocalLog(`[ERROR] Failed to load configuration: ${err}`);
    }
  };

  const checkWatcherState = async () => {
    try {
      const active: boolean = await invoke("is_monitoring_active");
      setMonitoringActive(active);
    } catch (err) {
      appendLocalLog(`[ERROR] Failed to read monitoring state: ${err}`);
    }
  };

  const appendLocalLog = (msg: string) => {
    const now = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev.slice(-150), `[${now}] ${msg}`]);
  };

  const handleClearLogs = async () => {
    try {
      await invoke("clear_log_history");
      setLogs([]);
      appendLocalLog("Log history cleared on disk and console.");
    } catch (err) {
      appendLocalLog(`[ERROR] Failed to clear log history: ${err}`);
    }
  };

  const handleToggleMonitoring = async () => {
    try {
      const res: boolean = await invoke("toggle_monitoring");
      setMonitoringActive(res);
    } catch (err) {
      appendLocalLog(`[ERROR] Toggle monitoring command failed: ${err}`);
    }
  };

  const handleManualBackup = async () => {
    try {
      await invoke("manual_backup_all");
      appendLocalLog("[SUCCESS] Manual backup dispatch triggered successfully.");
    } catch (err) {
      appendLocalLog(`[ERROR] Manual backup command failed: ${err}`);
    }
  };

  // Directory picking helpers
  const handleBrowseDir = async (setter: (val: string) => void) => {
    try {
      const selected: string | null = await invoke("select_directory");
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
      const selected: string | null = await invoke("select_file");
      if (selected) {
        setGameExePath(selected);
        appendLocalLog(`Scanning game executable for saves: ${selected}`);
        
        // Auto-extract game name from the chosen executable file path
        const gameName = extractGameNameFromPath(selected);
        setNewProfileName(gameName);
        
        const detected: string | null = await invoke("detect_save_path", { executablePath: selected });
        if (detected) {
          setNewProfilePath(detected);
          setDetectionMessage({ text: `Success! Auto-detected save directory: ${detected}`, isError: false });
          appendLocalLog(`[SUCCESS] Auto-detected save directory: ${detected}`);
        } else {
          setDetectionMessage({ text: "Auto-detection unsuccessful. Please select the folder path manually.", isError: true });
          appendLocalLog("[WARNING] Auto-detection unsuccessful for scanned executable.");
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
  const handleAddProfile = async (name: string, path: string, coverUrl: string | null) => {
    if (!name.trim() || !path.trim()) return;

    try {
      await invoke("add_profile", { name: name.trim(), sourcePath: path.trim(), coverUrl });
      setNewProfileName("");
      setNewProfilePath("");
      setGameExePath("");
      setDetectionMessage(null);
      loadConfig();
    } catch (err) {
      appendLocalLog(`[ERROR] Failed to add profile: ${err}`);
    }
  };

  const handleSaveProfileEdit = async (id: string, name: string, path: string, enabled: boolean, coverUrl?: string | null) => {
    try {
      await invoke("update_profile", { id, name, sourcePath: path, enabled, coverUrl });
      setEditingProfileId(null);
      loadConfig();
    } catch (err) {
      appendLocalLog(`[ERROR] Failed to update profile: ${err}`);
    }
  };

  const handleRemoveProfile = async (id: string) => {
    try {
      await invoke("remove_profile", { id });
      setConfirmDeleteId(null);
      loadConfig();
    } catch (err) {
      appendLocalLog(`[ERROR] Failed to remove profile: ${err}`);
    }
  };

  const handleToggleProfileEnabled = async (profile: Profile) => {
    try {
      await invoke("update_profile", {
        id: profile.id,
        name: profile.name,
        sourcePath: profile.source_path,
        enabled: !profile.enabled,
        coverUrl: profile.cover_url,
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
          steamgriddb_api_key: config.global.steamgriddb_api_key || "",
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
      await invoke("save_config", { newConfig: updated });

      // 2. Add the first profile if specified
      if (newProfileName.trim() && newProfilePath.trim()) {
        await invoke("add_profile", { name: newProfileName.trim(), sourcePath: newProfilePath.trim() });
      }

      // 3. Reset form variables
      setNewProfileName("");
      setNewProfilePath("");
      setGameExePath("");
      setDetectionMessage(null);

      // 4. Reload config & route to dashboard
      appendLocalLog("[SUCCESS] AtlasSave onboarding complete. Opening dashboard.");
      await loadConfig();
      setActiveView("dashboard");
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
      
      await invoke("save_config", { newConfig: updated });
      loadConfig();
    } catch (err) {
      appendLocalLog(`[ERROR] Saving Git settings failed: ${err}`);
    }
  };

  const handleTriggerGitSync = async () => {
    setGitSyncing(true);
    appendLocalLog("Initiating manual Git cloud sync (Pull + Push)...");
    try {
      await invoke("trigger_git_sync");
    } catch (err) {
      appendLocalLog(`[ERROR] Git sync failed to start: ${err}`);
    } finally {
      setGitSyncing(false);
    }
  };

  const handleTestGit = async () => {
    if (!gitUrl.trim()) {
      setGitTestStatus("Error: Repository URL is required.");
      return;
    }
    setGitTesting(true);
    setGitTestStatus("Testing connection...");
    try {
      const res: string = await invoke("test_git_connection", { repoUrl: gitUrl });
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

      await invoke("save_config", { newConfig: updated });
      loadConfig();
    } catch (err) {
      appendLocalLog(`[ERROR] Saving Local destination path failed: ${err}`);
    }
  };

  // General Settings Save
  const handleSaveGeneralSettings = async (maxBackups: number, debounce: number, startup: boolean, steamgriddbApiKey: string) => {
    try {
      const updated = { ...config };
      updated.global.max_backups = maxBackups;
      updated.global.debounce_seconds = debounce;
      updated.global.run_on_startup = startup;
      updated.global.steamgriddb_api_key = steamgriddbApiKey;

      await invoke("save_config", { newConfig: updated });
      loadConfig();
    } catch (err) {
      appendLocalLog(`[ERROR] Saving general settings failed: ${err}`);
    }
  };

  // Render Onboarding Stepper
  if (activeView === "onboarding") {
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
    <div className="app-frame">
      {/* 1. Left Sidebar Navigation */}
      <aside className="sidebar">
        <div className="logo-container">
          <ShieldIcon className="logo-icon" />
          <span className="logo-text">ATLAS SAVE</span>
        </div>

        <nav className="nav-list">
          <div className={`nav-item ${activeView === "dashboard" ? "active" : ""}`} onClick={() => setActiveView("dashboard")}>
            <div className="nav-indicator"></div>
            <button className="nav-button">
              <DashboardIcon />
              DASHBOARD
            </button>
          </div>

          <div className={`nav-item ${activeView === "profiles" ? "active" : ""}`} onClick={() => setActiveView("profiles")}>
            <div className="nav-indicator"></div>
            <button className="nav-button">
              <GamepadIcon />
              GAME PROFILES
            </button>
          </div>

          <div className={`nav-item ${activeView === "providers" ? "active" : ""}`} onClick={() => setActiveView("providers")}>
            <div className="nav-indicator"></div>
            <button className="nav-button">
              <CloudIcon />
              PROVIDERS
            </button>
          </div>

          <div className={`nav-item ${activeView === "settings" ? "active" : ""}`} onClick={() => setActiveView("settings")}>
            <div className="nav-indicator"></div>
            <button className="nav-button">
              <SettingsIcon />
              SETTINGS
            </button>
          </div>
        </nav>
      </aside>

      {/* 2. Main Content Routing Panels */}
      <main className="content-area">
        {activeView === "dashboard" && (
          <DashboardView
            config={config}
            monitoringActive={monitoringActive}
            logs={logs}
            handleToggleMonitoring={handleToggleMonitoring}
            handleManualBackup={handleManualBackup}
            clearLogs={handleClearLogs}
            gitSyncing={gitSyncing}
            handleTriggerGitSync={handleTriggerGitSync}
          />
        )}

        {activeView === "profiles" && (
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
          />
        )}

        {activeView === "providers" && (
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

        {activeView === "settings" && (
          <SettingsPanel
            globalConfig={config.global}
            onSave={handleSaveGeneralSettings}
          />
        )}
      </main>
    </div>
  );
}

const extractGameNameFromPath = (path: string): string => {
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/");
  const cleanParts = parts.filter(p => p.trim().length > 0);
  if (cleanParts.length === 0) return "";
  
  const exeFilename = cleanParts[cleanParts.length - 1];
  let exeName = exeFilename.substring(0, exeFilename.lastIndexOf('.')) || exeFilename;
  
  const genericNames = ["game", "bin", "x64", "win64", "win32", "shipping", "launcher", "system", "client"];
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
  let clean = name.replace(/[_-]/g, " ");
  clean = clean.replace(/([a-z])([A-Z])/g, '$1 $2');
  return clean
    .split(" ")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
    .trim();
};

export default App;
