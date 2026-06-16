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

  // Sync state if settings loaded later
  useEffect(() => {
    setMaxBackups(globalConfig.max_backups);
    setDebounceSeconds(globalConfig.debounce_seconds);
    setRunOnStartup(globalConfig.run_on_startup);
    setSteamgriddbApiKey(globalConfig.steamgriddb_api_key || "");
  }, [globalConfig]);

  return (
    <>
      <header className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Tweak general configurations, debounce periods, and cover art API keys.</p>
        </div>
      </header>

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
    </>
  );
};
