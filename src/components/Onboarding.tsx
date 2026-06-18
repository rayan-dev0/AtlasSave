import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Config } from '../types';

interface OnboardingViewProps {
  onboardingStep: 'welcome' | 'profile' | 'providers' | 'settings' | 'ready';
  setOnboardingStep: (val: 'welcome' | 'profile' | 'providers' | 'settings' | 'ready') => void;

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

  // Extended Git settings
  gitUserName: string;
  setGitUserName: (val: string) => void;
  gitUserEmail: string;
  setGitUserEmail: (val: string) => void;
  gitSshKeyPath: string;
  setGitSshKeyPath: (val: string) => void;
  gitAcceptNewHosts: boolean;
  setAcceptNewHosts: (val: boolean) => void;
  gitSyncInterval: number;
  setGitSyncInterval: (val: number) => void;
  gitAutoFetch: boolean;
  setGitAutoFetch: (val: boolean) => void;

  // Extended Profile settings
  newProfileName: string;
  setNewProfileName: (val: string) => void;
  newProfilePath: string;
  setNewProfilePath: (val: string) => void;
  gameExePath: string;
  setGameExePath: (val: string) => void;
  detecting: boolean;
  detectionMessage: { text: string; isError: boolean } | null;
  handleBrowseFileAndDetect: () => void;
  loadConfig: () => Promise<void>;
  appendLocalLog: (msg: string) => void;
}

// Git URL helper functions
const buildGitUrl = (
  protocol: 'https' | 'ssh',
  host: string,
  owner: string,
  repo: string,
  token: string,
  sshUser: string = 'git'
) => {
  const cleanHost = host.trim();
  const cleanOwner = owner.trim();
  let cleanRepo = repo.trim();
  if (cleanRepo && !cleanRepo.endsWith('.git')) {
    cleanRepo = `${cleanRepo}.git`;
  }

  if (!cleanHost || !cleanOwner || !cleanRepo) return '';

  if (protocol === 'https') {
    if (token.trim()) {
      return `https://${cleanOwner}:${token.trim()}@${cleanHost}/${cleanOwner}/${cleanRepo}`;
    }
    return `https://${cleanHost}/${cleanOwner}/${cleanRepo}`;
  } else {
    const user = sshUser.trim() || 'git';
    return `${user}@${cleanHost}:${cleanOwner}/${cleanRepo}`;
  }
};

