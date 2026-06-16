import React, { useState, useEffect } from "react";
import { GlobalConfig } from "../types";

interface SettingsPanelProps {
  globalConfig: GlobalConfig;
  onSave: (maxBackups: number, debounce: number, startup: boolean, steamgriddbApiKey: string) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ globalConfig, onSave }) => {
  const [maxBackups, setMaxBackups] = useState(globalConfig.max_backups);
  const [debounceSeconds, setDebounceSeconds] = useState(globalConfig.debounce_seconds);
  const [runOnStartup, setRunOnStartup] = useState(globalConfig.run_on_startup);
  const [steamgriddbApiKey, setSteamgriddbApiKey] = useState(globalConfig.steamgriddb_api_key || "");

  // Tab State
  const [activeSubTab, setActiveSubTab] = useState<"general" | "appearance" | "help" | "about text">(
    () => (localStorage.getItem("settings_subtab") as any) || "general"
  );

  // Theme State
  const [currentTheme, setCurrentTheme] = useState(() => localStorage.getItem("atlas_theme") || "stitch");

  // Help Accordion State
  const [expandedHelp, setExpandedHelp] = useState<Record<string, boolean>>({
    git: true,
    nas: false,
    detect: false,
    restore: false,
  });

  // Sync state if settings loaded later
  useEffect(() => {
    setMaxBackups(globalConfig.max_backups);
    setDebounceSeconds(globalConfig.debounce_seconds);
    setRunOnStartup(globalConfig.run_on_startup);
    setSteamgriddbApiKey(globalConfig.steamgriddb_api_key || "");
  }, [globalConfig]);

  const handleSubTabChange = (tab: "general" | "appearance" | "help" | "about text") => {
    setActiveSubTab(tab);
    localStorage.setItem("settings_subtab", tab);
  };

  const handleThemeChange = (themeName: string) => {
    setCurrentTheme(themeName);
    localStorage.setItem("atlas_theme", themeName);
    document.documentElement.className = themeName === "stitch" ? "" : `theme-${themeName}`;
  };

  const toggleHelp = (key: string) => {
    setExpandedHelp((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const THEMES = [
    { id: "stitch", name: "Stitch Cyber-Minimalist", desc: "Default sleek dark cyan & lavender cyberpunk palette", colors: ["#070c0c", "#00f2fe", "#d0bcff"] },
    { id: "cyberpunk", name: "Neon Cyberpunk", desc: "High-contrast hot pink & deep violet console screen", colors: ["#09000a", "#ff006e", "#3a86c8"] },
    { id: "slate", name: "Glassmorphism Slate", desc: "Clean corporate slate blue, silver & steel design", colors: ["#0f172a", "#38bdf8", "#818cf8"] },
    { id: "retro", name: "Retro Terminal", desc: "Phosphor monochrome matrix green with monospace details", colors: ["#000400", "#33ff33", "#11aa11"] },
    { id: "crimson", name: "Crimson Protocol", desc: "Stealth tactical blood red & matte black terminal", colors: ["#0d0405", "#ef4444", "#9f1239"] },
  ];

  return (
    <>
      <header className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Settings & System Hub</h1>
          <p className="page-subtitle">Configure system options, customize design interfaces, review connection guides, and view app info.</p>
        </div>
      </header>

      {/* Sub-tab navigation */}
      <nav className="settings-tab-list">
        <button
          className={`settings-tab-item ${activeSubTab === "general" ? "active" : ""}`}
          onClick={() => handleSubTabChange("general")}
        >
          General Parameters
        </button>
        <button
          className={`settings-tab-item ${activeSubTab === "appearance" ? "active" : ""}`}
          onClick={() => handleSubTabChange("appearance")}
        >
          Appearance & Themes
        </button>
        <button
          className={`settings-tab-item ${activeSubTab === "help" ? "active" : ""}`}
          onClick={() => handleSubTabChange("help")}
        >
          Help & Connection Center
        </button>
        <button
          className={`settings-tab-item ${activeSubTab === "about text" ? "active" : ""}`}
          onClick={() => handleSubTabChange("about text")}
        >
          About System
        </button>
      </nav>

      {/* RENDER ACTIVE SUB-TAB */}
      {activeSubTab === "general" && (
        <div style={{ animation: "fadeIn 0.25s ease-out" }}>
          {/* General Parameters */}
          <div className="tech-card">
            <header className="tech-card-header">
              <span className="tech-card-title">GENERAL PARAMETERS</span>
            </header>

            <div className="form-group" style={{ marginBottom: "25px" }}>
              <div className="flex-row-ends">
                <label className="form-label">MAX BACKUP SLOTS HELD (ROTATION BOUND): {maxBackups}</label>
              </div>
              <input
                type="range"
                min="2"
                max="100"
                value={maxBackups}
                onChange={(e) => setMaxBackups(parseInt(e.target.value))}
                style={{ width: "100%", accentColor: "var(--color-cyan)" }}
              />
              <p className="page-subtitle">Prunes older ZIP files automatically once slots for a game profile exceed this limit.</p>
            </div>

            <div className="form-group" style={{ marginBottom: "25px" }}>
              <div className="flex-row-ends">
                <label className="form-label">DEBOUNCE SETTLE DELAY: {debounceSeconds} SECONDS</label>
              </div>
              <input
                type="range"
                min="1"
                max="60"
                value={debounceSeconds}
                onChange={(e) => setDebounceSeconds(parseInt(e.target.value))}
                style={{ width: "100%", accentColor: "var(--color-cyan)" }}
              />
              <p className="page-subtitle">Quiet period required after a save file change occurs to ensure the game has finished its write block.</p>
            </div>

            <div className="form-group" style={{ marginBottom: "25px" }}>
              <div className="flex-row-ends">
                <div>
                  <label className="form-label">LAUNCH ON SYSTEM STARTUP</label>
                  <p className="page-subtitle">Starts AtlasSave automatically minimized in the tray on boot.</p>
                </div>
                <div
                  className={`switch-container ${runOnStartup ? "active" : ""}`}
                  onClick={() => setRunOnStartup(!runOnStartup)}
                >
                  <div className="switch-track">
                    <div className="switch-thumb"></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-row-ends" style={{ borderTop: "1px solid rgba(70, 94, 96, 0.2)", paddingTop: "15px" }}>
              <div></div>
              <button
                className="btn btn-primary"
                onClick={() => onSave(maxBackups, debounceSeconds, runOnStartup, steamgriddbApiKey)}
              >
                SAVE GLOBAL SETTINGS
              </button>
            </div>
          </div>

          {/* Cover Art Resolvers */}
          <div className="tech-card" style={{ marginTop: "24px" }}>
            <header className="tech-card-header" style={{ flexDirection: "column", alignItems: "flex-start", gap: "4px" }}>
              <span className="tech-card-title">COVER ART & METADATA RESOLVERS</span>
              <p className="tech-card-description">
                AtlasSave fetches game cover art dynamically. Free providers are active by default. Configure your API key to search premium databases like SteamGridDB.
              </p>
            </header>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "24px" }}>
              {/* Provider 1: Steam */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px", border: "1px solid var(--border-color-tech)", borderRadius: "var(--radius-inner)", background: "rgba(22, 31, 32, 0.3)" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <span style={{ fontWeight: "600", fontSize: "12.5px" }}>Steam Store Search API</span>
                  <span style={{ fontSize: "11px", color: "var(--color-gray)" }}>Primary keyless search resolver. Fetches official store headers.</span>
                </div>
                <span className="badge badge-active" style={{ fontSize: "8px" }}>FREE & ACTIVE</span>
              </div>

              {/* Provider 2: GOG Galaxy */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px", border: "1px solid var(--border-color-tech)", borderRadius: "var(--radius-inner)", background: "rgba(22, 31, 32, 0.3)" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <span style={{ fontWeight: "600", fontSize: "12.5px" }}>GOG Galaxy Database</span>
                  <span style={{ fontSize: "11px", color: "var(--color-gray)" }}>Secondary fallback catalog search for custom game box-arts.</span>
                </div>
                <span className="badge badge-active" style={{ fontSize: "8px" }}>FREE & ACTIVE</span>
              </div>

              {/* Provider 3: Epic Games Store */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px", border: "1px solid var(--border-color-tech)", borderRadius: "var(--radius-inner)", background: "rgba(22, 31, 32, 0.3)" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <span style={{ fontWeight: "600", fontSize: "12.5px" }}>Epic Games Store GraphQL</span>
                  <span style={{ fontSize: "11px", color: "var(--color-gray)" }}>Tertiary fallback API queries for high-resolution wide capsule graphics.</span>
                </div>
                <span className="badge badge-active" style={{ fontSize: "8px" }}>FREE & ACTIVE</span>
              </div>

              {/* Provider 4: SteamGridDB */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "16px", border: "1px solid var(--border-color-tech)", borderRadius: "var(--radius-inner)", background: "rgba(22, 31, 32, 0.4)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    <span style={{ fontWeight: "600", fontSize: "12.5px" }}>SteamGridDB Service</span>
                    <span style={{ fontSize: "11px", color: "var(--color-gray)" }}>
                      Community-curated repository containing thousands of custom headers, logos, and box arts.
                    </span>
                  </div>
                  <span className={`badge ${steamgriddbApiKey.trim() ? "badge-active" : "badge-paused"}`} style={{ fontSize: "8px" }}>
                    {steamgriddbApiKey.trim() ? "ACTIVE" : "REQUIRES KEY"}
                  </span>
                </div>

                <div className="form-group" style={{ marginBottom: 0, marginTop: "8px" }}>
                  <label className="form-label" style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                    <span>STEAMGRIDDB API KEY / TOKEN</span>
                    <a 
                      href="https://www.steamgriddb.com/profile/preferences/api" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      style={{ color: "var(--color-cyan)", textDecoration: "none", fontSize: "9px" }}
                    >
                      GET API KEY ↗
                    </a>
                  </label>
                  <input
                    className="form-input"
                    type="password"
                    placeholder="Paste your personal SteamGridDB API key here..."
                    value={steamgriddbApiKey}
                    onChange={(e) => setSteamgriddbApiKey(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="flex-row-ends" style={{ borderTop: "1px solid rgba(70, 94, 96, 0.2)", paddingTop: "15px" }}>
              <div></div>
              <button
                className="btn btn-primary"
                onClick={() => onSave(maxBackups, debounceSeconds, runOnStartup, steamgriddbApiKey)}
              >
                SAVE COVER RESOLVER SETTINGS
              </button>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === "appearance" && (
        <div style={{ animation: "fadeIn 0.25s ease-out" }} className="tech-card">
          <header className="tech-card-header" style={{ flexDirection: "column", alignItems: "flex-start", gap: "4px" }}>
            <span className="tech-card-title">SYSTEM THEME SELECTOR</span>
            <p className="tech-card-description">Choose a curated theme to restyle application borders, fonts, colors, and glow states instantly.</p>
          </header>

          <div className="theme-grid">
            {THEMES.map((theme) => (
              <div
                key={theme.id}
                className={`theme-card ${currentTheme === theme.id ? "active" : ""}`}
                onClick={() => handleThemeChange(theme.id)}
              >
                <div className="theme-preview" style={{ background: theme.colors[0] }}>
                  <div className="theme-preview-color" style={{ background: theme.colors[1] }}></div>
                  <div className="theme-preview-color" style={{ background: theme.colors[2] }}></div>
                  <span style={{ fontSize: "11px", fontWeight: "700", fontFamily: theme.id === "retro" ? "var(--font-mono)" : "var(--font-sans)", color: theme.colors[1] }}>
                    {theme.id.toUpperCase()}
                  </span>
                </div>
                <div className="theme-card-details">
                  <span className="theme-card-title">{theme.name}</span>
                  <span className="theme-card-desc">{theme.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeSubTab === "help" && (
        <div style={{ animation: "fadeIn 0.25s ease-out" }} className="help-guide-container">
          {/* Guide 1: Git Integration */}
          <div className="help-section">
            <header className="help-header" onClick={() => toggleHelp("git")}>
              <div className="help-title-group">
                <svg className="help-icon" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path fillRule="evenodd" d="M15.6 8.5c-.2-.6-.5-1.1-.9-1.5-.4-.4-.9-.7-1.5-.9-.6-.2-1.2-.2-1.8 0-.6.2-1.1.5-1.5.9l-1.4 1.4-1-1 1.4-1.4c.8-.8.8-2 0-2.8s-2-.8-2.8 0L6.1 5.1c-.4-.4-.9-.7-1.5-.9s-1.2-.2-1.8 0c-.6.2-1.1.5-1.5.9-.4.4-.7.9-.9 1.5s-.2 1.2 0 1.8c.2.6.5 1.1.9 1.5l2.8 2.8c.8.8 2 .8 2.8 0l1-1-1.4-1.4-.7.7c-.4.4-1 .4-1.4 0L4 7.7c-.4-.4-.4-1 0-1.4l1.4-1.4c.4-.4 1-.4 1.4 0l1 1-1.4 1.4c-.8.8-.8 2 0 2.8s2 .8 2.8 0l1.4-1.4c.4.4.9.7 1.5.9s1.2.2 1.8 0c.6-.2 1.1-.5 1.5-.9.4-.4.7-.9.9-1.5s.2-1.2 0-1.8z"/>
                </svg>
                <span className="help-title">Configuring Git & GitHub Sync Providers</span>
              </div>
              <span>{expandedHelp.git ? "▼" : "▶"}</span>
            </header>
            
            {expandedHelp.git && (
              <div className="help-content">
                <p>AtlasSave supports bi-directional Git repositories to back up and synchronize save profiles across different hardware setups.</p>
                
                <h4 style={{ color: "var(--color-cyan)", fontSize: "13px" }}>HTTPS Connection (Personal Access Token)</h4>
                <ul className="help-step-list">
                  <li>Generate a **Classic Personal Access Token** in your GitHub Settings (Developer Settings &gt; Personal Access Tokens &gt; Tokens Classic).</li>
                  <li>Enable the `repo` scope.</li>
                  <li>Format the HTTPS URL with your token in the Repository URL field:</li>
                </ul>
                <div className="help-code-block">
                  https://your_username:your_github_token@github.com/username/your_saves_repo.git
                </div>

                <h4 style={{ color: "var(--color-cyan)", fontSize: "13px", marginTop: "10px" }}>SSH Connection (Custom Key Authentication)</h4>
                <ul className="help-step-list">
                  <li>Generate an SSH key pair specifically for AtlasSave (without password/passphrase):</li>
                  <div className="help-code-block">ssh-keygen -t ed25519 -f C:\Users\YourUser\.ssh\atlassave_key</div>
                  <li>Copy and add the contents of the public key (`atlassave_key.pub`) to your GitHub Deploy Keys or Account SSH settings.</li>
                  <li>In AtlasSave Git Settings, specify the absolute path to your private key file:</li>
                  <div className="help-code-block">C:\Users\YourUser\.ssh\atlassave_key</div>
                  <li>Ensure the repository URL is formatted as an SSH address (e.g. `git@github.com:username/repo.git`).</li>
                  <li>Toggle **Auto-Accept Unknown Hosts** so background headless terminal operations can sync automatically without connection prompts.</li>
                </ul>
              </div>
            )}
          </div>

          {/* Guide 2: NAS Setup */}
          <div className="help-section">
            <header className="help-header" onClick={() => toggleHelp("nas")}>
              <div className="help-title-group">
                <svg className="help-icon" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M1 2a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2zm12 1H2v10h12V3z"/>
                  <path d="M4.5 5.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0zm3 0a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0zm3 0a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0zM3 8h10v1H3V8zm0 2h10v1H3v-1z"/>
                </svg>
                <span className="help-title">Local Folder & NAS Copy Backup Settings</span>
              </div>
              <span>{expandedHelp.nas ? "▼" : "▶"}</span>
            </header>

            {expandedHelp.nas && (
              <div className="help-content">
                <p>Local backup copies are ideal for network drives (NAS), secondary hard disks, or USB drives.</p>
                <ul className="help-step-list">
                  <li>Navigate to the **Providers** view page.</li>
                  <li>Enable the **Local Backup Destination** toggle.</li>
                  <li>Click **Browse** to specify a folder path (for example, a mapped network drive path like `Z:\Backups\AtlasSaves\`).</li>
                  <li>Click **Save Destination** to persist the configuration.</li>
                  <li>*Rotation limit rules apply*: Whenever a backup occurs, oldest files in this destination folder will be rotated based on the Max Backups parameter.</li>
                </ul>
              </div>
            )}
          </div>

          {/* Guide 3: Auto-detect Save Files */}
          <div className="help-section">
            <header className="help-header" onClick={() => toggleHelp("detect")}>
              <div className="help-title-group">
                <svg className="help-icon" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
                </svg>
                <span className="help-title">Game Save Folder Auto-Detection Heuristics</span>
              </div>
              <span>{expandedHelp.detect ? "▼" : "▶"}</span>
            </header>

            {expandedHelp.detect && (
              <div className="help-content">
                <p>AtlasSave analyzes game executable paths to detect where save files are located on your disk.</p>
                <ul className="help-step-list">
                  <li>In **Game Profiles**, click **Detect Save Directory** and select the main game executable file (e.g. `eldenring.exe`).</li>
                  <li>The engine parses registry keys, game titles, and checks directory signatures inside AppData, Saved Games, Steam Userdata, and My Documents folders.</li>
                  <li>If the scanner misses, select the save file folder manually by browsing to the exact location.</li>
                </ul>
              </div>
            )}
          </div>

          {/* Guide 4: Restoring Saves */}
          <div className="help-section">
            <header className="help-header" onClick={() => toggleHelp("restore")}>
              <div className="help-title-group">
                <svg className="help-icon" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path fillRule="evenodd" d="M8 3a5 5 0 1 1-4.546 2.914.5.5 0 0 0-.908-.417A6 6 0 1 0 8 2v1z"/>
                  <path d="M8 4.4a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 0-1 0v4a.5.5 0 0 0 .5.5z"/>
                  <path d="M3.854 3.146a.5.5 0 0 0-.708 0l-1.5 1.5a.5.5 0 0 0 0 .708l1.5 1.5a.5.5 0 0 0 .708-.708L2.707 4.5l1.147-1.146a.5.5 0 0 0 0-.708z"/>
                </svg>
                <span className="help-title">Restore Safe-Rollbacks & Conflict Merging</span>
              </div>
              <span>{expandedHelp.restore ? "▼" : "▶"}</span>
            </header>

            {expandedHelp.restore && (
              <div className="help-content">
                <p>Restoring save files features automatic rollback protection to ensure you never lose your current game progress.</p>
                <h4 style={{ color: "var(--color-cyan)", fontSize: "13px" }}>Automatic Rollback</h4>
                <p>Whenever you trigger a restore of an older save file, AtlasSave immediately packages the active files on disk into a **rollback zip** archive first. If a restore goes wrong or you make a mistake, you can find the rollback archive in your backup list and revert to it.</p>
                
                <h4 style={{ color: "var(--color-cyan)", fontSize: "13px", marginTop: "10px" }}>Bi-Directional Conflict Resolution</h4>
                <p>During sync schedules, if remote Git changes are pulled, AtlasSave merges changes automatically. It prioritizes the latest remote files using the `git pull --rebase -X theirs` strategy, preventing local merge conflict blocks in headless mode.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeSubTab === "about text" && (
        <div style={{ animation: "fadeIn 0.25s ease-out" }}>
          {/* About Header Banner */}
          <div className="about-banner tech-card">
            <svg className="about-logo-shield" width="64" height="64" fill="currentColor" viewBox="0 0 16 16">
              <path d="M5.338 1.59a61.447 61.447 0 0 0-2.837.856.481.481 0 0 0-.328.39c-.554 4.157.726 7.19 2.253 9.188a10.725 10.725 0 0 0 2.287 2.233c.346.244.652.42.887.523a.482.482 0 0 0 .409 0c.235-.104.54-.28.888-.523a10.725 10.725 0 0 0 2.286-2.233c1.527-1.997 2.807-5.031 2.253-9.188a.48.48 0 0 0-.328-.39c-.651-.213-1.75-.56-2.837-.855C9.552 1.29 8.531 1.013 8 1c-.53.013-1.552.29-2.662.59zM8 0c.535 0 1.541.272 2.662.59 1.108.316 2.213.666 2.868.88a1.482 1.482 0 0 1 .998 1.15c.61 4.58-.9 7.965-2.583 10.165a11.725 11.725 0 0 1-2.51 2.453c-.379.27-.77.49-1.108.64a1.482 1.482 0 0 1-1.254 0c-.338-.15-.729-.37-1.108-.64a11.725 11.725 0 0 1-2.51-2.453C1.51 10.585.0 7.2.61 2.62a1.482 1.482 0 0 1 .998-1.15c.655-.215 1.76-.565 2.868-.88C5.64 0.272 6.645 0 8 0z"/>
            </svg>
            <span className="about-app-name">ATLAS SAVE</span>
            <span className="about-app-ver">v0.1.0-alpha</span>
          </div>

          {/* Description Card */}
          <div className="about-desc-card">
            <span style={{ fontSize: "14px", fontWeight: "700", color: "var(--color-white)" }}>PRODUCT DESCRIPTION</span>
            <p style={{ color: "var(--color-gray)", fontSize: "12.5px", lineHeight: "1.6" }}>
              AtlasSave is a real-time game save manager designed for PC gamers who value security, stability, and speed. 
              Utilizing a native Rust watcher, AtlasSave captures folder-level operations instantly, structures and rotates 
              local backups, handles headless SSH and Git-sync pipelines, and keeps directories neatly segregated.
            </p>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "8px", borderTop: "1px solid rgba(70, 94, 96, 0.2)", paddingTop: "16px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span style={{ fontSize: "10px", color: "var(--color-gray)" }}>PLATFORM BACKEND</span>
                <span style={{ fontWeight: "600", fontSize: "12px", color: "var(--color-white)" }}>Tauri v2 + Tokio + Rust</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span style={{ fontSize: "10px", color: "var(--color-gray)" }}>FRONTEND STYLING</span>
                <span style={{ fontWeight: "600", fontSize: "12px", color: "var(--color-white)" }}>React + TypeScript + Custom HSL</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span style={{ fontSize: "10px", color: "var(--color-gray)" }}>DEVELOPMENT LICENSE</span>
                <span style={{ fontWeight: "600", fontSize: "12px", color: "var(--color-white)" }}>MIT License</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span style={{ fontSize: "10px", color: "var(--color-gray)" }}>STATUS CODE</span>
                <span style={{ fontWeight: "600", fontSize: "12px", color: "var(--color-cyan)" }}>Core Watchers Engaged</span>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "center", marginTop: "16px", paddingTop: "16px", borderTop: "1px solid rgba(70, 94, 96, 0.2)" }}>
              <a 
                href="https://github.com/rayan-dev0/AtlasSave" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="about-link-github"
              >
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
                </svg>
                VIEW SOURCE ON GITHUB
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
