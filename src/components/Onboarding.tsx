import React from 'react';

interface OnboardingViewProps {
  onboardingStep: 'welcome' | 'providers' | 'settings' | 'ready';
  setOnboardingStep: (val: 'welcome' | 'providers' | 'settings' | 'ready') => void;

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
    { id: 'welcome', label: 'Welcome' },
    { id: 'providers', label: 'Sync Locations' },
    { id: 'settings', label: 'Preferences' },
    { id: 'ready', label: 'Confirm' },
  ];
  const currentStepIdx = onboardingStepsList.findIndex((s) => s.id === onboardingStep);

  return (
    <div className="flex flex-col justify-center items-center h-screen w-screen bg-bg-dark p-10 relative overflow-hidden">
      <div className="w-full max-w-[620px] bg-bg-card backdrop-blur-[20px] border border-tech-border rounded-card p-10 shadow-[0_15px_50px_rgba(0,0,0,0.6)] flex flex-col items-center gap-6 relative overflow-hidden">
        {/* Top Gradient Accent Line */}
        <span className="absolute top-0 left-0 right-0 h-[4px] bg-gradient-to-r from-cyan to-purple opacity-100 z-10" />

        {/* Stepper Node Header */}
        <div className="flex justify-between w-full mb-3 relative">
          <div className="absolute top-1/2 left-[4%] right-[4%] h-[2px] bg-tech-border/25 z-1 -translate-y-1/2"></div>
          <div
            className="absolute top-1/2 left-[4%] h-[2px] bg-gradient-to-r from-cyan to-purple z-1 -translate-y-1/2 transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
            style={{ width: `${(currentStepIdx / (onboardingStepsList.length - 1)) * 92}%` }}
          ></div>
          {onboardingStepsList.map((step, idx) => {
            const isCompleted = idx < currentStepIdx;
            const isActive = step.id === onboardingStep;
            return (
              <div
                key={step.id}
                className={`w-7 h-7 rounded-full bg-bg-inner border-2 flex items-center justify-center font-mono text-[10.5px] font-bold z-10 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] select-none
                  ${
                    isCompleted
                      ? 'border-green bg-green text-[#032021]'
                      : isActive
                        ? 'border-cyan bg-cyan/10 text-cyan shadow-[0_0_12px_rgba(0,242,254,0.3)]'
                        : 'border-tech-border text-gray'
                  }`}
                title={step.label}
              >
                {isCompleted ? '✓' : idx + 1}
              </div>
            );
          })}
        </div>

        {/* STEP 1: WELCOME SCREEN */}
        {onboardingStep === 'welcome' && (
          <div className="w-full animate-fade-slide-in text-center">
            <svg
              className="text-cyan w-[54px] h-[54px] drop-shadow-[0_0_8px_rgba(0,242,254,0.4)] mb-1 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.599-3.75A11.952 11.952 0 0112 2.714z"
              />
            </svg>
            <h1 className="text-2xl font-bold tracking-[3px] text-white [text-shadow:0_0_10px_rgba(255,255,255,0.15)] mb-2.5">
              ATLAS SAVE
            </h1>
            <p className="text-gray text-sm text-center max-w-[460px] leading-relaxed mx-auto">
              Sleek, background-safe, automated backup protection for your game saves. Defend your
              game progression from corruption using instant debounced local archives and Git
              version syncing.
            </p>

            <div className="mt-[30px]">
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 px-4 font-sans font-semibold rounded-inner cursor-pointer transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] h-8.5 border border-transparent select-none disabled:bg-tech-border/15 disabled:border-tech-border/20 disabled:text-gray/40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none bg-cyan text-[#032021] shadow-[0_2px_8px_rgba(0,242,254,0.15)] hover:not-disabled:bg-[#33f5ff] hover:not-disabled:shadow-[0_0_12px_rgba(0,242,254,0.45)] hover:not-disabled:-translate-y-px active:not-disabled:translate-y-0 w-full max-w-[240px] text-[12.5px]"
                onClick={() => setOnboardingStep('providers')}
              >
                START SETUP CONFIG
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: BACKUP PROVIDERS */}
        {onboardingStep === 'providers' && (
          <div className="w-full animate-fade-slide-in">
            <h3 className="text-[13.5px] font-bold tracking-[0.8px] text-purple uppercase text-center mb-2">
              CHOOSE SYNC BACKUP TARGETS
            </h3>
            <p className="text-gray text-xs mt-1 text-center mb-5">
              Enable target routes where your compressed backup ZIP files will copy.
            </p>

            {/* Git Option Box */}
            <div
              className={`group bg-bg-inner border rounded-inner p-4 flex items-center gap-4 cursor-pointer transition-all duration-200 mb-3.5 hover:border-cyan ${
                gitEnabled ? 'border-cyan bg-cyan/4' : 'border-tech-border'
              }`}
              onClick={() => setGitEnabled(!gitEnabled)}
            >
              <svg
                className={`w-7 h-7 transition-colors duration-200 ${
                  gitEnabled ? 'text-cyan' : 'text-gray'
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 5.25V18m0 0a3 3 0 11-6 0m6 0a3 3 0 106 0M12 5.25a3 3 0 11-6 0m6 0a3 3 0 106 0"
                />
              </svg>
              <div className="flex flex-col gap-0.5 flex-grow">
                <span className="font-semibold text-[13px] text-white">
                  Git Version Control Repository
                </span>
                <span className="text-[11px] text-gray">
                  Commit and push save files incrementally into private git repositories.
                </span>
              </div>
              <div
                className="flex items-center gap-2.5 cursor-pointer select-none group"
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  className={`w-10 h-[22px] bg-[#111a1b] border rounded-[11px] relative transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] group-hover:border-cyan ${
                    gitEnabled ? 'bg-green/15 border-green' : 'border-tech-border'
                  }`}
                  onClick={() => setGitEnabled(!gitEnabled)}
                >
                  <div
                    className={`w-3.5 h-3.5 rounded-full absolute top-[3px] transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                      gitEnabled
                        ? 'bg-green left-[20px] shadow-[0_0_8px_var(--color-green)]'
                        : 'bg-gray left-[4px]'
                    }`}
                  ></div>
                </div>
              </div>
            </div>

            {gitEnabled && (
              <div className="bg-bg-card backdrop-blur-[12px] border border-tech-border rounded-card relative overflow-hidden shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] hover:border-cyan/25 hover:shadow-[0_8px_32px_0_rgba(0,242,254,0.05)] transition-all duration-250 p-4 mb-5 bg-[#040808]/30">
                <span className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan to-purple opacity-85 z-5" />
                <div className="flex flex-col gap-2 mb-5">
                  <label className="font-mono text-[10px] font-bold text-gray uppercase tracking-[0.8px] flex justify-between items-center">
                    PRIVATE GIT REPOSITORY URL (HTTPS / SSH)
                  </label>
                  <input
                    className="grow bg-bg-inner border border-tech-border rounded-inner text-white px-3.5 py-2.5 font-sans text-[12.5px] outline-none h-[38px] transition-all duration-200 focus:border-cyan focus:shadow-[0_0_8px_rgba(0,242,254,0.2)] placeholder:text-gray/35"
                    type="text"
                    placeholder="git@github.com:username/save-backups.git"
                    value={gitUrl}
                    onChange={(e) => setGitUrl(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2 mb-3">
                  <label className="font-mono text-[10px] font-bold text-gray uppercase tracking-[0.8px] flex justify-between items-center">
                    SYNC BRANCH
                  </label>
                  <input
                    className="grow bg-bg-inner border border-tech-border rounded-inner text-white px-3.5 py-2.5 font-sans text-[12.5px] outline-none h-[38px] transition-all duration-200 focus:border-cyan focus:shadow-[0_0_8px_rgba(0,242,254,0.2)] placeholder:text-gray/35"
                    type="text"
                    placeholder="main"
                    value={gitBranch}
                    onChange={(e) => setGitBranch(e.target.value)}
                  />
                </div>
                <div className="flex justify-between items-center">
                  <button
                    type="button"
                    className="inline-flex items-center justify-center gap-2 px-4 font-sans font-semibold rounded-inner cursor-pointer transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] border select-none disabled:bg-tech-border/15 disabled:border-tech-border/20 disabled:text-gray/40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none bg-transparent border-tech-border text-purple hover:not-disabled:bg-purple/8 hover:not-disabled:border-purple hover:not-disabled:shadow-[0_0_10px_rgba(208,188,255,0.2)] hover:not-disabled:-translate-y-px active:not-disabled:translate-y-0 h-[30px] text-[10.5px]"
                    onClick={handleTestGit}
                    disabled={gitTesting}
                  >
                    {gitTesting ? 'TESTING...' : 'TEST CONNECTION'}
                  </button>
                  {gitTestStatus && (
                    <span
                      className="font-mono font-bold uppercase tracking-[0.8px] text-[10px]"
                      style={{
                        color: gitTestStatus.startsWith('Git Connection Successful')
                          ? 'var(--color-green)'
                          : 'var(--color-crimson)',
                      }}
                    >
                      {gitTestStatus}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Local NAS Option Box */}
            <div
              className={`group bg-bg-inner border rounded-inner p-4 flex items-center gap-4 cursor-pointer transition-all duration-200 mb-3.5 hover:border-cyan ${
                localEnabled ? 'border-cyan bg-cyan/4' : 'border-tech-border'
              }`}
              onClick={() => setLocalEnabled(!localEnabled)}
            >
              <svg
                className={`w-7 h-7 transition-colors duration-200 ${
                  localEnabled ? 'text-cyan' : 'text-gray'
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5.25 14.25h13.5m-13.5 3h13.5m-16.5-6h19.5v9A1.5 1.5 0 0121 21.75H3A1.5 1.5 0 011.5 20.25v-9zm0-3.75A1.5 1.5 0 013 5.25h4.5a1.5 1.5 0 011.5 1.5v2.25H1.5V6.75z"
                />
              </svg>
              <div className="flex flex-col gap-0.5 flex-grow">
                <span className="font-semibold text-[13px] text-white">
                  Local Directory / Drive / NAS
                </span>
                <span className="text-[11px] text-gray">
                  Copy zip backups to external storage, secondary disks, or LAN network folder
                  paths.
                </span>
              </div>
              <div
                className="flex items-center gap-2.5 cursor-pointer select-none group"
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  className={`w-10 h-[22px] bg-[#111a1b] border rounded-[11px] relative transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] group-hover:border-cyan ${
                    localEnabled ? 'bg-green/15 border-green' : 'border-tech-border'
                  }`}
                  onClick={() => setLocalEnabled(!localEnabled)}
                >
                  <div
                    className={`w-3.5 h-3.5 rounded-full absolute top-[3px] transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                      localEnabled
                        ? 'bg-green left-[20px] shadow-[0_0_8px_var(--color-green)]'
                        : 'bg-gray left-[4px]'
                    }`}
                  ></div>
                </div>
              </div>
            </div>

            {localEnabled && (
              <div className="bg-bg-card backdrop-blur-[12px] border border-tech-border rounded-card relative overflow-hidden shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] hover:border-cyan/25 hover:shadow-[0_8px_32px_0_rgba(0,242,254,0.05)] transition-all duration-250 p-4 mb-5 bg-[#040808]/30">
                <span className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan to-purple opacity-85 z-5" />
                <div className="flex flex-col gap-2 mb-0">
                  <label className="font-mono text-[10px] font-bold text-gray uppercase tracking-[0.8px] flex justify-between items-center">
                    NAS OR EXTERNAL PATHWAY
                  </label>
                  <div className="flex gap-3">
                    <input
                      className="grow bg-bg-inner border border-tech-border rounded-inner text-white px-3.5 py-2.5 font-sans text-[12.5px] outline-none h-[38px] transition-all duration-200 focus:border-cyan focus:shadow-[0_0_8px_rgba(0,242,254,0.2)] placeholder:text-gray/35"
                      type="text"
                      placeholder="e.g. E:\Backups\Games or \\192.168.1.50\Saves"
                      value={localPath}
                      onChange={(e) => setLocalPath(e.target.value)}
                    />
                    <button
                      type="button"
                      className="inline-flex items-center justify-center gap-2 px-4 font-sans font-semibold text-[11.5px] rounded-inner cursor-pointer transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] h-8.5 border border-transparent select-none disabled:bg-tech-border/15 disabled:border-tech-border/20 disabled:text-gray/40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none bg-transparent border-tech-border text-purple hover:not-disabled:bg-purple/8 hover:not-disabled:border-purple hover:not-disabled:shadow-[0_0_10px_rgba(208,188,255,0.2)] hover:not-disabled:-translate-y-px active:not-disabled:translate-y-0"
                      onClick={() => handleBrowseDir(setLocalPath)}
                    >
                      BROWSE
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between w-full mt-3.5 border-t border-tech-border/20 pt-5">
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 px-4 font-sans font-semibold text-[11.5px] rounded-inner cursor-pointer transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] h-8.5 border select-none disabled:bg-tech-border/15 disabled:border-tech-border/20 disabled:text-gray/40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none bg-transparent border-tech-border text-purple hover:not-disabled:bg-purple/8 hover:not-disabled:border-purple hover:not-disabled:shadow-[0_0_10px_rgba(208,188,255,0.2)] hover:not-disabled:-translate-y-px active:not-disabled:translate-y-0"
                onClick={() => setOnboardingStep('welcome')}
              >
                BACK
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 px-4 font-sans font-semibold text-[11.5px] rounded-inner cursor-pointer transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] h-8.5 border border-transparent select-none disabled:bg-tech-border/15 disabled:border-tech-border/20 disabled:text-gray/40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none bg-cyan text-[#032021] shadow-[0_2px_8px_rgba(0,242,254,0.15)] hover:not-disabled:bg-[#33f5ff] hover:not-disabled:shadow-[0_0_12px_rgba(0,242,254,0.45)] hover:not-disabled:-translate-y-px active:not-disabled:translate-y-0"
                onClick={() => setOnboardingStep('settings')}
                disabled={(gitEnabled && !gitUrl.trim()) || (localEnabled && !localPath.trim())}
              >
                NEXT STEP
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: GLOBAL SETTINGS SLIDERS */}
        {onboardingStep === 'settings' && (
          <div className="w-full animate-fade-slide-in">
            <h3 className="text-[13.5px] font-bold tracking-[0.8px] text-purple uppercase text-center mb-2">
              PREFERENCES CONFIGURATION
            </h3>
            <p className="text-gray text-xs mt-1 text-center mb-5">
              Tune file watch bounds and backup triggers to match your disk limits and gaming
              patterns.
            </p>

            <div className="flex flex-col gap-2 mb-5">
              <label className="font-mono text-[10px] font-bold text-gray uppercase tracking-[0.8px] flex justify-between items-center">
                <span>MAX BACKUPS: {onboardMaxBackups} SLOTS</span>
              </label>
              <input
                type="range"
                min="2"
                max="50"
                value={onboardMaxBackups}
                onChange={(e) => setOnboardMaxBackups(parseInt(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--color-cyan)' }}
              />
              <p className="text-gray text-xs mt-0.5">
                Limit of historical ZIP files preserved per profile. Prunes older saves
                automatically.
              </p>
            </div>

            <div className="flex flex-col gap-2 mb-5">
              <label className="font-mono text-[10px] font-bold text-gray uppercase tracking-[0.8px] flex justify-between items-center">
                <span>DEBOUNCE SETTLE DELAY: {onboardDebounce} SECONDS</span>
              </label>
              <input
                type="range"
                min="2"
                max="30"
                value={onboardDebounce}
                onChange={(e) => setOnboardDebounce(parseInt(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--color-cyan)' }}
              />
              <p className="text-gray text-xs mt-0.5">
                Buffer duration before archiving game write events. Avoids conflicts during rapid
                game saves.
              </p>
            </div>

            <div className="flex flex-col gap-2 mb-3.5">
              <div className="flex justify-between items-center">
                <div>
                  <label className="font-mono text-[10px] font-bold text-gray uppercase tracking-[0.8px] flex justify-between items-center !text-[11.5px]">
                    LAUNCH MINIMIZED ON SYSTEM STARTUP
                  </label>
                  <p className="text-gray text-xs mt-0.5">
                    Launches AtlasSave quietly into system tray when computer boots.
                  </p>
                </div>
                <div
                  className="flex items-center gap-2.5 cursor-pointer select-none group"
                  onClick={() => setOnboardStartup(!onboardStartup)}
                >
                  <div
                    className={`w-10 h-[22px] bg-[#111a1b] border rounded-[11px] relative transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] group-hover:border-cyan ${
                      onboardStartup ? 'bg-green/15 border-green' : 'border-tech-border'
                    }`}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded-full absolute top-[3px] transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                        onboardStartup
                          ? 'bg-green left-[20px] shadow-[0_0_8px_var(--color-green)]'
                          : 'bg-gray left-[4px]'
                      }`}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between w-full mt-3.5 border-t border-tech-border/20 pt-5">
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 px-4 font-sans font-semibold text-[11.5px] rounded-inner cursor-pointer transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] h-8.5 border select-none disabled:bg-tech-border/15 disabled:border-tech-border/20 disabled:text-gray/40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none bg-transparent border-tech-border text-purple hover:not-disabled:bg-purple/8 hover:not-disabled:border-purple hover:not-disabled:shadow-[0_0_10px_rgba(208,188,255,0.2)] hover:not-disabled:-translate-y-px active:not-disabled:translate-y-0"
                onClick={() => setOnboardingStep('providers')}
              >
                BACK
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 px-4 font-sans font-semibold text-[11.5px] rounded-inner cursor-pointer transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] h-8.5 border border-transparent select-none disabled:bg-tech-border/15 disabled:border-tech-border/20 disabled:text-gray/40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none bg-cyan text-[#032021] shadow-[0_2px_8px_rgba(0,242,254,0.15)] hover:not-disabled:bg-[#33f5ff] hover:not-disabled:shadow-[0_0_12px_rgba(0,242,254,0.45)] hover:not-disabled:-translate-y-px active:not-disabled:translate-y-0"
                onClick={() => setOnboardingStep('ready')}
              >
                NEXT STEP
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: FINAL CONFIRMATION SUMMARY */}
        {onboardingStep === 'ready' && (
          <div className="w-full animate-fade-slide-in">
            <h3 className="text-[13.5px] font-bold tracking-[0.8px] text-green uppercase text-center mb-2">
              CONFIGURATION REVIEW
            </h3>
            <p className="text-gray text-xs mt-1 text-center mb-5">
              Confirm details before initializing the background file monitoring system.
            </p>

            <div className="bg-bg-card backdrop-blur-[12px] border border-tech-border rounded-card relative overflow-hidden shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] hover:border-cyan/25 hover:shadow-[0_8px_32px_0_rgba(0,242,254,0.05)] transition-all duration-250 p-[18px] bg-[#040808]/30 mb-5 flex flex-col gap-3">
              <span className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan to-purple opacity-85 z-5" />
              <div className="flex justify-between items-center border-b border-tech-border/15 pb-1.5">
                <span className="font-mono text-[10px] font-bold text-white uppercase tracking-[0.8px]">
                  BACKUP LOCATIONS
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-[11.5px]">
                  <span className="text-gray">Git Repository Sync:</span>
                  <span
                    style={{ color: gitEnabled ? 'var(--color-green)' : 'rgba(168,188,189,0.3)' }}
                  >
                    {gitEnabled ? 'ENABLED' : 'DISABLED'}
                  </span>
                </div>
                {gitEnabled && (
                  <div className="break-all font-mono text-[10px] text-purple">{gitUrl}</div>
                )}

                <div className="flex justify-between items-center text-[11.5px]">
                  <span className="text-gray">Local NAS pathway:</span>
                  <span
                    style={{ color: localEnabled ? 'var(--color-green)' : 'rgba(168,188,189,0.3)' }}
                  >
                    {localEnabled ? 'ENABLED' : 'DISABLED'}
                  </span>
                </div>
                {localEnabled && (
                  <div className="break-all font-mono text-[10px] text-purple">{localPath}</div>
                )}
              </div>

              <div className="flex justify-between items-center border-b border-tech-border/15 pb-1.5 mt-2">
                <span className="font-mono text-[10px] font-bold text-white uppercase tracking-[0.8px]">
                  SYSTEM PROPERTIES
                </span>
              </div>
              <div className="flex justify-between items-center text-[11px] text-gray">
                <span>
                  Max backups: <b className="text-white">{onboardMaxBackups}</b>
                </span>
                <span>
                  Debounce window: <b className="text-white">{onboardDebounce}s</b>
                </span>
                <span>
                  Autostart: <b className="text-white">{onboardStartup ? 'ON' : 'OFF'}</b>
                </span>
              </div>
            </div>

            <div className="flex justify-between w-full mt-3.5 border-t border-tech-border/20 pt-5">
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 px-4 font-sans font-semibold text-[11.5px] rounded-inner cursor-pointer transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] h-8.5 border select-none disabled:bg-tech-border/15 disabled:border-tech-border/20 disabled:text-gray/40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none bg-transparent border-tech-border text-purple hover:not-disabled:bg-purple/8 hover:not-disabled:border-purple hover:not-disabled:shadow-[0_0_10px_rgba(208,188,255,0.2)] hover:not-disabled:-translate-y-px active:not-disabled:translate-y-0"
                onClick={() => setOnboardingStep('settings')}
              >
                BACK
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 px-4 font-sans font-semibold text-[11.5px] rounded-inner cursor-pointer transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] h-8.5 border border-transparent select-none disabled:bg-tech-border/15 disabled:border-tech-border/20 disabled:text-gray/40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none bg-cyan text-[#032021] hover:not-disabled:bg-[#33f5ff] shadow-[0_0_15px_rgba(0,242,254,0.2)] hover:not-disabled:shadow-[0_0_15px_rgba(0,242,254,0.4)] [text-shadow:0_0_4px_rgba(0,242,254,0.4)] hover:not-disabled:-translate-y-px active:not-disabled:translate-y-0"
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