const parseGitUrl = (url: string) => {
  let protocol: 'https' | 'ssh' = 'https';
  let host = 'github.com';
  let owner = '';
  let repo = '';
  let token = '';
  let sshUser = 'git';

  const trimmed = url.trim();
  if (trimmed.startsWith('https://')) {
    protocol = 'https';
    const mainPart = trimmed.substring(8);
    const atIdx = mainPart.indexOf('@');
    if (atIdx !== -1) {
      const authPart = mainPart.substring(0, atIdx);
      const rest = mainPart.substring(atIdx + 1);

      const authSplits = authPart.split(':');
      if (authSplits.length >= 2) {
        token = authSplits[1];
      }

      const pathSplits = rest.split('/');
      if (pathSplits.length >= 3) {
        host = pathSplits[0];
        owner = pathSplits[1];
        repo = pathSplits.slice(2).join('/');
      }
    } else {
      const pathSplits = mainPart.split('/');
      if (pathSplits.length >= 3) {
        host = pathSplits[0];
        owner = pathSplits[1];
        repo = pathSplits.slice(2).join('/');
      }
    }
  } else if (trimmed.includes('@') && trimmed.includes(':')) {
    protocol = 'ssh';
    const atIdx = trimmed.indexOf('@');
    sshUser = trimmed.substring(0, atIdx);
    const rest = trimmed.substring(atIdx + 1);

    const colonIdx = rest.indexOf(':');
    if (colonIdx !== -1) {
      host = rest.substring(0, colonIdx);
      const path = rest.substring(colonIdx + 1);
      const pathSplits = path.split('/');
      if (pathSplits.length >= 2) {
        owner = pathSplits[0];
        repo = pathSplits.slice(1).join('/');
      } else {
        repo = path;
      }
    }
  }

  if (repo.endsWith('.git')) {
    repo = repo.substring(0, repo.length - 4);
  }

  return { protocol, host, owner, repo, token, sshUser };
};

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
  gitUserName,
  setGitUserName,
  gitUserEmail,
  setGitUserEmail,
  gitSshKeyPath,
  setGitSshKeyPath,
  gitAcceptNewHosts,
  setAcceptNewHosts,
  gitSyncInterval,
  setGitSyncInterval,
  gitAutoFetch,
  setGitAutoFetch,
  newProfileName,
  setNewProfileName,
  newProfilePath,
  setNewProfilePath,
  gameExePath,
  setGameExePath,
  detecting,
  detectionMessage,
  handleBrowseFileAndDetect,
  loadConfig,
  appendLocalLog,
}) => {
  const onboardingStepsList = [
    { id: 'welcome', label: 'Welcome' },
    { id: 'providers', label: 'Sync Config' },
    { id: 'profile', label: 'First Game' },
    { id: 'settings', label: 'Preferences' },
    { id: 'ready', label: 'Ready' },
  ];

  const currentStepIdx = onboardingStepsList.findIndex((s) => s.id === onboardingStep);

  // Split-fields parameters for Git URL assembly in onboarding
  const [gitInputMode, setGitInputMode] = useState<'url' | 'fields'>('url');
  const [fieldProtocol, setFieldProtocol] = useState<'https' | 'ssh'>('https');
  const [fieldHost, setFieldHost] = useState('github.com');
  const [fieldOwner, setFieldOwner] = useState('');
  const [fieldRepo, setFieldRepo] = useState('');
  const [fieldToken, setFieldToken] = useState('');
  const [fieldSshUser, setFieldSshUser] = useState('git');

  // Loader state for cloud import operations
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(
    null
  );

  // Keep Git URL synced
  useEffect(() => {
    if (gitInputMode === 'fields') {
      const compiled = buildGitUrl(
        fieldProtocol,
        fieldHost,
        fieldOwner,
        fieldRepo,
        fieldToken,
        fieldSshUser
      );
      setGitUrl(compiled);
    }
  }, [
    fieldProtocol,
    fieldHost,
    fieldOwner,
    fieldRepo,
    fieldToken,
    fieldSshUser,
    gitInputMode,
    setGitUrl,
  ]);

  useEffect(() => {
    if (gitInputMode === 'url' && gitUrl) {
      const parsed = parseGitUrl(gitUrl);
      setFieldProtocol(parsed.protocol);
      setFieldHost(parsed.host);
      setFieldOwner(parsed.owner);
      setFieldRepo(parsed.repo);
      setFieldToken(parsed.token);
      setFieldSshUser(parsed.sshUser);
    }
  }, [gitUrl, gitInputMode]);

  const [isCheckingProviders, setIsCheckingProviders] = useState(false);
  const [providerCheckError, setProviderCheckError] = useState<string | null>(null);

  const handleNextFromProviders = async () => {
    // If neither git nor local secondary is enabled, proceed normally
    if (!gitEnabled && !localEnabled) {
      setOnboardingStep('profile');
      return;
    }

    setIsCheckingProviders(true);
    setProviderCheckError(null);
    appendLocalLog('Checking configured sync targets for existing configurations...');

    try {
      let configImported = false;

      // 1. Check Git if enabled
      if (gitEnabled) {
        appendLocalLog('Attempting to import config from Git remote...');
        await invoke<string | null>('import_remote_git_config', {
          gitConfig: {
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
        });

        // Load config from backend to see if any profiles exist
        await loadConfig();
        const updatedConfig = await invoke<Config>('get_config');
        if (updatedConfig.profiles && updatedConfig.profiles.length > 0) {
          appendLocalLog(
            `[SUCCESS] Git remote configuration imported successfully! Found ${updatedConfig.profiles.length} profiles.`
          );
          configImported = true;
        }
      }

      // 2. Check local/NAS if enabled (and Git hasn't already imported a config)
      if (localEnabled && !configImported) {
        appendLocalLog('Attempting to import config from local backup directory...');
        await invoke<string | null>('import_local_backup_config', {
          destinationPath: localPath,
        });

        await loadConfig();
        const updatedConfig = await invoke<Config>('get_config');
        if (updatedConfig.profiles && updatedConfig.profiles.length > 0) {
          appendLocalLog(
            `[SUCCESS] Local backup configuration imported successfully! Found ${updatedConfig.profiles.length} profiles.`
          );
          configImported = true;
        }
      }

      if (configImported) {
        // If config was successfully imported and has profiles, we can immediately complete onboarding!
        appendLocalLog('Existing configuration found and restored. Booting straight to dashboard.');

        // Save the config to make sure the provider state (gitEnabled/localEnabled) matches what was checked/entered
        const currentConfig = await invoke<Config>('get_config');
        const updated = {
          ...currentConfig,
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
        await loadConfig();
      } else {
        // No existing config was found on Git/NAS. Proceed to first profile setup.
        appendLocalLog('No existing configuration found. Proceeding to create a new game profile.');
        setOnboardingStep('profile');
      }
    } catch (err) {
      appendLocalLog(`[WARNING] Failed to scan sync targets for config: ${err}`);
      setProviderCheckError(String(err));
      // Fallback: proceed to profile setup if checker encounters error so the user isn't hard-blocked
      setOnboardingStep('profile');
    } finally {
      setIsCheckingProviders(false);
    }
  };

  // Execute Git remote import and setup check
  const handleGitImportRestore = async () => {
    setIsImporting(true);
    setImportResult(null);
    appendLocalLog('Checking remote Git repository for existing AtlasSave configuration...');
    try {
      const result = await invoke<string | null>('import_remote_git_config', {
        gitConfig: {
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
      });

      if (result) {
        setImportResult({
          success: true,
          message: result,
        });
        appendLocalLog(`[SUCCESS] Git remote config imported: ${result}`);
      } else {
        setImportResult({
          success: true,
          message:
            'No existing configuration was found in the repository.\nCreated a fresh Git remote setup.',
        });
        appendLocalLog('[SUCCESS] Empty Git repository configured for future backups.');
      }

      // Reload configurations
      await loadConfig();

      // Complete onboarding and navigate to dashboard after a brief delay
      setTimeout(() => {
        handleCompleteOnboarding();
      }, 2000);
    } catch (err) {
      setImportResult({
        success: false,
        message: `Remote import failed:\n${err}`,
      });
      appendLocalLog(`[ERROR] Remote Git configuration import failed: ${err}`);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="flex flex-col justify-center items-center h-screen w-screen bg-bg-dark p-6 relative overflow-hidden select-none">
      {/* Background Animated Tech Lines & Nodes */}
      <div className="absolute inset-0 pointer-events-none opacity-15">
        <div className="absolute top-1/4 left-1/10 w-96 h-96 rounded-full bg-cyan/10 blur-[100px] animate-pulse-slow"></div>
        <div className="absolute bottom-1/3 right-1/10 w-[450px] h-[450px] rounded-full bg-purple/5 blur-[120px] animate-pulse-slow"></div>
        <div className="absolute top-0 left-0 right-0 bottom-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(0,242,254,0.08),rgba(0,0,0,0))]"></div>
      </div>

      {/* Main Container Card */}
      <div className="w-full max-w-[660px] max-h-[calc(100vh-60px)] bg-bg-card backdrop-blur-md border border-tech-border rounded-card p-8 shadow-[0_20px_50px_rgba(0,0,0,0.55)] flex flex-col items-center gap-6 relative overflow-y-auto scrollbar animate-fade-scale-in">
        {/* Glowing Top Cyber Accents */}
        <span className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-cyan via-purple to-green opacity-95 z-20" />

        {/* Stepper Progress bar */}
        <div className="w-full flex flex-col gap-3 shrink-0">
          <div className="flex justify-between items-center px-1">
            <span className="font-mono text-[9px] font-bold text-gray uppercase tracking-[1px]">
              Setup Progress
            </span>
            <span className="font-mono text-[10px] font-bold text-cyan">
              Step {currentStepIdx + 1} of {onboardingStepsList.length}
            </span>
          </div>

          <div className="flex justify-between w-full relative mb-1 px-1">
            <div className="absolute top-1/2 left-[4%] right-[4%] h-[2px] bg-tech-border/20 z-1 -translate-y-1/2"></div>
            <div
              className="absolute top-1/2 left-[4%] h-[2px] bg-gradient-to-r from-cyan to-purple z-1 -translate-y-1/2 transition-[width] duration-300 ease-in-out"
              style={{ width: `${(currentStepIdx / (onboardingStepsList.length - 1)) * 92}%` }}
            ></div>
            {onboardingStepsList.map((step, idx) => {
              const isCompleted = idx < currentStepIdx;
              const isActive = step.id === onboardingStep;
              return (
                <div
                  key={step.id}
                  className={`w-7 h-7 rounded-full bg-bg-inner border flex items-center justify-center font-mono text-[10px] font-bold z-10 transition-all duration-300 select-none
                    ${
                      isCompleted
                        ? 'border-green bg-green/10 text-green shadow-[0_0_8px_rgba(89,248,180,0.2)]'
                        : isActive
                          ? 'border-cyan bg-cyan/15 text-cyan shadow-[0_0_12px_rgba(0,242,254,0.35)] scale-110'
                          : 'border-tech-border text-gray/50'
                    }`}
                  title={step.label}
                >
                  {isCompleted ? '✓' : idx + 1}
                </div>
              );
            })}
          </div>
        </div>

        {/* STEP 1: WELCOME SCREEN */}
        {onboardingStep === 'welcome' && (
          <div className="w-full text-center py-4 flex flex-col items-center gap-6 animate-fade-slide-in">
            {/* Holographic Logo Sphere */}
            <div className="relative w-20 h-20 rounded-full bg-[#081516]/65 border border-cyan/35 flex items-center justify-center shadow-[0_0_30px_rgba(0,242,254,0.12)]">
              <div
                className="absolute inset-1 rounded-full border border-dashed border-cyan/20 animate-spin"
                style={{ animationDuration: '10s' }}
              />
              <svg
                className="text-cyan w-10 h-10 drop-shadow-[0_0_8px_rgba(0,242,254,0.55)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2.2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.599-3.75A11.952 11.952 0 0112 2.714z"
                />
              </svg>
            </div>

            <div className="flex flex-col gap-2">
              <h1 className="text-3xl font-black tracking-[4px] text-white [text-shadow:0_0_15px_rgba(255,255,255,0.12)] font-sans uppercase">
                ATLAS SAVE
              </h1>
              <span className="font-mono text-[9.5px] font-bold text-cyan tracking-[1.5px] uppercase">
                AUTOMATED GAME SAVE ARCHIVER
              </span>
            </div>

            <p className="text-gray text-[12.5px] leading-relaxed max-w-[480px] text-center font-sans text-gray/80">
              Sleek, background-safe, automated backup protection for your game saves. Protect your
              progress from file corruption using instant local archives and secure Git cloud
              versioning.
            </p>

            {/* Feature Highlights Grid */}
            <div className="grid grid-cols-3 gap-3 w-full max-w-[520px] mt-2">
              <div className="bg-bg-inner/45 border border-tech-border/20 p-3 rounded-inner flex flex-col gap-1 items-center">
                <span className="text-[11px] font-bold text-white font-sans">Debounced Watch</span>
                <span className="text-[9.5px] text-gray/65 text-center font-mono">
                  Locks file write collisions
                </span>
              </div>
              <div className="bg-bg-inner/45 border border-tech-border/20 p-3 rounded-inner flex flex-col gap-1 items-center">
                <span className="text-[11px] font-bold text-white font-sans">Multi-Saves</span>
                <span className="text-[9.5px] text-gray/65 text-center font-mono">
                  Infinite playthrough slots
                </span>
              </div>
              <div className="bg-bg-inner/45 border border-tech-border/20 p-3 rounded-inner flex flex-col gap-1 items-center">
                <span className="text-[11px] font-bold text-white font-sans">Cloud Sync</span>
                <span className="text-[9.5px] text-gray/65 text-center font-mono">
                  Secure Git / NAS pathways
                </span>
              </div>
            </div>

            <button
              type="button"
              className="mt-6 inline-flex items-center justify-center gap-2 px-6 font-sans font-bold rounded-inner cursor-pointer transition-all duration-250 select-none bg-cyan text-[#032021] shadow-[0_4px_14px_rgba(0,242,254,0.25)] hover:bg-[#33f5ff] hover:shadow-[0_0_20px_rgba(0,242,254,0.5)] hover:-translate-y-0.5 active:translate-y-0 h-10 w-full max-w-[240px] text-[12px] tracking-[0.5px]"
              onClick={() => setOnboardingStep('providers')}
            >
              INITIALIZE SETUP
            </button>
          </div>
        )}

        {/* STEP 2: FIRST GAME PROFILE SETUP */}
        {onboardingStep === 'profile' && (
          <div className="w-full flex flex-col gap-5 animate-fade-slide-in">
            <div className="text-center">
              <h3 className="text-sm font-bold tracking-[1px] text-purple uppercase">
                FIRST GAME PROFILE SETUP
              </h3>
              <p className="text-gray text-xs mt-1">
                Configure your first game save path to initialize monitoring.
              </p>
            </div>

            <div className="space-y-4">
              {/* Game Executable Selector (Optional but recommended for auto-detect) */}
              <div className="flex flex-col gap-1.5 bg-black/10 border border-tech-border/15 p-4 rounded-inner relative">
                <div className="flex justify-between items-center">
                  <label className="font-mono text-[9.5px] font-bold text-gray uppercase tracking-[0.5px]">
                    Game Executable Path (Optional)
                  </label>
                  <span className="font-mono text-[8.5px] text-purple/80">
                    Allows Auto-Detection
                  </span>
                </div>
                <div className="flex gap-2.5 mt-1.5">
                  <input
                    className="grow bg-bg-inner border border-tech-border rounded-inner text-white px-3 py-1.5 font-sans text-[12px] outline-none h-[34px] transition-all focus:border-cyan focus:shadow-[0_0_8px_rgba(0,242,254,0.15)] placeholder:text-gray/25"
                    type="text"
                    placeholder="e.g. C:\Program Files (x86)\Steam\steamapps\common\Hades\Hades.exe"
                    value={gameExePath}
                    onChange={(e) => setGameExePath(e.target.value)}
                  />
                  <button
                    type="button"
                    className="inline-flex items-center justify-center gap-1.5 px-4 font-sans font-bold text-[10.5px] rounded-inner cursor-pointer transition-all border border-tech-border bg-transparent text-purple hover:bg-purple/5 hover:border-purple h-[34px]"
                    onClick={handleBrowseFileAndDetect}
                    disabled={detecting}
                  >
                    {detecting ? 'SCANNING...' : 'BROWSE & SCAN'}
                  </button>
                </div>
              </div>

              {/* Game Name input */}
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9.5px] font-bold text-gray/80 uppercase tracking-[0.5px]">
                  Game Name
                </label>
                <input
                  className="w-full bg-bg-inner border border-tech-border rounded-inner text-white px-3.5 py-2 font-sans text-[12.5px] outline-none h-[38px] transition-all focus:border-cyan focus:shadow-[0_0_8px_rgba(0,242,254,0.15)] placeholder:text-gray/25"
                  type="text"
                  placeholder="e.g. Hades"
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                />
              </div>

              {/* Save Directory input */}
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9.5px] font-bold text-gray/80 uppercase tracking-[0.5px]">
                  Game Save Directory Path
                </label>
                <div className="flex gap-2.5">
                  <input
                    className="grow bg-bg-inner border border-tech-border rounded-inner text-white px-3.5 py-2 font-sans text-[12.5px] outline-none h-[38px] transition-all focus:border-cyan focus:shadow-[0_0_8px_rgba(0,242,254,0.15)] placeholder:text-gray/25"
                    type="text"
                    placeholder="e.g. C:\Users\Username\Documents\My Games\Hades"
                    value={newProfilePath}
                    onChange={(e) => setNewProfilePath(e.target.value)}
                  />
                  <button
                    type="button"
                    className="inline-flex items-center justify-center px-4 font-sans font-bold text-[11px] rounded-inner cursor-pointer transition-all border border-tech-border bg-transparent text-purple hover:bg-purple/5 hover:border-purple h-[38px]"
                    onClick={() => handleBrowseDir(setNewProfilePath)}
                  >
                    BROWSE
                  </button>
                </div>
              </div>

              {/* Auto-detect Feedback Message banner */}
              {detectionMessage && (
                <div
                  className={`border rounded-inner p-3 text-[11px] font-sans flex items-start gap-2.5 transition-all
                    ${
                      detectionMessage.isError
                        ? 'border-crimson/35 bg-crimson/5 text-crimson'
                        : 'border-green/35 bg-green/5 text-green shadow-[0_0_10px_rgba(89,248,180,0.05)]'
                    }`}
                >
                  <span className="font-bold select-none">
                    {detectionMessage.isError ? '✕' : '✓'}
                  </span>
                  <p className="leading-normal">{detectionMessage.text}</p>
                </div>
              )}
            </div>

            {/* Step Navigation Actions */}
            <div className="flex justify-between w-full mt-4 border-t border-tech-border/15 pt-5">
              <button
                type="button"
                className="inline-flex items-center justify-center px-4 font-sans font-semibold text-[11px] rounded-inner cursor-pointer transition-all border border-tech-border bg-transparent text-purple hover:bg-purple/5 hover:border-purple h-[34px]"
                onClick={() => setOnboardingStep('providers')}
              >
                BACK
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center px-5 font-sans font-bold text-[11px] rounded-inner cursor-pointer transition-all bg-cyan text-[#032021] hover:bg-[#33f5ff] disabled:bg-tech-border/10 disabled:border-tech-border/15 disabled:text-gray/45 disabled:cursor-not-allowed h-[34px]"
                onClick={() => setOnboardingStep('settings')}
                disabled={!newProfileName.trim() || !newProfilePath.trim()}
              >
                NEXT STEP
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: BACKUP SYNC TARGETS (PROVIDERS) */}
        {onboardingStep === 'providers' && (
          <div className="w-full flex flex-col gap-5 animate-fade-slide-in">
            <div className="text-center">
              <h3 className="text-sm font-bold tracking-[1px] text-purple uppercase">
                CHOOSE SYNC BACKUP TARGETS
              </h3>
              <p className="text-gray text-xs mt-1">
                Configure cloud syncing (Git) or external storage paths (NAS / Local Drive).
              </p>
            </div>

            <div className="space-y-4">
              {/* Git Cloud Provider Card */}
              <div
                className={`border rounded-inner transition-all duration-250 hover:border-cyan/45 ${
                  gitEnabled
                    ? 'border-cyan bg-cyan/[0.03] shadow-[0_0_15px_rgba(0,242,254,0.03)]'
                    : 'border-tech-border/40 bg-bg-inner/20'
                }`}
              >
                {/* Header Toggle area */}
                <div
                  className="p-4 flex items-center justify-between cursor-pointer"
                  onClick={() => setGitEnabled(!gitEnabled)}
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`p-1.5 rounded-inner ${gitEnabled ? 'text-cyan bg-cyan/10' : 'text-gray/50'}`}
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        viewBox="0 0 24 24"
                      >
                        <circle cx="18" cy="18" r="3" />
                        <circle cx="6" cy="6" r="3" />
                        <circle cx="6" cy="18" r="3" />
                        <path d="M18 15V9a4 4 0 0 0-4-4H9" />
                        <line x1="6" y1="9" x2="6" y2="15" />
                      </svg>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold text-[13px] text-white">
                        Git Version Control Repository
                      </span>
                      <span className="text-[10.5px] text-gray/65">
                        Commit backups incrementally into GitHub or private Git repos
                      </span>
                    </div>
                  </div>
                  <div
                    className={`w-9 h-5 rounded-[10px] border relative transition-all duration-200 ${gitEnabled ? 'bg-green/15 border-green' : 'bg-bg-inner border-tech-border/50'}`}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded-full absolute top-[2px] transition-all duration-200 ${gitEnabled ? 'bg-green left-[17px] shadow-[0_0_6px_var(--color-green)]' : 'bg-gray/60 left-[3px]'}`}
                    />
                  </div>
                </div>

                {/* Expanded Git Forms */}
                {gitEnabled && (
                  <div className="px-4 pb-5 pt-2 border-t border-tech-border/15 space-y-4 bg-black/10 animate-[fadeIn_0.25s_ease-out]">
                    <div className="flex justify-between items-center">
                      <label className="font-mono text-[9.5px] font-bold text-gray uppercase tracking-[0.5px]">
                        Repository Address
                      </label>
                      <div className="flex border border-tech-border rounded-inner overflow-hidden h-[24px]">
                        <button
                          type="button"
                          className={`px-2.5 font-sans font-bold text-[8.5px] transition-colors cursor-pointer ${gitInputMode === 'url' ? 'bg-cyan/15 text-cyan' : 'text-gray/50 hover:text-white bg-transparent'}`}
                          onClick={() => setGitInputMode('url')}
                        >
                          RAW URL
                        </button>
                        <button
                          type="button"
                          className={`px-2.5 font-sans font-bold text-[8.5px] transition-colors cursor-pointer border-l border-tech-border ${gitInputMode === 'fields' ? 'bg-cyan/15 text-cyan' : 'text-gray/50 hover:text-white bg-transparent'}`}
                          onClick={() => setGitInputMode('fields')}
                        >
                          SPLIT FIELDS
                        </button>
                      </div>
                    </div>

                    {gitInputMode === 'url' ? (
                      <input
                        className="w-full bg-bg-inner border border-tech-border rounded-inner text-white py-2 px-3 font-sans text-[12px] outline-none h-[34px] transition-all focus:border-cyan"
                        type="text"
                        placeholder="e.g. git@github.com:username/save-backups.git"
                        value={gitUrl}
                        onChange={(e) => setGitUrl(e.target.value)}
                      />
                    ) : (
                      <div className="grid grid-cols-2 gap-3 bg-black/20 p-3.5 border border-tech-border/20 rounded-inner text-[11px]">
                        <div className="flex flex-col gap-1 col-span-2">
                          <span className="font-mono text-[8.5px] font-bold text-gray uppercase tracking-[0.5px]">
                            Protocol
                          </span>
                          <div className="flex border border-tech-border rounded-inner overflow-hidden h-[26px] w-fit">
                            <button
                              type="button"
                              className={`px-3 font-sans font-bold text-[9px] transition-colors cursor-pointer ${fieldProtocol === 'https' ? 'bg-cyan/15 text-cyan' : 'text-gray/50 hover:text-white bg-transparent'}`}
                              onClick={() => setFieldProtocol('https')}
                            >
                              HTTPS
                            </button>
                            <button
                              type="button"
                              className={`px-3 font-sans font-bold text-[9px] transition-colors cursor-pointer border-l border-tech-border ${fieldProtocol === 'ssh' ? 'bg-cyan/15 text-cyan' : 'text-gray/50 hover:text-white bg-transparent'}`}
                              onClick={() => setFieldProtocol('ssh')}
                            >
                              SSH
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="font-mono text-[8.5px] font-bold text-gray/80 uppercase">
                            Host Domain
                          </label>
                          <input
                            type="text"
                            className="bg-bg-inner border border-tech-border rounded-inner text-white py-1 px-2.5 font-sans h-[30px] outline-none focus:border-cyan"
                            value={fieldHost}
                            onChange={(e) => setFieldHost(e.target.value)}
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="font-mono text-[8.5px] font-bold text-gray/80 uppercase">
                            Owner/User
                          </label>
                          <input
                            type="text"
                            className="bg-bg-inner border border-tech-border rounded-inner text-white py-1 px-2.5 font-sans h-[30px] outline-none focus:border-cyan"
                            placeholder="username"
                            value={fieldOwner}
                            onChange={(e) => setFieldOwner(e.target.value)}
                          />
                        </div>

                        <div className="flex flex-col gap-1 col-span-2">
                          <label className="font-mono text-[8.5px] font-bold text-gray/80 uppercase">
                            Repository Name
                          </label>
                          <input
                            type="text"
                            className="bg-bg-inner border border-tech-border rounded-inner text-white py-1 px-2.5 font-sans h-[30px] outline-none focus:border-cyan"
                            placeholder="saves-repo (excluding .git)"
                            value={fieldRepo}
                            onChange={(e) => setFieldRepo(e.target.value)}
                          />
                        </div>

                        {fieldProtocol === 'https' ? (
                          <div className="flex flex-col gap-1 col-span-2">
                            <label className="font-mono text-[8.5px] font-bold text-gray/80 uppercase">
                              Personal Access Token (PAT)
                            </label>
                            <input
                              type="password"
                              className="bg-bg-inner border border-tech-border rounded-inner text-white py-1 px-2.5 font-sans h-[30px] outline-none focus:border-cyan placeholder:text-gray/25"
                              placeholder="ghp_... (PAT is recommended for private repos)"
                              value={fieldToken}
                              onChange={(e) => setFieldToken(e.target.value)}
                            />
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1 col-span-2">
                            <label className="font-mono text-[8.5px] font-bold text-gray/80 uppercase">
                              SSH Username
                            </label>
                            <input
                              type="text"
                              className="bg-bg-inner border border-tech-border rounded-inner text-white py-1 px-2.5 font-sans h-[30px] outline-none focus:border-cyan"
                              value={fieldSshUser}
                              onChange={(e) => setFieldSshUser(e.target.value)}
                            />
                          </div>
                        )}

                        <div className="col-span-2 mt-1 border-t border-tech-border/10 pt-2 font-mono text-[9px] text-cyan break-all bg-black/30 p-2 rounded-inner border border-tech-border/15">
                          Compiled: {gitUrl || '(complete fields above)'}
                        </div>
                      </div>
                    )}

                    {/* Standard Settings Row */}
                    <div className="grid grid-cols-2 gap-3.5">
                      <div className="flex flex-col gap-1">
                        <label className="font-mono text-[9px] font-bold text-gray/80 uppercase">
                          Sync Branch
                        </label>
                        <input
                          className="bg-bg-inner border border-tech-border rounded-inner text-white py-1 px-2.5 font-sans h-[32px] outline-none focus:border-cyan"
                          type="text"
                          value={gitBranch}
                          onChange={(e) => setGitBranch(e.target.value)}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="font-mono text-[9px] font-bold text-gray/80 uppercase">
                          Sync Frequency
                        </label>
                        <select
                          className="bg-bg-inner border border-tech-border rounded-inner text-white py-1 px-2.5 font-sans h-[32px] outline-none focus:border-cyan text-[11.5px]"
                          value={gitSyncInterval}
                          onChange={(e) => setGitSyncInterval(Number(e.target.value))}
                        >
                          <option value={0}>Real-time (On Save Write)</option>
                          <option value={5}>Every 5 minutes</option>
                          <option value={15}>Every 15 minutes</option>
                          <option value={30}>Every 30 minutes</option>
                          <option value={999999}>Manual Sync Only</option>
                        </select>
                      </div>
                    </div>

                    {/* Advanced Git Collapse Area */}
                    <details className="border border-tech-border/15 rounded-inner bg-bg-inner/25 p-3 cursor-pointer group">
                      <summary className="font-mono text-[10px] font-bold text-purple outline-none flex items-center justify-between select-none">
                        <span>ADVANCED GIT & CREDENTIALS</span>
                        <svg
                          className="w-3.5 h-3.5 transition-transform duration-250 group-open:rotate-180"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                          />
                        </svg>
                      </summary>
                      <div
                        className="mt-3.5 space-y-3.5 border-t border-tech-border/10 pt-3 cursor-default"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="grid grid-cols-2 gap-3.5">
                          <div className="flex flex-col gap-1">
                            <label className="font-mono text-[9px] font-bold text-gray/80 uppercase">
                              Commit Author Name
                            </label>
                            <input
                              className="bg-bg-inner border border-tech-border rounded-inner text-white py-1 px-2.5 font-sans h-[32px] outline-none focus:border-cyan"
                              type="text"
                              placeholder="AtlasSave Bot"
                              value={gitUserName}
                              onChange={(e) => setGitUserName(e.target.value)}
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="font-mono text-[9px] font-bold text-gray/80 uppercase">
                              Commit Author Email
                            </label>
                            <input
                              className="bg-bg-inner border border-tech-border rounded-inner text-white py-1 px-2.5 font-sans h-[32px] outline-none focus:border-cyan"
                              type="email"
                              placeholder="bot@atlassave.local"
                              value={gitUserEmail}
                              onChange={(e) => setGitUserEmail(e.target.value)}
                            />
                          </div>
                        </div>

                        {fieldProtocol === 'ssh' && (
                          <div className="flex flex-col gap-1">
                            <label className="font-mono text-[9px] font-bold text-gray/80 uppercase">
                              Custom SSH Private Key Path
                            </label>
                            <div className="flex gap-2">
                              <input
                                className="grow bg-bg-inner border border-tech-border rounded-inner text-white py-1 px-2.5 font-mono text-[11px] h-[32px] outline-none focus:border-cyan"
                                type="text"
                                placeholder="C:\Users\Username\.ssh\id_ed25519"
                                value={gitSshKeyPath}
                                onChange={(e) => setGitSshKeyPath(e.target.value)}
                              />
                              <button
                                type="button"
                                className="px-3 border border-tech-border rounded-inner text-purple bg-transparent font-sans font-bold text-[10px] hover:border-purple h-[32px]"
                                onClick={async () => {
                                  const selected = await invoke<string | null>(
                                    'select_ssh_key_file'
                                  );
                                  if (selected) {
                                    setGitSshKeyPath(selected);
                                  }
                                }}
                              >
                                BROWSE
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-3.5 pt-1">
                          <div className="flex items-center justify-between bg-black/15 p-2 rounded-inner border border-tech-border/10">
                            <span className="font-mono text-[9px] font-bold text-gray uppercase">
                              Auto-Fetch Remote
                            </span>
                            <input
                              type="checkbox"
                              className="w-4 h-4 accent-cyan cursor-pointer"
                              checked={gitAutoFetch}
                              onChange={(e) => setGitAutoFetch(e.target.checked)}
                            />
                          </div>
                          <div className="flex items-center justify-between bg-black/15 p-2 rounded-inner border border-tech-border/10">
                            <span className="font-mono text-[9px] font-bold text-gray uppercase">
                              Auto-Accept Hosts
                            </span>
                            <input
                              type="checkbox"
                              className="w-4 h-4 accent-cyan cursor-pointer"
                              checked={gitAcceptNewHosts}
                              onChange={(e) => setAcceptNewHosts(e.target.checked)}
                            />
                          </div>
                        </div>
                      </div>
                    </details>

                    {/* Test Connection Button */}
                    <div className="flex items-center justify-between border-t border-tech-border/10 pt-3">
                      <button
                        type="button"
                        className="inline-flex items-center justify-center gap-1.5 px-4 h-[30px] font-sans font-semibold rounded-inner cursor-pointer border border-tech-border bg-transparent text-purple hover:bg-purple/5 hover:border-purple disabled:opacity-40"
                        onClick={handleTestGit}
                        disabled={gitTesting || !gitUrl.trim()}
                      >
                        {gitTesting ? 'TESTING...' : 'TEST CONNECTION'}
                      </button>
                      {gitTestStatus && (
                        <span
                          className={`font-mono font-bold text-[10px] uppercase tracking-[0.5px] max-w-[65%] truncate ${
                            gitTestStatus.startsWith('Git Connection Successful') ||
                            gitTestStatus.includes('Successful')
                              ? 'text-green'
                              : 'text-crimson'
                          }`}
                          title={gitTestStatus}
                        >
                          {gitTestStatus}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Local NAS/Drive Provider Card */}
              <div
                className={`border rounded-inner transition-all duration-250 hover:border-cyan/45 ${
                  localEnabled
                    ? 'border-cyan bg-cyan/[0.03] shadow-[0_0_15px_rgba(0,242,254,0.03)]'
                    : 'border-tech-border/40 bg-bg-inner/20'
                }`}
              >
                <div
                  className="p-4 flex items-center justify-between cursor-pointer"
                  onClick={() => setLocalEnabled(!localEnabled)}
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`p-1.5 rounded-inner ${localEnabled ? 'text-cyan bg-cyan/10' : 'text-gray/50'}`}
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5.25 14.25h13.5m-13.5 3h13.5m-16.5-6h19.5v9A1.5 1.5 0 0121 21.75H3A1.5 1.5 0 011.5 20.25v-9zm0-3.75A1.5 1.5 0 013 5.25h4.5a1.5 1.5 0 011.5 1.5v2.25H1.5V6.75z"
                        />
                      </svg>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold text-[13px] text-white">
                        Local NAS or Secondary Drive Copy
                      </span>
                      <span className="text-[10.5px] text-gray/65">
                        Export backups automatically to E:\Backups or Local LAN network shares
                      </span>
                    </div>
                  </div>
                  <div
                    className={`w-9 h-5 rounded-[10px] border relative transition-all duration-200 ${localEnabled ? 'bg-green/15 border-green' : 'bg-bg-inner border-tech-border/50'}`}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded-full absolute top-[2px] transition-all duration-200 ${localEnabled ? 'bg-green left-[17px] shadow-[0_0_6px_var(--color-green)]' : 'bg-gray/60 left-[3px]'}`}
                    />
                  </div>
                </div>

                {localEnabled && (
                  <div className="px-4 pb-5 pt-3 border-t border-tech-border/15 space-y-2.5 bg-black/10 animate-[fadeIn_0.25s_ease-out]">
                    <label className="font-mono text-[9.5px] font-bold text-gray uppercase tracking-[0.5px]">
                      Destination Folder Path
                    </label>
                    <div className="flex gap-2.5">
                      <input
                        className="grow bg-bg-inner border border-tech-border rounded-inner text-white px-3 py-1.5 font-sans text-[12.5px] outline-none h-[36px] transition-all focus:border-cyan"
                        type="text"
                        placeholder="e.g. E:\Backups\GameSaves"
                        value={localPath}
                        onChange={(e) => setLocalPath(e.target.value)}
                      />
                      <button
                        type="button"
                        className="inline-flex items-center justify-center px-4 font-sans font-semibold text-[11px] rounded-inner cursor-pointer transition-all border border-tech-border bg-transparent text-purple hover:bg-purple/5 hover:border-purple h-[36px]"
                        onClick={() => handleBrowseDir(setLocalPath)}
                      >
                        BROWSE
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Connection Check Error Banner */}
            {providerCheckError && (
              <div className="w-full border border-crimson/35 bg-crimson/5 text-crimson rounded-inner p-3 text-[11px] font-sans flex items-start gap-2.5 mt-2">
                <span className="font-bold select-none">✕</span>
                <p className="leading-normal">{providerCheckError}</p>
              </div>
            )}

            {/* Step Navigation Actions */}
            <div className="flex justify-between w-full mt-4 border-t border-tech-border/15 pt-5">
              <button
                type="button"
                className="inline-flex items-center justify-center px-4 font-sans font-semibold text-[11px] rounded-inner cursor-pointer transition-all border border-tech-border bg-transparent text-purple hover:bg-purple/5 hover:border-purple h-[34px] disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={() => setOnboardingStep('welcome')}
                disabled={isCheckingProviders}
              >
                BACK
              </button>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  className="inline-flex items-center justify-center px-4 font-sans font-semibold text-[11px] rounded-inner cursor-pointer transition-all border border-tech-border bg-transparent text-gray hover:bg-white/5 h-[34px] disabled:opacity-40 disabled:cursor-not-allowed"
                  onClick={() => {
                    setGitEnabled(false);
                    setLocalEnabled(false);
                    setOnboardingStep('profile');
                  }}
                  disabled={isCheckingProviders}
                >
                  SKIP
                </button>
                <button
                  type="button"
                  className="inline-flex items-center justify-center px-5 font-sans font-bold text-[11px] rounded-inner cursor-pointer transition-all bg-cyan text-[#032021] hover:bg-[#33f5ff] disabled:bg-tech-border/10 disabled:border-tech-border/15 disabled:text-gray/45 disabled:cursor-not-allowed h-[34px]"
                  onClick={handleNextFromProviders}
                  disabled={
                    (gitEnabled && !gitUrl.trim()) ||
                    (localEnabled && !localPath.trim()) ||
                    isCheckingProviders
                  }
                >
                  {isCheckingProviders ? 'CHECKING...' : 'NEXT STEP'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: PREFERENCES CONFIGURATION */}
        {onboardingStep === 'settings' && (
          <div className="w-full flex flex-col gap-6 animate-fade-slide-in">
            <div className="text-center">
              <h3 className="text-sm font-bold tracking-[1px] text-purple uppercase">
                TUNING & PREFERENCES
              </h3>
              <p className="text-gray text-xs mt-1">
                Configure archive size caps and debounce limits for background operations.
              </p>
            </div>

            <div className="space-y-6">
              {/* Max Backups Range Slider */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <label className="font-mono text-[10px] font-bold text-gray uppercase tracking-[0.5px]">
                    Max Backups Slots
                  </label>
                  <span className="font-mono text-[11.5px] font-bold text-cyan">
                    {onboardMaxBackups} Archives
                  </span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="50"
                  value={onboardMaxBackups}
                  onChange={(e) => setOnboardMaxBackups(parseInt(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--color-cyan)' }}
                />
                <p className="text-gray/70 text-[10.5px] leading-normal">
                  Sets the limit of backup slots preserved per game profile. Older file archives are
                  auto-pruned.
                </p>
              </div>

              {/* Debounce Duration Range Slider */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <label className="font-mono text-[10px] font-bold text-gray uppercase tracking-[0.5px]">
                    Debounce Settle Window
                  </label>
                  <span className="font-mono text-[11.5px] font-bold text-cyan">
                    {onboardDebounce} Seconds
                  </span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="30"
                  value={onboardDebounce}
                  onChange={(e) => setOnboardDebounce(parseInt(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--color-cyan)' }}
                />
                <p className="text-gray/70 text-[10.5px] leading-normal">
                  Idle delay AtlasSave waits after a file write occurs to avoid conflicts during
                  rapid save intervals.
                </p>
              </div>

              {/* Startup Toggle Switch */}
              <div className="flex items-center justify-between p-3.5 bg-black/15 border border-tech-border/10 rounded-inner">
                <div className="flex flex-col gap-0.5 max-w-[80%]">
                  <label className="font-sans font-bold text-[12.5px] text-white">
                    Autostart on Boot (Minimized to Tray)
                  </label>
                  <p className="text-gray/70 text-[10.5px] leading-normal">
                    Quietly launch AtlasSave directly into the taskbar system tray on startup.
                  </p>
                </div>
                <div
                  className="flex items-center cursor-pointer select-none group"
                  onClick={() => setOnboardStartup(!onboardStartup)}
                >
                  <div
                    className={`w-9 h-5 rounded-[10px] border relative transition-all duration-200 ${onboardStartup ? 'bg-green/15 border-green' : 'bg-bg-inner border-tech-border'}`}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded-full absolute top-[2px] transition-all duration-200 ${onboardStartup ? 'bg-green left-[17px] shadow-[0_0_6px_var(--color-green)]' : 'bg-gray/60 left-[3px]'}`}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Step Navigation Actions */}
            <div className="flex justify-between w-full mt-4 border-t border-tech-border/15 pt-5">
              <button
                type="button"
                className="inline-flex items-center justify-center px-4 font-sans font-semibold text-[11px] rounded-inner cursor-pointer transition-all border border-tech-border bg-transparent text-purple hover:bg-purple/5 hover:border-purple h-[34px]"
                onClick={() => setOnboardingStep('profile')}
              >
                BACK
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center px-5 font-sans font-bold text-[11px] rounded-inner cursor-pointer transition-all bg-cyan text-[#032021] hover:bg-[#33f5ff] h-[34px]"
                onClick={() => setOnboardingStep('ready')}
              >
                NEXT STEP
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: FINAL CONFIRMATION & LAUNCH (TECHNICAL TERMINAL THEME) */}
        {onboardingStep === 'ready' && (
          <div className="w-full flex flex-col gap-5 animate-fade-slide-in">
            <div className="text-center">
              <h3 className="text-sm font-bold tracking-[1px] text-green uppercase">
                CONFIGURATION SUMMARY
              </h3>
              <p className="text-gray text-xs mt-1">
                Confirm your configuration before launching the watcher engine.
              </p>
            </div>

            {/* Import State Overlays */}
            {isImporting ? (
              <div className="bg-[#040808]/90 border border-tech-border rounded-card p-8 flex flex-col items-center justify-center gap-4 py-10 shadow-[0_0_40px_rgba(0,242,254,0.08)]">
                <div className="relative w-10 h-10">
                  <div className="absolute inset-0 border-4 border-cyan/15 rounded-full" />
                  <div className="absolute inset-0 border-4 border-t-cyan rounded-full animate-spin" />
                </div>
                <div className="flex flex-col gap-1.5 text-center mt-2">
                  <span className="font-mono text-[11px] font-bold text-white uppercase tracking-[0.5px]">
                    Checking Remote Configuration...
                  </span>
                  <span className="text-[10px] text-gray/75 max-w-[400px] leading-relaxed">
                    Connecting to the Git remote repository, searching for config files, and
                    preparing local databases.
                  </span>
                </div>
              </div>
            ) : importResult ? (
              <div className="bg-[#040808]/95 border border-tech-border rounded-card p-6 flex flex-col items-center justify-center gap-4 text-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border ${
                    importResult.success
                      ? 'bg-green/10 text-green border-green/30'
                      : 'bg-crimson/10 text-crimson border-crimson/30'
                  }`}
                >
                  {importResult.success ? (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      viewBox="0 0 24 24"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      viewBox="0 0 24 24"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <span
                    className={`font-sans font-bold text-xs uppercase ${importResult.success ? 'text-green' : 'text-crimson'}`}
                  >
                    {importResult.success ? 'Import Complete' : 'Import Failed'}
                  </span>
                  <p className="text-[11px] text-gray/80 leading-normal max-w-[420px] whitespace-pre-line">
                    {importResult.message}
                  </p>
                </div>
                {!importResult.success && (
                  <button
                    type="button"
                    className="mt-2 px-5 h-8 font-sans font-bold text-[10.5px] rounded-inner cursor-pointer transition-all bg-cyan text-[#032021] hover:bg-[#33f5ff]"
                    onClick={() => setImportResult(null)}
                  >
                    DISMISS
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Code Terminal Display */}
                <div className="bg-[#030606]/95 border border-tech-border/65 rounded-inner relative overflow-hidden font-mono text-[11px] p-4 text-gray leading-normal shadow-inner max-h-[260px] overflow-y-auto scrollbar">
                  <div className="absolute top-0 right-0 p-2 font-mono text-[8px] text-gray/30 tracking-wider">
                    CONFIG.JSON
                  </div>
                  <div className="space-y-1 select-all">
                    <div>
                      <span className="text-gray/40">01</span>{' '}
                      <span className="text-purple">{'{'}</span>
                    </div>
                    <div>
                      <span className="text-gray/40">02</span>{' '}
                      <span className="text-cyan">"profile"</span>:{' '}
                      <span className="text-purple">{'{'}</span>
                    </div>
                    <div>
                      <span className="text-gray/40">03</span>{' '}
                      <span className="text-cyan">"name"</span>:{' '}
                      <span className="text-green">"{newProfileName}"</span>,
                    </div>
                    <div>
                      <span className="text-gray/40">04</span>{' '}
                      <span className="text-cyan">"source_path"</span>:{' '}
                      <span className="text-green">"{newProfilePath.replace(/\\/g, '\\\\')}"</span>
                    </div>
                    <div>
                      <span className="text-gray/40">05</span>{' '}
                      <span className="text-purple">{'}'}</span>,
                    </div>
                    <div>
                      <span className="text-gray/40">06</span>{' '}
                      <span className="text-cyan">"providers"</span>:{' '}
                      <span className="text-purple">{'{'}</span>
                    </div>
                    <div>
                      <span className="text-gray/40">07</span>{' '}
                      <span className="text-cyan">"git"</span>:{' '}
                      <span className="text-purple">{'{'}</span>{' '}
                      <span className="text-cyan">"enabled"</span>:{' '}
                      <span className="text-yellow">{String(gitEnabled)}</span>,{' '}
                      <span className="text-cyan">"branch"</span>:{' '}
                      <span className="text-green">"{gitBranch}"</span>{' '}
                      <span className="text-purple">{'}'}</span>,
                    </div>
                    <div>
                      <span className="text-gray/40">08</span>{' '}
                      <span className="text-cyan">"local_backup"</span>:{' '}
                      <span className="text-purple">{'{'}</span>{' '}
                      <span className="text-cyan">"enabled"</span>:{' '}
                      <span className="text-yellow">{String(localEnabled)}</span>{' '}
                      <span className="text-purple">{'}'}</span>
                    </div>
                    <div>
                      <span className="text-gray/40">09</span>{' '}
                      <span className="text-purple">{'}'}</span>,
                    </div>
                    <div>
                      <span className="text-gray/40">10</span>{' '}
                      <span className="text-cyan">"global"</span>:{' '}
                      <span className="text-purple">{'{'}</span>
                    </div>
                    <div>
                      <span className="text-gray/40">11</span>{' '}
                      <span className="text-cyan">"max_backups"</span>:{' '}
                      <span className="text-yellow">{onboardMaxBackups}</span>,
                    </div>
                    <div>
                      <span className="text-gray/40">12</span>{' '}
                      <span className="text-cyan">"debounce_seconds"</span>:{' '}
                      <span className="text-yellow">{onboardDebounce}</span>,
                    </div>
                    <div>
                      <span className="text-gray/40">13</span>{' '}
                      <span className="text-cyan">"run_on_startup"</span>:{' '}
                      <span className="text-yellow">{String(onboardStartup)}</span>
                    </div>
                    <div>
                      <span className="text-gray/40">14</span>{' '}
                      <span className="text-purple">{'}'}</span>
                    </div>
                    <div>
                      <span className="text-gray/40">15</span>{' '}
                      <span className="text-purple">{'}'}</span>
                    </div>
                  </div>
                </div>

                {/* Confirm Options Block */}
                <div className="flex flex-col gap-2.5 mt-1">
                  {gitEnabled ? (
                    <div className="flex flex-col gap-2.5">
                      <button
                        type="button"
                        className="w-full inline-flex items-center justify-center gap-2 px-4 h-9 font-sans font-bold text-[11px] rounded-inner cursor-pointer transition-all bg-cyan text-[#032021] shadow-[0_4px_14px_rgba(0,242,254,0.2)] hover:bg-[#33f5ff] hover:shadow-[0_0_15px_rgba(0,242,254,0.45)] hover:-translate-y-0.5 active:translate-y-0"
                        onClick={handleGitImportRestore}
                      >
                        CHECK & IMPORT FROM REMOTE GIT
                      </button>
                      <button
                        type="button"
                        className="w-full inline-flex items-center justify-center gap-2 px-4 h-9 font-sans font-semibold rounded-inner cursor-pointer transition-all border border-tech-border bg-transparent text-purple hover:bg-purple/5 hover:border-purple"
                        onClick={handleCompleteOnboarding}
                      >
                        FRESH LOCAL CONFIGURATION LAUNCH
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="w-full inline-flex items-center justify-center gap-2 px-4 h-10 font-sans font-bold text-[12px] rounded-inner cursor-pointer transition-all bg-cyan text-[#032021] shadow-[0_4px_14px_rgba(0,242,254,0.2)] hover:bg-[#33f5ff] hover:shadow-[0_0_15px_rgba(0,242,254,0.45)] hover:-translate-y-0.5 active:translate-y-0"
                      onClick={handleCompleteOnboarding}
                    >
                      FINALIZE & RUN ATLAS SAVE
                    </button>
                  )}
                </div>

                {/* Back navigation */}
                <div className="flex justify-between w-full border-t border-tech-border/15 pt-4">
                  <button
                    type="button"
                    className="inline-flex items-center justify-center px-4 font-sans font-semibold text-[11px] rounded-inner cursor-pointer transition-all border border-tech-border bg-transparent text-purple hover:bg-purple/5 hover:border-purple h-[34px]"
                    onClick={() => setOnboardingStep('settings')}
                  >
                    BACK
                  </button>
                  <div />
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
