import React, { useState, useEffect, useRef } from "react";
import { Config, BackupInfo } from "../types";
import { invoke } from "@tauri-apps/api/core";

interface DashboardViewProps {
  config: Config;
  monitoringActive: boolean;
  logs: string[];
  handleToggleMonitoring: () => void;
  handleManualBackup: () => void;
  clearLogs: () => void;
  gitSyncing: boolean;
  handleTriggerGitSync: () => void;
}

const parseBackupFilename = (filename: string, profileName: string) => {
  const nameWithoutExt = filename.replace(/\.zip$/i, "");
  
  // Suffix format is _YYYYMMDD_HHMMSS
  const timestampRegex = /_(\d{8})_(\d{6})$/;
  const match = nameWithoutExt.match(timestampRegex);
  
  let labelPrefix = nameWithoutExt;
  if (match) {
    labelPrefix = nameWithoutExt.substring(0, match.index);
  }
  
  // Clean profile name to compare
  const sanitizeForCompare = (str: string) =>
    str
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .trim();

  const cleanLabel = labelPrefix.replace(/_/g, " ").trim();
  const lowerPrefix = labelPrefix.toLowerCase();
  
  let type: "auto" | "checkpoint" | "rollback" = "auto";
  let label = cleanLabel;

  if (lowerPrefix.includes("rollback")) {
    type = "rollback";
    label = "Rollback Branch";
  } else if (lowerPrefix.endsWith("_manual")) {
    type = "checkpoint";
    label = cleanLabel.replace(/\s+manual$/i, "").trim() + " Checkpoint";
  } else if (sanitizeForCompare(labelPrefix) !== sanitizeForCompare(profileName)) {
    type = "checkpoint"; // Renamed files
  } else {
    type = "auto";
    label = "System Auto-Save";
  }

  return { label, type };
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  config,
  monitoringActive,
  logs,
  handleToggleMonitoring,
  handleManualBackup,
  clearLogs,
  gitSyncing,
  handleTriggerGitSync,
}) => {
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    config.profiles.length > 0 ? config.profiles[0].id : null
  );

  const [viewMode, setViewMode] = useState<'list' | 'tree'>('tree');
  const [renamingFile, setRenamingFile] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState<string>("");

  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);
  
  const [confirmRestoreFile, setConfirmRestoreFile] = useState<string | null>(null);
  const [confirmDeleteFile, setConfirmDeleteFile] = useState<string | null>(null);
  
  const [backingUpCurrent, setBackingUpCurrent] = useState(false);

  const [storageStats, setStorageStats] = useState<{
    total_size_bytes: number;
    backup_count: number;
    oldest_backup_time: string;
    newest_backup_time: string;
  } | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [pruning, setPruning] = useState(false);
  const [pruneCount, setPruneCount] = useState(config.global.max_backups);

  useEffect(() => {
    setPruneCount(config.global.max_backups);
  }, [config.global.max_backups]);

  // Sync selected tab if profiles list changes or current selection is removed
  useEffect(() => {
    if (config.profiles.length > 0) {
      if (!selectedProfileId || !config.profiles.some(p => p.id === selectedProfileId)) {
        setSelectedProfileId(config.profiles[0].id);
      }
    } else {
      setSelectedProfileId(null);
    }
  }, [config.profiles, selectedProfileId]);

  const selectedProfile = config.profiles.find(p => p.id === selectedProfileId);

  const loadBackups = async (profileId: string) => {
    setLoadingBackups(true);
    setBackupError(null);
    try {
      const list: BackupInfo[] = await invoke("get_backups", { profileId });
      setBackups(list);
    } catch (err) {
      setBackupError(String(err));
    } finally {
      setLoadingBackups(false);
    }
  };

  const loadStorageStats = async (profileId: string) => {
    setLoadingStats(true);
    try {
      const stats = await invoke("get_profile_storage_stats", { profileId });
      setStorageStats(stats as any);
    } catch (err) {
      console.error("Failed to load storage stats:", err);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    if (selectedProfileId) {
      loadBackups(selectedProfileId);
      loadStorageStats(selectedProfileId);
      setConfirmRestoreFile(null);
      setConfirmDeleteFile(null);
    } else {
      setBackups([]);
      setStorageStats(null);
    }
  }, [selectedProfileId]);

  useEffect(() => {
    const handleRefresh = () => {
      if (selectedProfileId) {
        loadBackups(selectedProfileId);
        loadStorageStats(selectedProfileId);
      }
    };
    window.addEventListener("refresh-backups", handleRefresh);
    return () => {
      window.removeEventListener("refresh-backups", handleRefresh);
    };
  }, [selectedProfileId]);

  const handleBackupProfile = async (profileId: string) => {
    setBackingUpCurrent(true);
    try {
      await invoke("manual_backup_profile", { profileId });
    } catch (err) {
      alert(`Failed to trigger manual backup: ${err}`);
    } finally {
      setBackingUpCurrent(false);
    }
  };

  const handleOpenFolder = async (profileId: string) => {
    try {
      await invoke("open_backup_directory", { profileId });
    } catch (err) {
      alert(`Failed to open backup folder: ${err}`);
    }
  };

  const handleRestore = async (profileId: string, filename: string) => {
    try {
      await invoke("restore_backup", { profileId, filename });
      setConfirmRestoreFile(null);
    } catch (err) {
      alert(`Restore request failed: ${err}`);
    }
  };

  const handleDelete = async (profileId: string, filename: string) => {
    try {
      await invoke("delete_backup", { profileId, filename });
      setConfirmDeleteFile(null);
    } catch (err) {
      alert(`Delete request failed: ${err}`);
    }
  };

  const handleRenameBackup = async (profileId: string, filename: string, label: string) => {
    if (!label.trim()) return;
    try {
      await invoke("rename_backup", { profileId, filename, newLabel: label });
      setRenamingFile(null);
      setNewLabel("");
    } catch (err) {
      alert(`Rename request failed: ${err}`);
    }
  };

  const handlePruneBackups = async (profileId: string) => {
    setPruning(true);
    try {
      await invoke("prune_profile_backups", { profileId, keepCount: pruneCount });
      // The event listener will auto-refresh backups & stats
    } catch (err) {
      alert(`Pruning failed: ${err}`);
    } finally {
      setPruning(false);
    }
  };

  const handleLaunchGame = async (profileId: string, exePath: string) => {
    try {
      await invoke("launch_game", { profileId, exePath });
    } catch (err) {
      alert(`Failed to launch game: ${err}`);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const dm = 2;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  // Auto Scroll Terminal
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Helper to parse log rows and apply tech color codes
  const parseLogLine = (line: string) => {
    let className = "terminal-line";
    if (line.includes("[ERROR]") || line.includes("failed") || line.includes("Error:") || line.includes("Connection failed:")) {
      className += " terminal-line-error";
    } else if (line.includes("[SUCCESS]") || line.includes("complete") || line.includes("Successful") || line.includes("activated") || line.includes("Success!")) {
      className += " terminal-line-success";
    } else if (line.includes("[WARNING]")) {
      className += " terminal-line-warning";
    } else if (line.includes("[UPLOADER]")) {
      className += " terminal-line-uploader";
    } else if (line.includes("[SYSTEM]") || line.includes("Initializing") || line.includes("loaded") || line.includes("starting")) {
      className += " terminal-line-system";
    }
    return <div className={className}>{line}</div>;
  };

  return (
    <>
      <header className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Status Monitor</h1>
          <p className="page-subtitle">Automatic watcher status and diagnostic backups activity logs.</p>
        </div>
 
        <div className="flex-row-gap" style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <div
            className={`switch-container ${monitoringActive ? "active" : ""}`}
            onClick={handleToggleMonitoring}
          >
            <div className="switch-track">
              <div className="switch-thumb"></div>
            </div>
            <span className="form-label" style={{ minWidth: "120px" }}>
              WATCHER: {monitoringActive ? "ACTIVE" : "PAUSED"}
            </span>
          </div>

          {config.providers.git.enabled && (
            <button
              className="btn btn-outline"
              onClick={handleTriggerGitSync}
              disabled={gitSyncing || !config.providers.git.repo_url}
              style={{ height: "34px", padding: "0 14px" }}
            >
              {gitSyncing ? (
                <>
                  <div className="loader-spinner" style={{ width: 12, height: 12 }}></div>
                  SYNCING...
                </>
              ) : (
                <>
                  <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                  SYNC CLOUD NOW
                </>
              )}
            </button>
          )}

          <button className="btn btn-primary" onClick={handleManualBackup}>
            <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            BACKUP ALL NOW
          </button>
        </div>
      </header>

      {/* Statistics Cards */}
      <section className="stats-grid">
        <div className="stat-item">
          <span className="stat-label">TOTAL BACKUPS CAPTURED</span>
          <span className="stat-value">{config.stats.total_backups}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">STORAGE CONSUMED</span>
          <span className="stat-value">{config.stats.total_size_mb.toFixed(2)} MB</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">LAST WRITE CYCLE</span>
          <span className="stat-value" style={{ fontSize: "14px", marginTop: "6px" }}>
            {config.stats.last_backup_time}
          </span>
        </div>
      </section>

      {/* Active Monitoring Overview */}
      <section className="active-profiles-section">
        <h3 className="tech-card-title" style={{ fontSize: "11px", color: "var(--color-gray)", marginBottom: "10px" }}>
          ACTIVE MONITOR CHANNELS ({config.profiles.filter(p => p.enabled).length}/{config.profiles.length})
        </h3>
        {config.profiles.length === 0 ? (
          <div className="tech-card" style={{ padding: "16px", color: "var(--color-gray)" }}>
            No active tracking channels found. Add game profiles to begin scanning.
          </div>
        ) : (
          <div className="dashboard-vertical-tabs-layout">
            {/* Tabs List (Left Column) */}
            <div className="dashboard-tabs-list">
              {config.profiles.map(profile => (
                <div 
                  key={profile.id} 
                  className={`dashboard-tab-item ${selectedProfileId === profile.id ? 'active' : ''}`}
                  onClick={() => setSelectedProfileId(profile.id)}
                >
                  <span className={`status-dot ${profile.enabled && monitoringActive ? 'active' : ''}`}></span>
                  <span className="tab-game-name" title={profile.name}>{profile.name}</span>
                </div>
              ))}
            </div>

            {/* Selected Game Detail Card (Right Column) */}
            <div className="dashboard-detail-panel" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {selectedProfile ? (
                <>
                  {(() => {
                    const cardStyle: React.CSSProperties = selectedProfile.cover_url
                      ? {
                          backgroundImage: `linear-gradient(rgba(22, 31, 32, 0.85), rgba(22, 31, 32, 0.95)), url(${selectedProfile.cover_url})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }
                      : {};
                    return (
                      <div className="game-detail-card" style={{ ...cardStyle, flexGrow: 0, minHeight: "auto" }}>
                        <div className="game-detail-content">
                          <div className="game-detail-header">
                            <h2 className="game-title">{selectedProfile.name}</h2>
                            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                              <span className={`badge ${selectedProfile.enabled && monitoringActive ? "badge-active" : "badge-paused"}`}>
                                {selectedProfile.enabled && monitoringActive ? "Watching" : "Offline"}
                              </span>
                              {selectedProfile.exe_path ? (
                                <button
                                  className="btn btn-primary"
                                  style={{ height: "28px", fontSize: "11px", padding: "0 12px", background: "var(--color-green)", color: "#032021", boxShadow: "0 0 10px rgba(89, 248, 180, 0.3)" }}
                                  onClick={() => handleLaunchGame(selectedProfile.id, selectedProfile.exe_path!)}
                                >
                                  <svg style={{ width: 12, height: 12 }} fill="currentColor" viewBox="0 0 16 16">
                                    <path d="M11.596 8.697l-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/>
                                  </svg>
                                  LAUNCH GAME
                                </button>
                              ) : (
                                <span style={{ fontSize: "10px", color: "var(--color-gray)", opacity: 0.6, fontStyle: "italic" }}>
                                  No Executable Linked
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="game-detail-info-group">
                            <span className="form-label" style={{ fontSize: "9px" }}>WATCH ROUTE</span>
                            <div className="profile-card-path-container">
                              <svg className="profile-card-path-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                              </svg>
                              <span className="profile-card-path" title={selectedProfile.source_path}>{selectedProfile.source_path}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Profile Storage Diagnostics Panel */}
                  <div className="tech-card" style={{ flexGrow: 0, margin: 0, padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                    <span className="tech-card-title" style={{ fontSize: "11px" }}>PROFILE STORAGE DIAGNOSTICS</span>
                    {loadingStats ? (
                      <span style={{ fontSize: "11px", color: "var(--color-gray)" }}>Loading stats...</span>
                    ) : storageStats ? (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <span style={{ fontSize: "10px", color: "var(--color-gray)" }}>ARCHIVES COUNTER</span>
                          <span style={{ fontWeight: "600", fontSize: "12px", color: "var(--color-white)" }}>{storageStats.backup_count} files</span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <span style={{ fontSize: "10px", color: "var(--color-gray)" }}>TOTAL SIZE ON DISK</span>
                          <span style={{ fontWeight: "600", fontSize: "12px", color: "var(--color-cyan)" }}>{formatBytes(storageStats.total_size_bytes)}</span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px", overflow: "hidden" }}>
                          <span style={{ fontSize: "10px", color: "var(--color-gray)" }}>OLDEST BACKUP</span>
                          <span style={{ fontWeight: "600", fontSize: "11px", color: "var(--color-white)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={storageStats.oldest_backup_time}>{storageStats.oldest_backup_time}</span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px", overflow: "hidden" }}>
                          <span style={{ fontSize: "10px", color: "var(--color-gray)" }}>LATEST BACKUP</span>
                          <span style={{ fontWeight: "600", fontSize: "11px", color: "var(--color-white)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={storageStats.newest_backup_time}>{storageStats.newest_backup_time}</span>
                        </div>
                      </div>
                    ) : (
                      <span style={{ fontSize: "11px", color: "var(--color-gray)", fontStyle: "italic" }}>No diagnostics available.</span>
                    )}
                  </div>

                  {/* Save Archives & Backups Management list */}
                  <div className="tech-card" style={{ flexGrow: 1, margin: 0, padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                    <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(70, 94, 96, 0.2)", paddingBottom: "10px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                        <span className="tech-card-title">SAVE FILE ARCHIVES</span>
                        <div style={{ display: "flex", background: "var(--bg-color-inner)", border: "1px solid var(--border-color-tech)", borderRadius: "4px", padding: "2px" }}>
                          <button
                            className="btn"
                            style={{
                              height: "22px",
                              fontSize: "9px",
                              padding: "0 8px",
                              border: "none",
                              background: viewMode === "tree" ? "var(--color-cyan)" : "transparent",
                              color: viewMode === "tree" ? "#032021" : "var(--color-gray)",
                              cursor: "pointer"
                            }}
                            onClick={() => { setViewMode("tree"); setRenamingFile(null); }}
                          >
                            TIMELINE TREE
                          </button>
                          <button
                            className="btn"
                            style={{
                              height: "22px",
                              fontSize: "9px",
                              padding: "0 8px",
                              border: "none",
                              background: viewMode === "list" ? "var(--color-cyan)" : "transparent",
                              color: viewMode === "list" ? "#032021" : "var(--color-gray)",
                              cursor: "pointer"
                            }}
                            onClick={() => { setViewMode("list"); setRenamingFile(null); }}
                          >
                            LIST VIEW
                          </button>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "10px" }}>
                        <button 
                          className="btn btn-outline" 
                          style={{ height: "28px", fontSize: "10px", padding: "0 12px" }}
                          onClick={() => handleOpenFolder(selectedProfile.id)}
                        >
                          <svg style={{ width: 12, height: 12 }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                          </svg>
                          OPEN FOLDER
                        </button>
                        <button 
                          className="btn btn-primary" 
                          style={{ height: "28px", fontSize: "10px", padding: "0 12px" }}
                          onClick={() => handleBackupProfile(selectedProfile.id)}
                          disabled={backingUpCurrent}
                        >
                          {backingUpCurrent ? (
                            <>
                              <div className="loader-spinner" style={{ width: 10, height: 10 }}></div>
                              BACKING UP...
                            </>
                          ) : (
                            <>
                              <svg style={{ width: 12, height: 12 }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                              </svg>
                              BACKUP NOW
                            </>
                          )}
                        </button>
                      </div>
                    </header>

                    {loadingBackups ? (
                      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "120px", color: "var(--color-gray)" }}>
                        <div className="loader-spinner" style={{ marginRight: "10px" }}></div>
                        Reading backup archives...
                      </div>
                    ) : backupError ? (
                      <div className="detection-banner detection-banner-error" style={{ margin: 0 }}>
                        Failed to read backups: {backupError}
                      </div>
                    ) : backups.length === 0 ? (
                      <div style={{ padding: "40px 10px", textAlign: "center", color: "var(--color-gray)", fontSize: "11.5px", fontFamily: "var(--font-mono)", opacity: 0.6 }}>
                        No local save archives captured yet for this profile.
                      </div>
                    ) : viewMode === "tree" ? (
                      <div style={{ maxHeight: "380px", overflowY: "auto", display: "flex", flexDirection: "column", paddingRight: "4px" }} className="timeline-tree-container">
                        {backups.map((backup, index) => {
                          const { label, type } = parseBackupFilename(backup.filename, selectedProfile.name);
                          const isFirst = index === 0;
                          const isLast = index === backups.length - 1;

                          const mainX = 30;
                          const nodeY = 32;
                          const branchX = 55;

                          return (
                            <div key={backup.filename} className="timeline-row" style={{ display: "flex", position: "relative", minHeight: "68px" }}>
                              {/* SVG Column */}
                              <div style={{ width: "80px", position: "relative", flexShrink: 0 }}>
                                <svg width="80" height="100%" style={{ position: "absolute", top: 0, left: 0, overflow: "visible" }}>
                                  {/* Main timeline track line */}
                                  <line
                                    x1={mainX}
                                    y1={isFirst ? nodeY : 0}
                                    x2={mainX}
                                    y2={isLast ? nodeY : "100%"}
                                    stroke="rgba(70, 94, 96, 0.3)"
                                    strokeWidth="2"
                                  />

                                  {/* Branch curve for rollback */}
                                  {type === "rollback" && (
                                    <path
                                      d={`M ${mainX} ${isFirst ? nodeY : 12} Q ${mainX} ${nodeY} ${branchX} ${nodeY}`}
                                      fill="none"
                                      stroke="var(--color-crimson)"
                                      strokeWidth="2"
                                      strokeDasharray="4 2"
                                    />
                                  )}

                                  {/* Node Icon */}
                                  {type === "auto" && (
                                    <circle
                                      cx={mainX}
                                      cy={nodeY}
                                      r="6"
                                      fill="#030606"
                                      stroke="var(--color-cyan)"
                                      strokeWidth="3"
                                      style={{ filter: "drop-shadow(0 0 4px var(--color-cyan))" }}
                                    />
                                  )}
                                  {type === "checkpoint" && (
                                    <polygon
                                      points={`${mainX},${nodeY - 7} ${mainX + 7},${nodeY} ${mainX},${nodeY + 7} ${mainX - 7},${nodeY}`}
                                      fill="#030606"
                                      stroke="var(--color-green)"
                                      strokeWidth="3"
                                      style={{ filter: "drop-shadow(0 0 4px var(--color-green))" }}
                                    />
                                  )}
                                  {type === "rollback" && (
                                    <circle
                                      cx={branchX}
                                      cy={nodeY}
                                      r="6"
                                      fill="#030606"
                                      stroke="var(--color-crimson)"
                                      strokeWidth="3"
                                      style={{ filter: "drop-shadow(0 0 4px var(--color-crimson))" }}
                                    />
                                  )}
                                </svg>
                              </div>

                              {/* Node Info Card Column */}
                              <div style={{
                                flexGrow: 1,
                                display: "flex",
                                alignItems: "center",
                                paddingLeft: type === "rollback" ? "10px" : "0px",
                                paddingBottom: "10px"
                              }}>
                                <div 
                                  className={`timeline-card timeline-card-${type} ${confirmRestoreFile === backup.filename ? 'confirm-restore' : ''} ${confirmDeleteFile === backup.filename ? 'confirm-delete' : ''}`}
                                  style={{
                                    width: "100%",
                                    background: "var(--bg-color-inner)",
                                    border: `1px solid ${type === "checkpoint" ? "rgba(89, 248, 180, 0.3)" : type === "rollback" ? "rgba(255, 107, 107, 0.3)" : "var(--border-color-tech)"}`,
                                    borderRadius: "var(--radius-inner)",
                                    padding: "10px 14px",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    gap: "12px",
                                    boxShadow: type === "checkpoint" ? "0 0 8px rgba(89, 248, 180, 0.05)" : type === "rollback" ? "0 0 8px rgba(255, 107, 107, 0.05)" : "none"
                                  }}
                                >
                                  <div style={{ display: "flex", flexDirection: "column", gap: "2px", overflow: "hidden", flexGrow: 1 }}>
                                    {renamingFile === backup.filename ? (
                                      <div style={{ display: "flex", gap: "8px", alignItems: "center", width: "100%" }}>
                                        <input
                                          type="text"
                                          className="form-input"
                                          value={newLabel}
                                          onChange={(e) => setNewLabel(e.target.value)}
                                          style={{ height: "26px", fontSize: "11px", padding: "0 8px", minHeight: "auto", flexGrow: 1 }}
                                          autoFocus
                                          placeholder="New Label"
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                              handleRenameBackup(selectedProfile.id, backup.filename, newLabel);
                                            } else if (e.key === "Escape") {
                                              setRenamingFile(null);
                                            }
                                          }}
                                        />
                                        <button
                                          className="btn btn-primary"
                                          style={{ height: "26px", fontSize: "10px", padding: "0 10px", background: "var(--color-green)", color: "#032021" }}
                                          onClick={() => handleRenameBackup(selectedProfile.id, backup.filename, newLabel)}
                                        >
                                          SAVE
                                        </button>
                                        <button
                                          className="btn btn-outline"
                                          style={{ height: "26px", fontSize: "10px", padding: "0 10px" }}
                                          onClick={() => setRenamingFile(null)}
                                        >
                                          CANCEL
                                        </button>
                                      </div>
                                    ) : (
                                      <>
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                          <span 
                                            style={{
                                              fontSize: "11.5px",
                                              fontWeight: "600",
                                              color: type === "checkpoint" ? "var(--color-green)" : type === "rollback" ? "var(--color-crimson)" : "var(--color-white)",
                                              whiteSpace: "nowrap",
                                              overflow: "hidden",
                                              textOverflow: "ellipsis"
                                            }}
                                            title={backup.filename}
                                          >
                                            {label}
                                          </span>
                                          {type === "checkpoint" && (
                                            <span style={{ fontSize: "8px", background: "rgba(89, 248, 180, 0.1)", color: "var(--color-green)", border: "1px solid rgba(89, 248, 180, 0.2)", borderRadius: "3px", padding: "1px 4px", fontWeight: "bold" }}>
                                              CHECKPOINT
                                            </span>
                                          )}
                                          {type === "rollback" && (
                                            <span style={{ fontSize: "8px", background: "rgba(255, 107, 107, 0.1)", color: "var(--color-crimson)", border: "1px solid rgba(255, 107, 107, 0.2)", borderRadius: "3px", padding: "1px 4px", fontWeight: "bold" }}>
                                              ROLLBACK
                                            </span>
                                          )}
                                        </div>
                                        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                                          <span style={{ fontSize: "9.5px", color: "var(--color-gray)", fontFamily: "var(--font-mono)" }}>
                                            {backup.created_at}
                                          </span>
                                          <span style={{ fontSize: "9.5px", color: "rgba(70, 94, 96, 0.3)", fontFamily: "var(--font-mono)" }}>|</span>
                                          <span style={{ fontSize: "9.5px", color: "var(--color-cyan)", fontFamily: "var(--font-mono)" }}>
                                            {formatBytes(backup.size_bytes)}
                                          </span>
                                        </div>
                                      </>
                                    )}
                                  </div>

                                  {/* Actions Column */}
                                  <div style={{ display: "flex", gap: "6px", alignItems: "center", flexShrink: 0 }}>
                                    {confirmRestoreFile === backup.filename ? (
                                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                        <span style={{ fontSize: "9px", color: "var(--color-yellow)", fontWeight: "bold" }}>OVERWRITE ACTIVE SAVE?</span>
                                        <button 
                                          className="btn btn-primary" 
                                          style={{ height: "22px", padding: "0 8px", fontSize: "9px", background: "var(--color-green)", color: "#032021" }}
                                          onClick={() => handleRestore(selectedProfile.id, backup.filename)}
                                        >
                                          YES
                                        </button>
                                        <button 
                                          className="btn btn-outline" 
                                          style={{ height: "22px", padding: "0 8px", fontSize: "9px" }}
                                          onClick={() => setConfirmRestoreFile(null)}
                                        >
                                          NO
                                        </button>
                                      </div>
                                    ) : confirmDeleteFile === backup.filename ? (
                                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                        <span style={{ fontSize: "9px", color: "var(--color-crimson)", fontWeight: "bold" }}>DELETE FILE?</span>
                                        <button 
                                          className="btn btn-primary" 
                                          style={{ height: "22px", padding: "0 8px", fontSize: "9px", background: "var(--color-crimson)", color: "white" }}
                                          onClick={() => handleDelete(selectedProfile.id, backup.filename)}
                                        >
                                          YES
                                        </button>
                                        <button 
                                          className="btn btn-outline" 
                                          style={{ height: "22px", padding: "0 8px", fontSize: "9px" }}
                                          onClick={() => setConfirmDeleteFile(null)}
                                        >
                                          NO
                                        </button>
                                      </div>
                                    ) : (
                                      !renamingFile && (
                                        <>
                                          <button 
                                            className="btn btn-outline" 
                                            style={{ height: "24px", padding: "0 10px", fontSize: "9px", color: "var(--color-green)", borderColor: "rgba(89, 248, 180, 0.3)" }}
                                            onClick={() => {
                                              setConfirmRestoreFile(backup.filename);
                                              setConfirmDeleteFile(null);
                                            }}
                                          >
                                            RESTORE
                                          </button>
                                          <button 
                                            className="btn btn-outline" 
                                            style={{ height: "24px", padding: "0 10px", fontSize: "9px", color: "var(--color-gray)" }}
                                            onClick={() => {
                                              setRenamingFile(backup.filename);
                                              setNewLabel(label === "System Auto-Save" || label.endsWith(" Checkpoint") ? "" : label);
                                              setConfirmRestoreFile(null);
                                              setConfirmDeleteFile(null);
                                            }}
                                          >
                                            RENAME
                                          </button>
                                          <button 
                                            className="btn btn-danger" 
                                            style={{ height: "24px", padding: "0 10px", fontSize: "9px" }}
                                            onClick={() => {
                                              setConfirmDeleteFile(backup.filename);
                                              setConfirmRestoreFile(null);
                                            }}
                                          >
                                            DELETE
                                          </button>
                                        </>
                                      )
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ maxHeight: "380px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px", paddingRight: "4px" }} className="backup-list-container">
                        {backups.map((backup) => {
                          const { label, type } = parseBackupFilename(backup.filename, selectedProfile.name);
                          return (
                            <div 
                              key={backup.filename}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                background: "var(--bg-color-inner)",
                                border: `1px solid ${type === "checkpoint" ? "rgba(89, 248, 180, 0.3)" : type === "rollback" ? "rgba(255, 107, 107, 0.3)" : "var(--border-color-tech)"}`,
                                borderRadius: "var(--radius-inner)",
                                padding: "10px 14px",
                                gap: "12px",
                                transition: "border-color 0.2s ease"
                              }}
                              className="backup-row"
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: "12px", width: "50%", minWidth: "150px", flexGrow: 1, overflow: "hidden" }}>
                                <svg style={{ width: 16, height: 16, color: type === "checkpoint" ? "var(--color-green)" : type === "rollback" ? "var(--color-crimson)" : "var(--color-cyan)", flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                </svg>
                                <div style={{ display: "flex", flexDirection: "column", gap: "2px", overflow: "hidden", width: "100%" }}>
                                  {renamingFile === backup.filename ? (
                                    <div style={{ display: "flex", gap: "8px", alignItems: "center", width: "100%" }}>
                                      <input
                                        type="text"
                                        className="form-input"
                                        value={newLabel}
                                        onChange={(e) => setNewLabel(e.target.value)}
                                        style={{ height: "26px", fontSize: "11px", padding: "0 8px", minHeight: "auto", flexGrow: 1 }}
                                        autoFocus
                                        placeholder="New Label"
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            handleRenameBackup(selectedProfile.id, backup.filename, newLabel);
                                          } else if (e.key === "Escape") {
                                            setRenamingFile(null);
                                          }
                                        }}
                                      />
                                      <button
                                        className="btn btn-primary"
                                        style={{ height: "26px", fontSize: "10px", padding: "0 10px", background: "var(--color-green)", color: "#032021" }}
                                        onClick={() => handleRenameBackup(selectedProfile.id, backup.filename, newLabel)}
                                      >
                                        SAVE
                                      </button>
                                      <button
                                        className="btn btn-outline"
                                        style={{ height: "26px", fontSize: "10px", padding: "0 10px" }}
                                        onClick={() => setRenamingFile(null)}
                                      >
                                        CANCEL
                                      </button>
                                    </div>
                                  ) : (
                                    <>
                                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                        <span 
                                          style={{
                                            fontSize: "11.5px",
                                            fontWeight: "600",
                                            color: type === "checkpoint" ? "var(--color-green)" : type === "rollback" ? "var(--color-crimson)" : "var(--color-white)",
                                            whiteSpace: "nowrap",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis"
                                          }}
                                          title={backup.filename}
                                        >
                                          {label}
                                        </span>
                                        {type === "checkpoint" && (
                                          <span style={{ fontSize: "8px", background: "rgba(89, 248, 180, 0.1)", color: "var(--color-green)", border: "1px solid rgba(89, 248, 180, 0.2)", borderRadius: "3px", padding: "1px 4px", fontWeight: "bold" }}>
                                            CHECKPOINT
                                          </span>
                                        )}
                                        {type === "rollback" && (
                                          <span style={{ fontSize: "8px", background: "rgba(255, 107, 107, 0.1)", color: "var(--color-crimson)", border: "1px solid rgba(255, 107, 107, 0.2)", borderRadius: "3px", padding: "1px 4px", fontWeight: "bold" }}>
                                            ROLLBACK
                                          </span>
                                        )}
                                      </div>
                                      <span style={{ fontSize: "9.5px", color: "var(--color-gray)", fontFamily: "var(--font-mono)" }}>
                                        {backup.created_at}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>

                              <span style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--color-cyan)" }}>
                                {formatBytes(backup.size_bytes)}
                              </span>

                              {/* Actions Column */}
                              <div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }}>
                                {confirmRestoreFile === backup.filename ? (
                                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                    <span style={{ fontSize: "9px", color: "var(--color-yellow)", fontWeight: "bold" }}>OVERWRITE ACTIVE SAVE?</span>
                                    <button 
                                      className="btn btn-primary" 
                                      style={{ height: "22px", padding: "0 8px", fontSize: "9px", background: "var(--color-green)", color: "#032021" }}
                                      onClick={() => handleRestore(selectedProfile.id, backup.filename)}
                                    >
                                      YES
                                    </button>
                                    <button 
                                      className="btn btn-outline" 
                                      style={{ height: "22px", padding: "0 8px", fontSize: "9px" }}
                                      onClick={() => setConfirmRestoreFile(null)}
                                    >
                                      NO
                                    </button>
                                  </div>
                                ) : confirmDeleteFile === backup.filename ? (
                                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                    <span style={{ fontSize: "9px", color: "var(--color-crimson)", fontWeight: "bold" }}>DELETE FILE?</span>
                                    <button 
                                      className="btn btn-primary" 
                                      style={{ height: "22px", padding: "0 8px", fontSize: "9px", background: "var(--color-crimson)", color: "white" }}
                                      onClick={() => handleDelete(selectedProfile.id, backup.filename)}
                                    >
                                      YES
                                    </button>
                                    <button 
                                      className="btn btn-outline" 
                                      style={{ height: "22px", padding: "0 8px", fontSize: "9px" }}
                                      onClick={() => setConfirmDeleteFile(null)}
                                    >
                                      NO
                                    </button>
                                  </div>
                                ) : (
                                  !renamingFile && (
                                    <>
                                      <button 
                                        className="btn btn-outline" 
                                        style={{ height: "24px", padding: "0 10px", fontSize: "9px", color: "var(--color-green)", borderColor: "rgba(89, 248, 180, 0.3)" }}
                                        onClick={() => {
                                          setConfirmRestoreFile(backup.filename);
                                          setConfirmDeleteFile(null);
                                        }}
                                      >
                                        RESTORE
                                      </button>
                                      <button 
                                        className="btn btn-outline" 
                                        style={{ height: "24px", padding: "0 10px", fontSize: "9px", color: "var(--color-gray)" }}
                                        onClick={() => {
                                          setRenamingFile(backup.filename);
                                          setNewLabel(label === "System Auto-Save" || label.endsWith(" Checkpoint") ? "" : label);
                                          setConfirmRestoreFile(null);
                                          setConfirmDeleteFile(null);
                                        }}
                                      >
                                        RENAME
                                      </button>
                                      <button 
                                        className="btn btn-danger" 
                                        style={{ height: "24px", padding: "0 10px", fontSize: "9px" }}
                                        onClick={() => {
                                          setConfirmDeleteFile(backup.filename);
                                          setConfirmRestoreFile(null);
                                        }}
                                      >
                                        DELETE
                                      </button>
                                    </>
                                  )
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Pruning tool row */}
                    {backups.length > 0 && (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid rgba(70, 94, 96, 0.2)", paddingTop: "12px", gap: "12px", marginTop: "12px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <span style={{ fontSize: "10px", color: "var(--color-gray)", fontWeight: "700" }}>ROTATION CLEANUP</span>
                          <span style={{ fontSize: "11px", color: "var(--color-gray)" }}>Manually reduce backups to save space</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "11px", color: "var(--color-white)" }}>Keep latest:</span>
                          <input 
                            type="number" 
                            min="1" 
                            max="100" 
                            className="form-input" 
                            style={{ width: "65px", height: "28px", padding: "0 8px", textAlign: "center", minHeight: "auto" }}
                            value={pruneCount}
                            onChange={(e) => setPruneCount(parseInt(e.target.value) || 10)}
                          />
                          <button 
                            className="btn btn-outline" 
                            style={{ height: "28px", fontSize: "10px", padding: "0 12px", color: "var(--color-yellow)", borderColor: "rgba(255, 208, 125, 0.3)" }}
                            onClick={() => handlePruneBackups(selectedProfile.id)}
                            disabled={pruning}
                          >
                            {pruning ? "PRUNING..." : "PRUNE"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="empty-detail-panel">
                  Select a game to view detailed monitoring status
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Live Terminal Log */}
      <section className="terminal-card">
        <header className="terminal-header">
          <span className="terminal-title">LIVE MONITOR ENGINE LOG FEED</span>
          <div className={`terminal-dot ${monitoringActive ? "active" : "paused"}`}></div>
        </header>
        <div className="terminal-content">
          {logs.length === 0 ? (
            <div className="terminal-line" style={{ color: "rgba(168, 188, 189, 0.25)" }}>
              No events captured. Waiting for filesystem writes...
            </div>
          ) : (
            logs.map((line, idx) => (
              <React.Fragment key={idx}>
                {parseLogLine(line)}
              </React.Fragment>
            ))
          )}
          <div ref={terminalEndRef}></div>
        </div>
        <div style={{ padding: "10px 18px", borderTop: "1px solid var(--border-color-tech)", display: "flex", justifyContent: "flex-end", backgroundColor: "#030606" }}>
          <button className="btn btn-danger" style={{ height: "26px", fontSize: "10px", padding: "0 12px" }} onClick={clearLogs}>
            CLEAR LOG TERMINAL
          </button>
        </div>
      </section>
    </>
  );
};
