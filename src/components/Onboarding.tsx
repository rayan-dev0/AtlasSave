import React from "react";

interface OnboardingViewProps {
  onboardingStep: "welcome" | "providers" | "settings" | "ready";
  setOnboardingStep: (val: "welcome" | "providers" | "settings" | "ready") => void;
  
  gitEnabled: boolean;
  setGitEnabled: (val: boolean) => void;
  gitUrl: string;
  setGitUrl: (val: string) => void;
  gitBranch: string;
  setGitBranch: (val: string) => void;
  gitTestStatus: string | null;
  gitTesting: boolean;
  handleTestGit: () => void;
  
  localEnabled: boolean;
  setLocalEnabled: (val: boolean) => void;
  localPath: string;
  setLocalPath: (val: string) => void;
  handleBrowseDir: (setter: (val: string) => void) => void;
  
  onboardMaxBackups: number;
  setOnboardMaxBackups: (val: number) => void;
  onboardDebounce: number;
  setOnboardDebounce: (val: number) => void;
  onboardStartup: boolean;
  setOnboardStartup: (val: boolean) => void;
  
  handleCompleteOnboarding: () => void;
}

export const OnboardingView: React.FC<OnboardingViewProps> = ({
  onboardingStep,
  setOnboardingStep,
  gitEnabled,
  setGitEnabled,
  gitUrl,
  setGitUrl,
  gitBranch,
  setGitBranch,
  gitTestStatus,
  gitTesting,
  handleTestGit,
  localEnabled,
  setLocalEnabled,
  localPath,
  setLocalPath,
  handleBrowseDir,
  onboardMaxBackups,
  setOnboardMaxBackups,
  onboardDebounce,
  setOnboardDebounce,
  onboardStartup,
  setOnboardStartup,
  handleCompleteOnboarding,
}) => {
  const onboardingStepsList = [
    { id: "welcome", label: "Welcome" },
    { id: "providers", label: "Sync Locations" },
    { id: "settings", label: "Preferences" },
    { id: "ready", label: "Confirm" }
  ];
  const currentStepIdx = onboardingStepsList.findIndex(s => s.id === onboardingStep);

  return (
    <div className="onboarding-container">
      <div className="onboarding-card">
        {/* Stepper Node Header */}
        <div className="stepper-header">
          <div className="stepper-header-line"></div>
          <div 
            className="stepper-progress" 
            style={{ width: `${(currentStepIdx / (onboardingStepsList.length - 1)) * 92}%` }}
          ></div>
          {onboardingStepsList.map((step, idx) => (
            <div 
              key={step.id} 
              className={`stepper-step-node ${idx < currentStepIdx ? "completed" : ""} ${step.id === onboardingStep ? "active" : ""}`}
              title={step.label}
            >
              {idx < currentStepIdx ? "✓" : idx + 1}
            </div>
          ))}
        </div>

        {/* STEP 1: WELCOME SCREEN */}
        {onboardingStep === "welcome" && (
          <div className="onboarding-step-container" style={{ textAlign: "center" }}>
            <svg className="onboarding-logo" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.599-3.75A11.952 11.952 0 0112 2.714z" />
            </svg>
            <h1 className="onboarding-title" style={{ marginBottom: "10px" }}>ATLAS SAVE</h1>
            <p className="onboarding-desc">
              Sleek, background-safe, automated backup protection for your game saves. Defend your game progression from corruption using instant debounced local archives and Git version syncing.
            </p>
            
            <div style={{ marginTop: "30px" }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ width: "100%", maxWidth: "240px", fontSize: "12.5px" }}
                onClick={() => setOnboardingStep("providers")}
              >
                START SETUP CONFIG
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: BACKUP PROVIDERS */}
        {onboardingStep === "providers" && (
          <div className="onboarding-step-container">
            <h3 className="tech-card-title" style={{ marginBottom: "8px", color: "var(--color-purple)", textAlign: "center" }}>
              CHOOSE SYNC BACKUP TARGETS
            </h3>
            <p className="page-subtitle" style={{ textAlign: "center", marginBottom: "20px" }}>
              Enable target routes where your compressed backup ZIP files will copy.
            </p>

            {/* Git Option Box */}
            <div 
              className={`provider-option-box ${gitEnabled ? "active" : ""}`}
              onClick={() => setGitEnabled(!gitEnabled)}
            >
              <svg className="provider-option-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5.25V18m0 0a3 3 0 11-6 0m6 0a3 3 0 106 0M12 5.25a3 3 0 11-6 0m6 0a3 3 0 106 0" />
              </svg>
              <div className="provider-option-info">
                <span className="provider-option-title">Git Version Control Repository</span>
                <span className="provider-option-desc">Commit and push save files incrementally into private git repositories.</span>
              </div>
              <div className={`switch-container ${gitEnabled ? "active" : ""}`} onClick={(e) => e.stopPropagation()}>
                <div className="switch-track" onClick={() => setGitEnabled(!gitEnabled)}>
                  <div className="switch-thumb"></div>
                </div>
              </div>
            </div>

            {gitEnabled && (
              <div className="tech-card" style={{ padding: "16px", marginBottom: "20px", background: "rgba(4,8,8,0.3)" }}>
                <div className="form-group">
                  <label className="form-label">PRIVATE GIT REPOSITORY URL (HTTPS / SSH)</label>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="git@github.com:username/save-backups.git"
                    value={gitUrl}
                    onChange={(e) => setGitUrl(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: "12px" }}>
                  <label className="form-label">SYNC BRANCH</label>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="main"
                    value={gitBranch}
                    onChange={(e) => setGitBranch(e.target.value)}
                  />
                </div>
                <div className="flex-row-ends">
                  <button 
                    type="button" 
                    className="btn btn-outline" 
                    style={{ height: "30px", fontSize: "10.5px" }} 
                    onClick={handleTestGit}
                    disabled={gitTesting}
                  >
                    {gitTesting ? "TESTING..." : "TEST CONNECTION"}
                  </button>
                  {gitTestStatus && (
                    <span className="form-label" style={{ fontSize: "10px", color: gitTestStatus.startsWith("Git Connection Successful") ? "var(--color-green)" : "var(--color-crimson)" }}>
                      {gitTestStatus}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Local NAS Option Box */}
            <div 
              className={`provider-option-box ${localEnabled ? "active" : ""}`}
              onClick={() => setLocalEnabled(!localEnabled)}
            >
              <svg className="provider-option-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 3h13.5m-16.5-6h19.5v9A1.5 1.5 0 0121 21.75H3A1.5 1.5 0 011.5 20.25v-9zm0-3.75A1.5 1.5 0 013 5.25h4.5a1.5 1.5 0 011.5 1.5v2.25H1.5V6.75z" />
              </svg>
              <div className="provider-option-info">
                <span className="provider-option-title">Local Directory / Drive / NAS</span>
                <span className="provider-option-desc">Copy zip backups to external storage, secondary disks, or LAN network folder paths.</span>
              </div>
              <div className={`switch-container ${localEnabled ? "active" : ""}`} onClick={(e) => e.stopPropagation()}>
                <div className="switch-track" onClick={() => setLocalEnabled(!localEnabled)}>
                  <div className="switch-thumb"></div>
                </div>
              </div>
            </div>

            {localEnabled && (
              <div className="tech-card" style={{ padding: "16px", marginBottom: "20px", background: "rgba(4,8,8,0.3)" }}>
                <div className="form-group" style={{ marginBottom: "0" }}>
                  <label className="form-label">NAS OR EXTERNAL PATHWAY</label>
                  <div className="form-input-row">
                    <input
                      className="form-input"
                      type="text"
                      placeholder="e.g. E:\Backups\Games or \\192.168.1.50\Saves"
                      value={localPath}
                      onChange={(e) => setLocalPath(e.target.value)}
                    />
                    <button 
                      type="button" 
                      className="btn btn-outline"
                      onClick={() => handleBrowseDir(setLocalPath)}
                    >
                      BROWSE
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="onboarding-footer">
              <button 
                type="button" 
                className="btn btn-outline" 
                onClick={() => setOnboardingStep("welcome")}
              >
                BACK
              </button>
              <button 
                type="button" 
                className="btn btn-primary"
                onClick={() => setOnboardingStep("settings")}
                disabled={gitEnabled && !gitUrl.trim() || localEnabled && !localPath.trim()}
              >
                NEXT STEP
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: GLOBAL SETTINGS SLIDERS */}
        {onboardingStep === "settings" && (
          <div className="onboarding-step-container">
            <h3 className="tech-card-title" style={{ marginBottom: "8px", color: "var(--color-purple)", textAlign: "center" }}>
              PREFERENCES CONFIGURATION
            </h3>
            <p className="page-subtitle" style={{ textAlign: "center", marginBottom: "20px" }}>
              Tune file watch bounds and backup triggers to match your disk limits and gaming patterns.
            </p>

            <div className="form-group" style={{ marginBottom: "20px" }}>
              <label className="form-label">
                <span>MAX BACKUPS: {onboardMaxBackups} SLOTS</span>
              </label>
              <input
                type="range"
                min="2"
                max="50"
                value={onboardMaxBackups}
                onChange={(e) => setOnboardMaxBackups(parseInt(e.target.value))}
                style={{ width: "100%", accentColor: "var(--color-cyan)" }}
              />
              <p className="page-subtitle" style={{ marginTop: "2px" }}>Limit of historical ZIP files preserved per profile. Prunes older saves automatically.</p>
            </div>

            <div className="form-group" style={{ marginBottom: "20px" }}>
              <label className="form-label">
                <span>DEBOUNCE SETTLE DELAY: {onboardDebounce} SECONDS</span>
              </label>
              <input
                type="range"
                min="2"
                max="30"
                value={onboardDebounce}
                onChange={(e) => setOnboardDebounce(parseInt(e.target.value))}
                style={{ width: "100%", accentColor: "var(--color-cyan)" }}
              />
              <p className="page-subtitle" style={{ marginTop: "2px" }}>Buffer duration before archiving game write events. Avoids conflicts during rapid game saves.</p>
            </div>

            <div className="form-group" style={{ marginBottom: "15px" }}>
              <div className="flex-row-ends">
                <div>
                  <label className="form-label" style={{ fontSize: "11.5px" }}>LAUNCH MINIMIZED ON SYSTEM STARTUP</label>
                  <p className="page-subtitle" style={{ marginTop: "2px" }}>Launches AtlasSave quietly into system tray when computer boots.</p>
                </div>
                <div 
                  className={`switch-container ${onboardStartup ? "active" : ""}`}
                  onClick={() => setOnboardStartup(!onboardStartup)}
                >
                  <div className="switch-track">
                    <div className="switch-thumb"></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="onboarding-footer">
              <button 
                type="button" 
                className="btn btn-outline" 
                onClick={() => setOnboardingStep("providers")}
              >
                BACK
              </button>
              <button 
                type="button" 
                className="btn btn-primary"
                onClick={() => setOnboardingStep("ready")}
              >
                NEXT STEP
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: FINAL CONFIRMATION SUMMARY */}
        {onboardingStep === "ready" && (
          <div className="onboarding-step-container">
            <h3 className="tech-card-title" style={{ marginBottom: "8px", color: "var(--color-green)", textAlign: "center" }}>
              CONFIGURATION REVIEW
            </h3>
            <p className="page-subtitle" style={{ textAlign: "center", marginBottom: "20px" }}>
              Confirm details before initializing the background file monitoring system.
            </p>

            <div className="tech-card" style={{ padding: "18px", background: "rgba(4,8,8,0.3)", marginBottom: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div className="flex-row-ends" style={{ borderBottom: "1px solid rgba(70,94,96,0.15)", paddingBottom: "6px" }}>
                <span className="form-label" style={{ color: "var(--color-white)" }}>BACKUP LOCATIONS</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <div className="flex-row-ends" style={{ fontSize: "11.5px" }}>
                  <span style={{ color: "var(--color-gray)" }}>Git Repository Sync:</span>
                  <span style={{ color: gitEnabled ? "var(--color-green)" : "rgba(168,188,189,0.3)" }}>
                    {gitEnabled ? "ENABLED" : "DISABLED"}
                  </span>
                </div>
                {gitEnabled && (
                  <div style={{ wordBreak: "break-all", fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--color-purple)" }}>
                    {gitUrl}
                  </div>
                )}

                <div className="flex-row-ends" style={{ fontSize: "11.5px" }}>
                  <span style={{ color: "var(--color-gray)" }}>Local NAS pathway:</span>
                  <span style={{ color: localEnabled ? "var(--color-green)" : "rgba(168,188,189,0.3)" }}>
                    {localEnabled ? "ENABLED" : "DISABLED"}
                  </span>
                </div>
                {localEnabled && (
                  <div style={{ wordBreak: "break-all", fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--color-purple)" }}>
                    {localPath}
                  </div>
                )}
              </div>

              <div className="flex-row-ends" style={{ borderBottom: "1px solid rgba(70,94,96,0.15)", paddingBottom: "6px", marginTop: "8px" }}>
                <span className="form-label" style={{ color: "var(--color-white)" }}>SYSTEM PROPERTIES</span>
              </div>
              <div className="flex-row-ends" style={{ fontSize: "11px", color: "var(--color-gray)" }}>
                <span>Max backups: <b>{onboardMaxBackups}</b></span>
                <span>Debounce window: <b>{onboardDebounce}s</b></span>
                <span>Autostart: <b>{onboardStartup ? "ON" : "OFF"}</b></span>
              </div>
            </div>

            <div className="onboarding-footer">
              <button 
                type="button" 
                className="btn btn-outline" 
                onClick={() => setOnboardingStep("settings")}
              >
                BACK
              </button>
              <button 
                type="button" 
                className="btn btn-primary"
                style={{ textShadow: "0 0 4px rgba(0, 242, 254, 0.4)", boxShadow: "0 0 15px rgba(0, 242, 254, 0.2)" }}
                onClick={handleCompleteOnboarding}
              >
                FINALIZE & RUN ATLAS SAVE
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
