import React, { useState } from "react";

interface ProvidersViewProps {
  gitEnabled: boolean;
  setGitEnabled: (val: boolean) => void;
  gitUrl: string;
  setGitUrl: (val: string) => void;
  gitBranch: string;
  setGitBranch: (val: string) => void;
  gitTestStatus: string | null;
  gitTesting: boolean;
  handleTestGit: () => void;
  handleSaveGit: () => void;
  
  gitSyncInterval: number;
  setGitSyncInterval: (val: number) => void;
  gitAutoFetch: boolean;
  setGitAutoFetch: (val: boolean) => void;
  gitUserName: string;
  setGitUserName: (val: string) => void;
  gitUserEmail: string;
  setGitUserEmail: (val: string) => void;
  gitSshKeyPath: string;
  setGitSshKeyPath: (val: string) => void;
  gitAcceptNewHosts: boolean;
  setAcceptNewHosts: (val: boolean) => void;

  localEnabled: boolean;
  setLocalEnabled: (val: boolean) => void;
  localPath: string;
  setLocalPath: (val: string) => void;
  handleBrowseDir: (setter: (val: string) => void) => void;
  handleSaveLocal: () => void;
}

export const ProvidersView: React.FC<ProvidersViewProps> = ({
  gitEnabled,
  setGitEnabled,
  gitUrl,
  setGitUrl,
  gitBranch,
  setGitBranch,
  gitTestStatus,
  gitTesting,
  handleTestGit,
  handleSaveGit,

  gitSyncInterval,
  setGitSyncInterval,
  gitAutoFetch,
  setGitAutoFetch,
  gitUserName,
  setGitUserName,
  gitUserEmail,
  setGitUserEmail,
  gitSshKeyPath,
  setGitSshKeyPath,
  gitAcceptNewHosts,
  setAcceptNewHosts,

  localEnabled,
  setLocalEnabled,
  localPath,
  setLocalPath,
  handleBrowseDir,
  handleSaveLocal,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <>
      <header className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Backup Providers</h1>
          <p className="page-subtitle">Configure external copy routes and git sync repositories.</p>
        </div>
      </header>

      {/* Provider: Git Repository */}
      <div className="tech-card">
        <div className="tech-card-header" style={{ borderBottom: gitEnabled ? "1px solid rgba(70, 94, 96, 0.2)" : "none", paddingBottom: gitEnabled ? "12px" : "0", marginBottom: gitEnabled ? "20px" : "0" }}>
          <div>
            <span className="tech-card-title">GIT VERSION CONTROL (PRIVATE REPO)</span>
            <p className="tech-card-description">Pushes ZIP files directly to your private Git repo organized by game folder.</p>
          </div>
          <div
            className={`switch-container ${gitEnabled ? "active" : ""}`}
            onClick={() => setGitEnabled(!gitEnabled)}
          >
            <div className="switch-track">
              <div className="switch-thumb"></div>
            </div>
          </div>
        </div>

        {gitEnabled && (
          <div className="onboarding-step-container">
            <div className="form-group">
              <label className="form-label">REPOSITORY URL (HTTPS OR SSH)</label>
              <input
                className="form-input"
                type="text"
                placeholder="e.g. git@github.com:username/saves.git"
                value={gitUrl}
                onChange={(e) => setGitUrl(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">BRANCH NAME</label>
              <input
                className="form-input"
                type="text"
                placeholder="main"
                value={gitBranch}
                onChange={(e) => setGitBranch(e.target.value)}
              />
            </div>

            {/* Git Integration Help Accordion */}
            <details style={{
              background: "rgba(208, 188, 255, 0.04)",
              border: "1px solid rgba(208, 188, 255, 0.2)",
              borderRadius: "var(--radius-inner)",
              padding: "12px",
              marginBottom: "20px",
              cursor: "pointer"
            }}>
              <summary style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10.5px",
                fontWeight: "700",
                color: "var(--color-purple)",
                outline: "none",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                userSelect: "none"
              }}>
                <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                </svg>
                GIT & GITHUB CONFIGURATION GUIDE
              </summary>
              <div style={{
                marginTop: "10px",
                color: "var(--color-gray)",
                fontSize: "11px",
                lineHeight: "1.6",
                cursor: "default",
                display: "flex",
                flexDirection: "column",
                gap: "10px"
              }} onClick={(e) => e.stopPropagation()}>
                <p>
                  AtlasSave streams your save ZIP archives directly into a private Git repository. You can authenticate using HTTPS or SSH.
                </p>
                <div>
                  <strong style={{ color: "var(--color-white)" }}>Option A: HTTPS Authentication (Easiest)</strong>
                  <ul style={{ paddingLeft: "16px", marginTop: "4px", display: "flex", flexDirection: "column", gap: "2px", listStyleType: "none" }}>
                    <li>1. Create a <strong>private</strong> repository on GitHub (e.g. <code>saves</code>).</li>
                    <li>2. Generate a <strong>Personal Access Token (PAT)</strong> with <code>repo</code> scopes on GitHub settings.</li>
                    <li>3. Formulate the repository URL as: <code>https://&lt;username&gt;:&lt;token&gt;@github.com/&lt;username&gt;/&lt;repo&gt;.git</code>.</li>
                    <li>4. Paste it above, save settings, and test repository connection.</li>
                  </ul>
                </div>
                <div>
                  <strong style={{ color: "var(--color-white)" }}>Option B: SSH Authentication (Secure & Key-based)</strong>
                  <ul style={{ paddingLeft: "16px", marginTop: "4px", display: "flex", flexDirection: "column", gap: "2px", listStyleType: "none" }}>
                    <li>1. Set up an SSH Key (e.g. <code>id_ed25519</code>) and register its public key (<code>.pub</code>) on GitHub.</li>
                    <li>2. Use the SSH URL format: <code>git@github.com:&lt;username&gt;/&lt;repo&gt;.git</code>.</li>
                    <li>3. In <strong>Advanced Settings</strong> below, provide the absolute path to your private key file (e.g. <code>C:\Users\Name\.ssh\id_ed25519</code>).</li>
                    <li>4. Turn on <strong>Auto-Accept Host Keys</strong> to automatically accept GitHub's fingerprint and prevent connection hangs.</li>
                  </ul>
                </div>
              </div>
            </details>

            {/* Collapsible Advanced Settings Panel */}
            <button
              type="button"
              className="btn btn-outline"
              style={{ width: "100%", justifyContent: "space-between", marginBottom: "20px", height: "30px", fontSize: "10px" }}
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <span>{showAdvanced ? "HIDE" : "SHOW"} ADVANCED GIT SETTINGS</span>
              <svg style={{ width: 12, height: 12, transform: showAdvanced ? "rotate(180deg)" : "none", transition: "transform 0.2s ease" }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>

            {showAdvanced && (
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: "1fr 1fr", 
                gap: "20px", 
                padding: "20px", 
                background: "rgba(4, 8, 8, 0.45)", 
                border: "1px solid var(--border-color-tech)", 
                borderRadius: "var(--radius-inner)", 
                marginBottom: "20px", 
                animation: "fade-slide-in 0.2s ease" 
              }}>
                <div className="form-group" style={{ gridColumn: "1 / -1", margin: 0 }}>
                  <label className="form-label">GIT SYNC FREQUENCY</label>
                  <select 
                    className="form-input" 
                    value={gitSyncInterval} 
                    onChange={(e) => setGitSyncInterval(Number(e.target.value))}
                    style={{ backgroundColor: "var(--bg-color-inner)", color: "var(--color-white)", border: "1px solid var(--border-color-tech)" }}
                  >
                    <option value={0}>Real-time (Push on game write)</option>
                    <option value={5}>Every 5 minutes</option>
                    <option value={15}>Every 15 minutes</option>
                    <option value={30}>Every 30 minutes</option>
                    <option value={60}>Every 1 hour</option>
                    <option value={999999}>Manual Sync Only</option>
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <div className="flex-row-ends" style={{ height: "38px", alignItems: "center" }}>
                    <span className="form-label">AUTO-FETCH REMOTE SAVES</span>
                    <div
                      className={`switch-container ${gitAutoFetch ? "active" : ""}`}
                      onClick={() => setGitAutoFetch(!gitAutoFetch)}
                    >
                      <div className="switch-track">
                        <div className="switch-thumb"></div>
                      </div>
                    </div>
                  </div>
                  <p className="tech-card-description" style={{ marginTop: "4px" }}>Automatically imports saves backed up from other devices.</p>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <div className="flex-row-ends" style={{ height: "38px", alignItems: "center" }}>
                    <span className="form-label">AUTO-ACCEPT HOST KEYS</span>
                    <div
                      className={`switch-container ${gitAcceptNewHosts ? "active" : ""}`}
                      onClick={() => setAcceptNewHosts(!gitAcceptNewHosts)}
                    >
                      <div className="switch-track">
                        <div className="switch-thumb"></div>
                      </div>
                    </div>
                  </div>
                  <p className="tech-card-description" style={{ marginTop: "4px" }}>Prevents background hangs by auto-verifying unknown hosts.</p>
                </div>

                <div className="form-group" style={{ gridColumn: "1 / -1", margin: 0 }}>
                  <label className="form-label">CUSTOM SSH PRIVATE KEY FILE PATH</label>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="e.g. C:\Users\YourName\.ssh\id_rsa (leave empty for system agent)"
                    value={gitSshKeyPath}
                    onChange={(e) => setGitSshKeyPath(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">GIT COMMIT AUTHOR NAME</label>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="AtlasSave Bot"
                    value={gitUserName}
                    onChange={(e) => setGitUserName(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">GIT COMMIT AUTHOR EMAIL</label>
                  <input
                    className="form-input"
                    type="email"
                    placeholder="bot@atlassave.local"
                    value={gitUserEmail}
                    onChange={(e) => setGitUserEmail(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="flex-row-ends" style={{ marginTop: "20px", borderTop: "1px solid rgba(70, 94, 96, 0.15)", paddingTop: "15px" }}>
              <div className="flex-row-gap">
                <button
                  className="btn btn-outline "
                  onClick={handleTestGit}
                  disabled={gitTesting || !gitUrl.trim()}
                >
                  {gitTesting ? (
                    <>
                      <div className="loader-spinner"></div>
                      TESTING...
                    </>
                  ) : (
                    <>
                      <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.599-3.75A11.952 11.952 0 0112 2.714z" />
                      </svg>
                      TEST REPO CONNECTION
                    </>
                  )}
                </button>
                {gitTestStatus && (
                  <span className="form-label" style={{ fontSize: "10.5px", color: gitTestStatus.startsWith("Git Connection Successful") ? "var(--color-green)" : "var(--color-crimson)" }}>
                    {gitTestStatus}
                  </span>
                )}
              </div>
              
              <button 
                className="btn btn-primary" 
                onClick={handleSaveGit}
                disabled={gitEnabled && !gitUrl.trim()}
              >
                <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                SAVE GIT SETTINGS
              </button>
            </div>
          </div>
        )}

        {!gitEnabled && (
          <div className="flex-row-ends" style={{ marginTop: "15px", borderTop: "1px solid rgba(70, 94, 96, 0.15)", paddingTop: "15px" }}>
            <div></div>
            <button className="btn btn-primary" onClick={handleSaveGit}>
              <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              DISABLE GIT PROVIDER
            </button>
          </div>
        )}
      </div>

      {/* Provider: Local / NAS Network Path */}
      <div className="tech-card">
        <div className="tech-card-header" style={{ borderBottom: localEnabled ? "1px solid rgba(70, 94, 96, 0.2)" : "none", paddingBottom: localEnabled ? "12px" : "0", marginBottom: localEnabled ? "20px" : "0" }}>
          <div>
            <span className="tech-card-title">LOCAL / NETWORK BACKUP (NAS)</span>
            <p className="tech-card-description">Copies backup files to an external drive or network NAS directory.</p>
          </div>
          <div
            className={`switch-container ${localEnabled ? "active" : ""}`}
            onClick={() => setLocalEnabled(!localEnabled)}
          >
            <div className="switch-track">
              <div className="switch-thumb"></div>
            </div>
          </div>
        </div>

        {localEnabled && (
          <div className="onboarding-step-container">
            <div className="form-group">
              <label className="form-label">DESTINATION FOLDER PATH</label>
              <div className="form-input-row">
                <input
                  className="form-input"
                  type="text"
                  placeholder="e.g. D:\Backups\GameSaves or \\NAS\Saves"
                  value={localPath}
                  onChange={(e) => setLocalPath(e.target.value)}
                />
                <button
                  className="btn btn-outline"
                  onClick={() => handleBrowseDir(setLocalPath)}
                >
                  <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                  </svg>
                  BROWSE
                </button>
              </div>
            </div>

            <div className="flex-row-ends" style={{ marginTop: "20px", borderTop: "1px solid rgba(70, 94, 96, 0.15)", paddingTop: "15px" }}>
              <div></div>
              <button 
                className="btn btn-primary" 
                onClick={handleSaveLocal}
                disabled={localEnabled && !localPath.trim()}
              >
                <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                SAVE LOCAL PATH SETTINGS
              </button>
            </div>
          </div>
        )}

        {!localEnabled && (
          <div className="flex-row-ends" style={{ marginTop: "15px", borderTop: "1px solid rgba(70, 94, 96, 0.15)", paddingTop: "15px" }}>
            <div></div>
            <button className="btn btn-primary" onClick={handleSaveLocal}>
              <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              DISABLE LOCAL PROVIDER
            </button>
          </div>
        )}
      </div>
    </>
  );
};
