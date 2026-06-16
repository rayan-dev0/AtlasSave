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

  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);
  
  const [confirmRestoreFile, setConfirmRestoreFile] = useState<string | null>(null);
  const [confirmDeleteFile, setConfirmDeleteFile] = useState<string | null>(null);
  
  const [backingUpCurrent, setBackingUpCurrent] = useState(false);

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

  useEffect(() => {
    if (selectedProfileId) {
      loadBackups(selectedProfileId);
      setConfirmRestoreFile(null);
      setConfirmDeleteFile(null);
    } else {
      setBackups([]);
    }
  }, [selectedProfileId]);

  useEffect(() => {
    const handleRefresh = () => {
      if (selectedProfileId) {
        loadBackups(selectedProfileId);
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
                            <span className={`badge ${selectedProfile.enabled && monitoringActive ? "badge-active" : "badge-paused"}`}>
                              {selectedProfile.enabled && monitoringActive ? "Watching" : "Offline"}
                            </span>
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

                  {/* Save Archives & Backups Management list */}
                  <div className="tech-card" style={{ flexGrow: 1, margin: 0, padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                    <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(70, 94, 96, 0.2)", paddingBottom: "10px" }}>
                      <span className="tech-card-title">SAVE FILE ARCHIVES & HISTORY</span>
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
                    ) : (
                      <div style={{ maxHeight: "200px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px", paddingRight: "4px" }}>
                        {backups.map((backup) => (
                          <div 
                            key={backup.filename}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              background: "var(--bg-color-inner)",
                              border: "1px solid var(--border-color-tech)",
                              borderRadius: "var(--radius-inner)",
                              padding: "10px 14px",
                              gap: "12px",
                              transition: "border-color 0.2s ease"
                            }}
                            className="backup-row"
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "12px", width: "50%", minWidth: "150px" }}>
                              <svg style={{ width: 16, height: 16, color: "var(--color-purple)", flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                              </svg>
                              <div style={{ display: "flex", flexDirection: "column", gap: "2px", overflow: "hidden" }}>
                                <span 
                                  style={{ fontSize: "11.5px", fontWeight: "600", color: "var(--color-white)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                                  title={backup.filename}
                                >
                                  {backup.filename}
                                </span>
                                <span style={{ fontSize: "9.5px", color: "var(--color-gray)", fontFamily: "var(--font-mono)" }}>
                                  {backup.created_at}
                                </span>
                              </div>
                            </div>

                            <span style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--color-cyan)" }}>
                              {formatBytes(backup.size_bytes)}
                            </span>

                            {/* Actions Column */}
                            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
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
                              )}
                            </div>
                          </div>
                        ))}
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
