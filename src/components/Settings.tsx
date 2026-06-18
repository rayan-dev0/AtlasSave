import React, { useState, useEffect } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { GlobalConfig } from '../types';
import { THEMES } from '../libs/theme';

interface SettingsPanelProps {
  globalConfig: GlobalConfig;
  onSave: (
    maxBackups: number,
    debounce: number,
    startup: boolean,
    steamgriddbApiKey: string
  ) => void;
}

// Curated Inline SVG Icons for Visual Themes and Categories
const SystemIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    viewBox="0 0 24 24"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.1a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const PaintbrushIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    viewBox="0 0 24 24"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 14.7255 3.09032 17.1962 4.85857 19C5.32183 19.4633 6.00282 19.7891 6.64936 19.5305C7.29591 19.2719 7.55288 18.5714 7.55288 17.877C7.55288 16.288 8.84094 15 10.4299 15C11.1243 15 11.8248 15.257 12.0834 15.9035C12.342 16.5501 12.0162 17.2311 11.5529 17.6943C10.75 18.4972 10.25 19.4972 10.25 20.6139C10.25 21.3794 10.8716 22 11.6371 22H12Z" />
    <circle cx="7.5" cy="10.5" r="1.2" fill="currentColor" />
    <circle cx="11.5" cy="7.5" r="1.2" fill="currentColor" />
    <circle cx="16.5" cy="9.5" r="1.2" fill="currentColor" />
  </svg>
);

const BookOpenIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    viewBox="0 0 24 24"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </svg>
);

const InfoIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    viewBox="0 0 24 24"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

const ShieldLogoIcon: React.FC<{ className?: string }> = ({ className = 'w-16 h-16' }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    viewBox="0 0 24 24"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ globalConfig, onSave }) => {
  const [maxBackups, setMaxBackups] = useState(globalConfig.max_backups);
  const [debounceSeconds, setDebounceSeconds] = useState(globalConfig.debounce_seconds);
  const [runOnStartup, setRunOnStartup] = useState(globalConfig.run_on_startup);
  const [steamgriddbApiKey, setSteamgriddbApiKey] = useState(
    globalConfig.steamgriddb_api_key || ''
  );

  // Update checker states
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState<any | null>(null);

  const handleCheckForUpdates = async () => {
    setCheckingUpdate(true);
    setUpdateStatus('Contacting update server...');
    setUpdateAvailable(null);
    try {
      const updateResult = await check();
      if (updateResult) {
        setUpdateAvailable(updateResult);
        setUpdateStatus(`New update found: v${updateResult.version}`);
      } else {
        setUpdateStatus('AtlasSave is already running the latest version.');
      }
    } catch (err) {
      console.error(err);
      setUpdateStatus(`Update check failed: ${err}`);
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleInstallUpdate = async () => {
    if (!updateAvailable) return;
    setCheckingUpdate(true);
    setUpdateStatus('Downloading and installing update. App will restart...');
    try {
      await updateAvailable.downloadAndInstall();
      await relaunch();
    } catch (err) {
      console.error(err);
      setUpdateStatus(`Installation failed: ${err}`);
      setCheckingUpdate(false);
    }
  };

  // Tab State
  const [activeSubTab, setActiveSubTab] = useState<
    'general' | 'appearance' | 'help' | 'about text'
  >(
    () =>
      (localStorage.getItem('settings_subtab') as
        | 'general'
        | 'appearance'
        | 'help'
        | 'about text') || 'general'
  );

  // Theme State
  const [currentTheme, setCurrentTheme] = useState(
    () => localStorage.getItem('atlas_theme') || 'stitch'
  );

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
    setSteamgriddbApiKey(globalConfig.steamgriddb_api_key || '');
  }, [globalConfig]);

  const handleSubTabChange = (tab: 'general' | 'appearance' | 'help' | 'about text') => {
    setActiveSubTab(tab);
    localStorage.setItem('settings_subtab', tab);
  };

  const handleThemeChange = (themeName: string) => {
    setCurrentTheme(themeName);
    localStorage.setItem('atlas_theme', themeName);
    document.documentElement.className = themeName === 'stitch' ? '' : `theme-${themeName}`;
  };

  const toggleHelp = (key: string) => {
    setExpandedHelp((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="flex flex-col h-full min-h-0 select-none">
      {/* Title & Description Header Section */}
      <header className="mb-6 shrink-0 flex justify-between items-center flex-wrap gap-4">
        <div className="flex flex-col">
          <h1 className="text-[22px] font-bold tracking-[1.5px] text-white uppercase font-sans">
            Settings & System Hub
          </h1>
          <p className="text-gray text-xs mt-1">
            Configure parameters, customize visually, review guides, and inspect app info.
          </p>
        </div>
      </header>

      {/* Main Split-Pane Layout Area */}
      <div className="grow min-h-0 flex gap-6 pb-2">
        {/* Left Side: Directory Sidebar Navigation */}
        <div className="w-[230px] shrink-0 flex flex-col gap-3">
          {/* General Tab Button */}
          <button
            id="settings-tab-general"
            type="button"
            onClick={() => handleSubTabChange('general')}
            className={`w-full text-left p-4 rounded-card border transition-all duration-250 cursor-pointer flex flex-col gap-2 relative overflow-hidden group
              ${
                activeSubTab === 'general'
                  ? 'bg-cyan/5 border-cyan shadow-[0_0_12px_rgba(0,242,254,0.06)]'
                  : 'bg-bg-card/45 border-tech-border/40 hover:border-cyan/35 hover:bg-white/1'
              }`}
          >
            {activeSubTab === 'general' && (
              <span className="absolute top-0 left-0 bottom-0 w-[3px] bg-cyan" />
            )}
            <div className="flex items-center gap-3">
              <div
                className={`p-1.5 rounded-inner transition-colors duration-250 ${activeSubTab === 'general' ? 'text-cyan bg-cyan/10' : 'text-gray group-hover:text-cyan'}`}
              >
                <SystemIcon className="w-5 h-5" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[12.5px] font-bold tracking-[0.5px] text-white">
                  System Settings
                </span>
                <span className="text-[10px] text-gray truncate font-medium">
                  Limits & Debounce
                </span>
              </div>
            </div>
          </button>

          {/* Appearance Tab Button */}
          <button
            id="settings-tab-appearance"
            type="button"
            onClick={() => handleSubTabChange('appearance')}
            className={`w-full text-left p-4 rounded-card border transition-all duration-250 cursor-pointer flex flex-col gap-2 relative overflow-hidden group
              ${
                activeSubTab === 'appearance'
                  ? 'bg-cyan/5 border-cyan shadow-[0_0_12px_rgba(0,242,254,0.06)]'
                  : 'bg-bg-card/45 border-tech-border/40 hover:border-cyan/35 hover:bg-white/1'
              }`}
          >
            {activeSubTab === 'appearance' && (
              <span className="absolute top-0 left-0 bottom-0 w-[3px] bg-cyan" />
            )}
            <div className="flex items-center gap-3">
              <div
                className={`p-1.5 rounded-inner transition-colors duration-250 ${activeSubTab === 'appearance' ? 'text-cyan bg-cyan/10' : 'text-gray group-hover:text-cyan'}`}
              >
                <PaintbrushIcon className="w-5 h-5" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[12.5px] font-bold tracking-[0.5px] text-white">
                  Visual Themes
                </span>
                <span className="text-[10px] text-gray truncate font-medium">
                  App Styles & Colors
                </span>
              </div>
            </div>
          </button>

          {/* Help Tab Button */}
          <button
            id="settings-tab-help"
            type="button"
            onClick={() => handleSubTabChange('help')}
            className={`w-full text-left p-4 rounded-card border transition-all duration-250 cursor-pointer flex flex-col gap-2 relative overflow-hidden group
              ${
                activeSubTab === 'help'
                  ? 'bg-cyan/5 border-cyan shadow-[0_0_12px_rgba(0,242,254,0.06)]'
                  : 'bg-bg-card/45 border-tech-border/40 hover:border-cyan/35 hover:bg-white/1'
              }`}
          >
            {activeSubTab === 'help' && (
              <span className="absolute top-0 left-0 bottom-0 w-[3px] bg-cyan" />
            )}
            <div className="flex items-center gap-3">
              <div
                className={`p-1.5 rounded-inner transition-colors duration-250 ${activeSubTab === 'help' ? 'text-cyan bg-cyan/10' : 'text-gray group-hover:text-cyan'}`}
              >
                <BookOpenIcon className="w-5 h-5" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[12.5px] font-bold tracking-[0.5px] text-white">
                  Guides & Help
                </span>
                <span className="text-[10px] text-gray truncate font-medium">
                  Connection Support
                </span>
              </div>
            </div>
          </button>

          {/* About Tab Button */}
          <button
            id="settings-tab-about"
            type="button"
            onClick={() => handleSubTabChange('about text')}
            className={`w-full text-left p-4 rounded-card border transition-all duration-250 cursor-pointer flex flex-col gap-2 relative overflow-hidden group
              ${
                activeSubTab === 'about text'
                  ? 'bg-cyan/5 border-cyan shadow-[0_0_12px_rgba(0,242,254,0.06)]'
                  : 'bg-bg-card/45 border-tech-border/40 hover:border-cyan/35 hover:bg-white/1'
              }`}
          >
            {activeSubTab === 'about text' && (
              <span className="absolute top-0 left-0 bottom-0 w-[3px] bg-cyan" />
            )}
            <div className="flex items-center gap-3">
              <div
                className={`p-1.5 rounded-inner transition-colors duration-250 ${activeSubTab === 'about text' ? 'text-cyan bg-cyan/10' : 'text-gray group-hover:text-cyan'}`}
              >
                <InfoIcon className="w-5 h-5" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[12.5px] font-bold tracking-[0.5px] text-white">
                  About System
                </span>
                <span className="text-[10px] text-gray truncate font-medium">App Information</span>
              </div>
            </div>
          </button>
        </div>

        {/* Right Side: Active Setting Panel detail card */}
        <div className="flex-1 min-h-0 bg-[#090f10]/70 backdrop-blur-md border border-tech-border rounded-card flex flex-col overflow-hidden shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]">
          {/* Top Sticky Header */}
          <div className="shrink-0 p-5 border-b border-tech-border/20 bg-[#070b0c]/90 z-20 flex justify-between items-center">
            {activeSubTab === 'general' ? (
              <div className="flex-grow pr-4">
                <h2 className="text-sm font-bold tracking-[1.2px] text-white uppercase font-sans">
                  System Parameters
                </h2>
                <p className="text-[11px] text-gray mt-1">
                  Adjust maximum backup slots, settle delays, and startup options.
                </p>
              </div>
            ) : activeSubTab === 'appearance' ? (
              <div className="flex-grow pr-4">
                <h2 className="text-sm font-bold tracking-[1.2px] text-white uppercase font-sans">
                  Application Appearance
                </h2>
                <p className="text-[11px] text-gray mt-1">
                  Choose a custom theme palette and adjust cover art preferences.
                </p>
              </div>
            ) : activeSubTab === 'help' ? (
              <div className="flex-grow pr-4">
                <h2 className="text-sm font-bold tracking-[1.2px] text-white uppercase font-sans">
                  Help & Guides Hub
                </h2>
                <p className="text-[11px] text-gray mt-1">
                  Read connection guides, command structures, and rollback procedures.
                </p>
              </div>
            ) : (
              <div className="flex-grow pr-4">
                <h2 className="text-sm font-bold tracking-[1.2px] text-white uppercase font-sans">
                  About AtlasSave
                </h2>
                <p className="text-[11px] text-gray mt-1">
                  System versions, backend technologies, license metrics, and source links.
                </p>
              </div>
            )}
          </div>

          {/* Scrollable detail container */}
          <div className="grow min-h-0 relative flex flex-col bg-bg-inner/15">
            {/* Top Fade Overlay */}
            <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-[#090f10] to-transparent pointer-events-none z-10 opacity-80" />

            {/* Content Body */}
            <div className="grow overflow-y-auto px-6 py-5 space-y-6 scrollbar">
              {/* RENDER ACTIVE SUB-TAB */}
              {activeSubTab === 'general' && (
                <div className="space-y-6 animate-fade-in">
                  {/* Slider: Max Backups */}
                  <div className="bg-[#070c0c]/40 border border-tech-border/20 rounded-xl p-5 hover:border-cyan/15 transition-all duration-200">
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="font-mono text-[10.5px] font-bold text-gray uppercase tracking-[0.8px]">
                        MAX BACKUP SLOTS HELD (ROTATION BOUND)
                      </label>
                      <span className="font-mono text-xs font-black text-cyan px-2.5 py-0.5 rounded-full bg-cyan/10 border border-cyan/20">
                        {maxBackups} Slots
                      </span>
                    </div>
                    <input
                      type="range"
                      min="2"
                      max="100"
                      value={maxBackups}
                      onChange={(e) => setMaxBackups(parseInt(e.target.value))}
                      className="w-full"
                    />
                    <p className="text-gray/80 text-[11px] mt-1.5 leading-relaxed">
                      Prunes older ZIP archives automatically once slots for a game profile exceed
                      this limit.
                    </p>
                  </div>

                  {/* Slider: Debounce Delay */}
                  <div className="bg-[#070c0c]/40 border border-tech-border/20 rounded-xl p-5 hover:border-cyan/15 transition-all duration-200">
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="font-mono text-[10.5px] font-bold text-gray uppercase tracking-[0.8px]">
                        DEBOUNCE SETTLE DELAY
                      </label>
                      <span className="font-mono text-xs font-black text-cyan px-2.5 py-0.5 rounded-full bg-cyan/10 border border-cyan/20">
                        {debounceSeconds} Seconds
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="60"
                      value={debounceSeconds}
                      onChange={(e) => setDebounceSeconds(parseInt(e.target.value))}
                      className="w-full"
                    />
                    <p className="text-gray/80 text-[11px] mt-1.5 leading-relaxed">
                      Quiet period required after a save file change occurs to ensure the game has
                      finished its file writes.
                    </p>
                  </div>

                  {/* Toggle: Launch on Startup */}
                  <div className="bg-[#070c0c]/40 border border-tech-border/20 rounded-xl p-5 flex items-center justify-between hover:border-cyan/15 transition-all duration-200">
                    <div className="pr-4 flex-1">
                      <label className="font-mono text-[10.5px] font-bold text-gray uppercase tracking-[0.8px]">
                        LAUNCH ON SYSTEM STARTUP
                      </label>
                      <p className="text-gray/80 text-[11px] mt-1 leading-relaxed">
                        Start AtlasSave automatically minimized in the system tray on computer boot.
                      </p>
                    </div>
                    <div
                      className="flex items-center gap-2.5 cursor-pointer select-none group"
                      onClick={() => setRunOnStartup(!runOnStartup)}
                    >
                      <div
                        className={`w-10 h-[22px] rounded-[11px] border relative transition-all duration-250 ${
                          runOnStartup
                            ? 'bg-green/15 border-green'
                            : 'bg-bg-dark border-tech-border'
                        }`}
                      >
                        <div
                          className={`w-3.5 h-3.5 rounded-full absolute top-[3px] transition-all duration-250 ease-out ${
                            runOnStartup
                              ? 'bg-green left-[20px] shadow-[0_0_8px_var(--color-green)]'
                              : 'bg-gray/60 left-[4px]'
                          }`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* SteamGridDB API key & Providers */}
                  <div className="bg-[#070c0c]/40 border border-tech-border/20 rounded-xl p-5 hover:border-cyan/15 transition-all duration-200 space-y-4">
                    <div className="flex flex-col gap-0.5 border-b border-tech-border/10 pb-3">
                      <span className="text-[12px] font-bold text-white uppercase tracking-[0.5px]">
                        COVER ART & METADATA RESOLVERS
                      </span>
                      <p className="text-[11px] text-gray mt-0.5">
                        AtlasSave fetches game cover art dynamically. Free keyless providers are
                        active by default.
                      </p>
                    </div>

                    <div className="space-y-3">
                      {/* Providers Status */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="flex items-center justify-between px-3 py-2 border border-tech-border/10 rounded-lg bg-black/10">
                          <span className="font-semibold text-[11px] text-white">Steam Store</span>
                          <span className="font-mono text-[8px] font-bold px-2 py-0.5 rounded bg-green/10 text-green border border-green/20">
                            ACTIVE
                          </span>
                        </div>
                        <div className="flex items-center justify-between px-3 py-2 border border-tech-border/10 rounded-lg bg-black/10">
                          <span className="font-semibold text-[11px] text-white">GOG Catalog</span>
                          <span className="font-mono text-[8px] font-bold px-2 py-0.5 rounded bg-green/10 text-green border border-green/20">
                            ACTIVE
                          </span>
                        </div>
                        <div className="flex items-center justify-between px-3 py-2 border border-tech-border/10 rounded-lg bg-black/10">
                          <span className="font-semibold text-[11px] text-white">Epic GraphQL</span>
                          <span className="font-mono text-[8px] font-bold px-2 py-0.5 rounded bg-green/10 text-green border border-green/20">
                            ACTIVE
                          </span>
                        </div>
                      </div>

                      {/* SteamGridDB Card */}
                      <div className="p-4 border border-tech-border/15 rounded-lg bg-black/25 flex flex-col gap-3 mt-2">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="font-bold text-[12px] text-white">
                              SteamGridDB API Connection
                            </span>
                            <span className="text-[10.5px] text-gray leading-normal mt-0.5">
                              Access thousands of custom community game art and capsules.
                            </span>
                          </div>
                          <span
                            className={`font-mono text-[8px] font-bold px-2.5 py-0.5 rounded-full border ${
                              steamgriddbApiKey.trim()
                                ? 'bg-green/10 text-green border-green/30'
                                : 'bg-gray/5 text-gray border-tech-border/20'
                            }`}
                          >
                            {steamgriddbApiKey.trim() ? 'CONNECTED' : 'KEY REQUIRED'}
                          </span>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between font-mono text-[9px] font-bold text-gray uppercase tracking-[0.5px]">
                            <span>API KEY / TOKEN</span>
                            <a
                              href="https://www.steamgriddb.com/profile/preferences/api"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-cyan no-underline hover:underline hover:text-[#33f5ff] transition-all"
                            >
                              GET API KEY ↗
                            </a>
                          </div>
                          <input
                            type="password"
                            placeholder="Paste your personal SteamGridDB API key..."
                            value={steamgriddbApiKey}
                            onChange={(e) => setSteamgriddbApiKey(e.target.value)}
                            className="w-full bg-bg-inner border border-tech-border rounded-lg text-white py-2 px-3 font-sans text-[12.5px] outline-none h-[38px] transition-all duration-200 focus:border-cyan focus:shadow-[0_0_8px_rgba(0,242,254,0.2)] placeholder:text-gray/25"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action row */}
                  <div className="flex justify-between items-center border-t border-tech-border/20 pt-4 mt-2">
                    <span className="text-[10px] text-gray/55 font-mono">
                      * Unsaved changes are cached in active state memory.
                    </span>
                    <button
                      onClick={() =>
                        onSave(maxBackups, debounceSeconds, runOnStartup, steamgriddbApiKey)
                      }
                      className="inline-flex items-center justify-center gap-2 px-5 font-sans font-bold text-[12px] tracking-[0.5px] rounded-lg cursor-pointer transition-all duration-200 h-[38px] border border-transparent select-none bg-cyan text-[#032021] shadow-[0_2px_8px_rgba(0,242,254,0.15)] hover:bg-[#33f5ff] hover:shadow-[0_0_12px_rgba(0,242,254,0.45)] hover:-translate-y-px active:translate-y-0"
                    >
                      SAVE ALL SETTINGS
                    </button>
                  </div>
                </div>
              )}

              {activeSubTab === 'appearance' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
                    {THEMES.map((theme) => (
                      <div
                        key={theme.id}
                        className={`group border rounded-xl p-4 cursor-pointer transition-all duration-300 relative overflow-hidden flex flex-col gap-3
                          ${
                            currentTheme === theme.id
                              ? 'bg-cyan/5 border-cyan shadow-[0_0_15px_rgba(0,242,254,0.15)] [box-shadow:var(--shadow-neon),_inset_0_0_10px_rgba(0,242,254,0.03)]'
                              : 'bg-bg-card/45 border-tech-border/40 hover:border-cyan/30 hover:bg-white/[0.02] hover:-translate-y-0.5'
                          }`}
                        onClick={() => handleThemeChange(theme.id)}
                      >
                        {/* Visual Palette Preview Bar */}
                        <div
                          className="h-14 rounded-lg border border-white/5 flex items-center justify-between px-3.5 relative overflow-hidden"
                          style={{ backgroundColor: theme.colors[0] }}
                        >
                          {/* Subtle Grid overlay for high-tech style */}
                          <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(to_right,rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:10px_10px]" />

                          <span
                            className="font-bold text-[10px] tracking-[1px] uppercase z-10"
                            style={{
                              fontFamily:
                                theme.id === 'retro' ? 'var(--font-mono)' : 'var(--font-sans)',
                              color: theme.colors[1],
                            }}
                          >
                            {theme.name.split(' ')[0]}
                          </span>

                          <div className="flex -space-x-1.5 z-10">
                            <div
                              className="w-4 h-4 rounded-full border border-black/30 shadow-sm"
                              style={{ backgroundColor: theme.colors[1] }}
                              title="Primary Accent"
                            />
                            <div
                              className="w-4 h-4 rounded-full border border-black/30 shadow-sm"
                              style={{ backgroundColor: theme.colors[2] }}
                              title="Secondary Accent"
                            />
                          </div>
                        </div>

                        <div className="flex flex-col gap-0.5">
                          <span className="text-[12.5px] font-bold text-white tracking-[0.2px]">
                            {theme.name}
                          </span>
                          <span className="text-[10.5px] text-gray leading-normal">
                            {theme.desc}
                          </span>
                        </div>

                        {/* Active Check Indicator */}
                        {currentTheme === theme.id && (
                          <div className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full bg-cyan animate-pulse shadow-[0_0_6px_var(--color-cyan)]" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeSubTab === 'help' && (
                <div className="space-y-4 animate-fade-in">
                  {/* Guide 1: Git Integration */}
                  <div className="border border-tech-border/30 rounded-xl bg-black/15 overflow-hidden transition-all duration-200 hover:border-tech-border/60">
                    <button
                      type="button"
                      onClick={() => toggleHelp('git')}
                      className="w-full p-4 text-left flex items-center justify-between cursor-pointer select-none bg-bg-card/25 border-none outline-none group"
                    >
                      <div className="flex items-center gap-3">
                        <BookOpenIcon
                          className={`w-4 h-4 transition-all duration-200 ${expandedHelp.git ? 'text-cyan drop-shadow-[0_0_5px_var(--color-cyan)]' : 'text-gray/55 group-hover:text-white'}`}
                        />
                        <span
                          className={`font-bold text-[13px] tracking-[0.2px] transition-all duration-200 ${expandedHelp.git ? 'text-cyan' : 'text-white group-hover:text-white'}`}
                        >
                          Configuring Git & GitHub Sync Providers
                        </span>
                      </div>
                      <span
                        className="text-[10px] text-gray/60 transition-transform duration-250"
                        style={{ transform: expandedHelp.git ? 'rotate(180deg)' : 'none' }}
                      >
                        ▼
                      </span>
                    </button>
                    {expandedHelp.git && (
                      <div className="p-5 border-t border-tech-border/15 flex flex-col gap-3.5 leading-relaxed text-[12px] text-gray/95 bg-bg-inner/40">
                        <p>
                          AtlasSave supports bi-directional Git repositories to back up and
                          synchronize save profiles across different hardware setups.
                        </p>

                        <h4 className="text-cyan text-[12px] font-bold uppercase tracking-[0.5px] mt-1">
                          A: HTTPS Connection (Personal Access Token)
                        </h4>
                        <ul className="flex flex-col gap-2 pl-4 list-disc text-gray/80">
                          <li>
                            Generate a{' '}
                            <strong className="text-white">Classic Personal Access Token</strong> in
                            your GitHub Settings under Developer Settings &gt; Personal Access
                            Tokens &gt; Tokens Classic.
                          </li>
                          <li>
                            Ensure you enable the{' '}
                            <code className="text-cyan bg-cyan/5 px-1.5 py-0.5 rounded border border-cyan/10 font-mono">
                              repo
                            </code>{' '}
                            scope.
                          </li>
                          <li>Format the repository URL with the token directly:</li>
                        </ul>
                        <div className="font-mono bg-black/55 border border-tech-border/20 rounded-lg p-2.5 text-[11px] text-cyan select-all break-all overflow-x-auto">
                          https://&lt;username&gt;:&lt;token&gt;@github.com/&lt;username&gt;/&lt;repo&gt;.git
                        </div>

                        <h4 className="text-cyan text-[12px] font-bold uppercase tracking-[0.5px] mt-2">
                          B: SSH Connection (Custom Key Authentication)
                        </h4>
                        <ul className="flex flex-col gap-2 pl-4 list-disc text-gray/80">
                          <li>
                            Generate a password-less SSH key pair on your machine:
                            <div className="font-mono bg-black/55 border border-tech-border/20 rounded-lg p-2.5 text-[11px] text-cyan select-all break-all overflow-x-auto mt-1">
                              ssh-keygen -t ed25519 -f C:\Users\YourUser\.ssh\atlassave_key
                            </div>
                          </li>
                          <li>
                            Add the contents of the public key (
                            <code className="text-white bg-white/5 px-1.5 py-0.5 rounded border border-white/10 font-mono">
                              atlassave_key.pub
                            </code>
                            ) to your GitHub account SSH settings.
                          </li>
                          <li>
                            In AtlasSave Git Providers, enter the absolute path to your private key
                            file:
                          </li>
                          <div className="font-mono bg-black/55 border border-tech-border/20 rounded-lg p-2.5 text-[11px] text-cyan select-all break-all overflow-x-auto">
                            C:\Users\YourUser\.ssh\atlassave_key
                          </div>
                          <li>
                            Ensure the repository URL uses the SSH format (e.g.{' '}
                            <code className="text-white bg-white/5 px-1.5 py-0.5 rounded border border-white/10 font-mono">
                              git@github.com:username/repo.git
                            </code>
                            ).
                          </li>
                          <li>
                            Toggle <strong className="text-white">Auto-Accept Unknown Hosts</strong>{' '}
                            to bypass background terminal host prompts.
                          </li>
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Guide 2: NAS Setup */}
                  <div className="border border-tech-border/30 rounded-xl bg-black/15 overflow-hidden transition-all duration-200 hover:border-tech-border/60">
                    <button
                      type="button"
                      onClick={() => toggleHelp('nas')}
                      className="w-full p-4 text-left flex items-center justify-between cursor-pointer select-none bg-bg-card/25 border-none outline-none group"
                    >
                      <div className="flex items-center gap-3">
                        <BookOpenIcon
                          className={`w-4 h-4 transition-all duration-200 ${expandedHelp.nas ? 'text-cyan drop-shadow-[0_0_5px_var(--color-cyan)]' : 'text-gray/55 group-hover:text-white'}`}
                        />
                        <span
                          className={`font-bold text-[13px] tracking-[0.2px] transition-all duration-200 ${expandedHelp.nas ? 'text-cyan' : 'text-white group-hover:text-white'}`}
                        >
                          Local Drive & NAS Copy Settings
                        </span>
                      </div>
                      <span
                        className="text-[10px] text-gray/60 transition-transform duration-250"
                        style={{ transform: expandedHelp.nas ? 'rotate(180deg)' : 'none' }}
                      >
                        ▼
                      </span>
                    </button>
                    {expandedHelp.nas && (
                      <div className="p-5 border-t border-tech-border/15 flex flex-col gap-3.5 leading-relaxed text-[12px] text-gray/95 bg-bg-inner/40">
                        <p>
                          Local folder backup destinations are perfect for secondary internal SSDs,
                          external USB drives, or local network-attached storage (NAS).
                        </p>
                        <ul className="flex flex-col gap-2 pl-4 list-disc text-gray/80">
                          <li>Navigate to the **Providers** dashboard page in the sidebar.</li>
                          <li>Turn on the **Local & NAS Backup** master activation switch.</li>
                          <li>
                            Click the **Browse Folder** button to pick a folder path (for network
                            mount folders, select paths like{' '}
                            <code className="text-white bg-white/5 px-1.5 py-0.5 rounded border border-white/10 font-mono">
                              Z:\Backups\AtlasSaves
                            </code>
                            ).
                          </li>
                          <li>Click **Save Local Settings** to confirm.</li>
                          <li>
                            *Storage Rotation Limits:* The engine automatically prunes older backups
                            in this destination directory to maintain your maximum slot limit
                            configured in General Settings.
                          </li>
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Guide 3: Auto-detect Save Files */}
                  <div className="border border-tech-border/30 rounded-xl bg-black/15 overflow-hidden transition-all duration-200 hover:border-tech-border/60">
                    <button
                      type="button"
                      onClick={() => toggleHelp('detect')}
                      className="w-full p-4 text-left flex items-center justify-between cursor-pointer select-none bg-bg-card/25 border-none outline-none group"
                    >
                      <div className="flex items-center gap-3">
                        <BookOpenIcon
                          className={`w-4 h-4 transition-all duration-200 ${expandedHelp.detect ? 'text-cyan drop-shadow-[0_0_5px_var(--color-cyan)]' : 'text-gray/55 group-hover:text-white'}`}
                        />
                        <span
                          className={`font-bold text-[13px] tracking-[0.2px] transition-all duration-200 ${expandedHelp.detect ? 'text-cyan' : 'text-white group-hover:text-white'}`}
                        >
                          Game Save Folder Auto-Detection Heuristics
                        </span>
                      </div>
                      <span
                        className="text-[10px] text-gray/60 transition-transform duration-250"
                        style={{ transform: expandedHelp.detect ? 'rotate(180deg)' : 'none' }}
                      >
                        ▼
                      </span>
                    </button>
                    {expandedHelp.detect && (
                      <div className="p-5 border-t border-tech-border/15 flex flex-col gap-3.5 leading-relaxed text-[12px] text-gray/95 bg-bg-inner/40">
                        <p>
                          AtlasSave analyzes game executable structures to automatically resolve
                          save path locations.
                        </p>
                        <ul className="flex flex-col gap-2 pl-4 list-disc text-gray/80">
                          <li>
                            Inside the **Game Profiles** view, select **Detect Save Directory** and
                            scan the main game executable file (e.g.{' '}
                            <code className="text-white bg-white/5 px-1.5 py-0.5 rounded border border-white/10 font-mono">
                              eldenring.exe
                            </code>
                            ).
                          </li>
                          <li>
                            The backend scans Windows registries, checks default directories
                            (AppData, Saved Games, Steam userdata, Documents), and extracts matching
                            game identifiers.
                          </li>
                          <li>
                            If the file scan misses or resolves incorrectly, simply select your save
                            folder manually by browsing directly.
                          </li>
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Guide 4: Restores & Conflicts */}
                  <div className="border border-tech-border/30 rounded-xl bg-black/15 overflow-hidden transition-all duration-200 hover:border-tech-border/60">
                    <button
                      type="button"
                      onClick={() => toggleHelp('restore')}
                      className="w-full p-4 text-left flex items-center justify-between cursor-pointer select-none bg-bg-card/25 border-none outline-none group"
                    >
                      <div className="flex items-center gap-3">
                        <BookOpenIcon
                          className={`w-4 h-4 transition-all duration-200 ${expandedHelp.restore ? 'text-cyan drop-shadow-[0_0_5px_var(--color-cyan)]' : 'text-gray/55 group-hover:text-white'}`}
                        />
                        <span
                          className={`font-bold text-[13px] tracking-[0.2px] transition-all duration-200 ${expandedHelp.restore ? 'text-cyan' : 'text-white group-hover:text-white'}`}
                        >
                          Rollback Protection & Merge Strategies
                        </span>
                      </div>
                      <span
                        className="text-[10px] text-gray/60 transition-transform duration-250"
                        style={{ transform: expandedHelp.restore ? 'rotate(180deg)' : 'none' }}
                      >
                        ▼
                      </span>
                    </button>
                    {expandedHelp.restore && (
                      <div className="p-5 border-t border-tech-border/15 flex flex-col gap-3.5 leading-relaxed text-[12px] text-gray/95 bg-bg-inner/40">
                        <p>
                          Restoring files utilizes safeguards to avoid overwriting or destroying
                          progress.
                        </p>
                        <h4 className="text-cyan text-[12px] font-bold uppercase tracking-[0.5px] mt-1">
                          Automatic Rollbacks
                        </h4>
                        <p className="text-gray/80">
                          Whenever a rollback is initiated, AtlasSave archives your active folder
                          files on disk into a rollback ZIP first. If the restored files are
                          corrupted or incorrect, you can always revert to this automatic rollback
                          archive.
                        </p>

                        <h4 className="text-cyan text-[12px] font-bold uppercase tracking-[0.5px] mt-2">
                          Git Merge Strategies
                        </h4>
                        <p className="text-gray/80">
                          During background syncs, AtlasSave resolves remote conflicts
                          automatically. It uses the{' '}
                          <code className="text-white bg-white/5 px-1.5 py-0.5 rounded border border-white/10 font-mono">
                            git pull --rebase -X theirs
                          </code>{' '}
                          strategy to merge changes without locking the background daemon task.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeSubTab === 'about text' && (
                <div className="space-y-6 animate-fade-in">
                  {/* About Banner */}
                  <div className="flex flex-col items-center justify-center text-center py-8 px-5 border border-tech-border/30 rounded-xl bg-black/20 relative overflow-hidden shadow-inner">
                    {/* Glow overlay */}
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,242,254,0.08)_0%,transparent_70%)] pointer-events-none" />

                    <ShieldLogoIcon className="text-cyan drop-shadow-[0_0_15px_var(--color-cyan)] mb-4 animate-[pulse-glow_2s_infinite]" />

                    <span className="text-2xl font-black tracking-[4px] text-white [text-shadow:0_0_15px_rgba(0,242,254,0.25)]">
                      ATLAS SAVE
                    </span>

                    <span className="font-mono text-[10px] bg-cyan text-bg-dark px-3 py-0.5 rounded-full font-bold tracking-[0.5px] mt-2.5 shadow-sm">
                      v0.2.0-STABLE
                    </span>
                  </div>

                  {/* UPDATE MANAGER WIDGET */}
                  <div className="bg-[#070c0c]/40 border border-tech-border/20 rounded-xl p-5 hover:border-cyan/15 transition-all duration-200 space-y-4">
                    <div className="flex flex-col gap-0.5 border-b border-tech-border/10 pb-3">
                      <span className="text-[12px] font-bold text-white uppercase tracking-[0.5px]">
                        Software Update Center
                      </span>
                      <p className="text-[11px] text-gray mt-0.5">
                        Scan the remote repository server for stable updates and rollbacks.
                      </p>
                    </div>

                    <div className="flex items-center justify-between flex-wrap gap-4 py-1">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[11px] font-semibold text-white">
                          Current Version
                        </span>
                        <span className="font-mono text-xs text-gray">v0.2.0-STABLE</span>
                      </div>

                      <div className="flex items-center gap-3">
                        {updateAvailable ? (
                          <button
                            type="button"
                            onClick={handleInstallUpdate}
                            disabled={checkingUpdate}
                            className="px-4 py-2 font-sans font-bold text-[11px] rounded-lg cursor-pointer transition-all bg-green text-bg-dark hover:bg-[#59f8b4] shadow-[0_0_10px_rgba(89,248,180,0.3)] disabled:bg-tech-border/15 disabled:text-gray/50"
                          >
                            {checkingUpdate ? 'INSTALLING...' : 'INSTALL & RESTART'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={handleCheckForUpdates}
                            disabled={checkingUpdate}
                            className="px-4 py-2 font-sans font-bold text-[11px] rounded-lg cursor-pointer transition-all border border-tech-border bg-transparent text-cyan hover:bg-cyan/5 hover:border-cyan disabled:border-tech-border/15 disabled:text-gray/50"
                          >
                            {checkingUpdate ? 'CHECKING...' : 'CHECK FOR UPDATES'}
                          </button>
                        )}
                      </div>
                    </div>

                    {updateStatus && (
                      <div className="border border-tech-border/15 rounded-lg bg-black/20 p-3 text-[11px] font-mono text-cyan break-words">
                        <span className="text-gray/50 mr-1.5">&gt;</span> {updateStatus}
                      </div>
                    )}
                  </div>

                  {/* Description Info card */}
                  <div className="bg-[#070c0c]/40 border border-tech-border/20 rounded-xl p-5 space-y-4">
                    <span className="text-[12.5px] font-bold text-white uppercase tracking-[0.5px] border-b border-tech-border/10 pb-2.5 block">
                      PRODUCT DETAILS
                    </span>
                    <p className="text-gray/90 text-[12px] leading-relaxed">
                      AtlasSave is a real-time game save manager designed for PC gamers who value
                      security, stability, and speed. Utilizing a native Rust watcher, AtlasSave
                      captures folder-level operations instantly, structures and rotates local
                      backups, handles headless SSH and Git-sync pipelines, and keeps directories
                      neatly segregated.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 border-t border-tech-border/10 pt-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9.5px] text-gray uppercase tracking-wider font-semibold">
                          Platform Backend
                        </span>
                        <span className="font-mono text-xs text-white">
                          Tauri v2 + Tokio + Rust
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9.5px] text-gray uppercase tracking-wider font-semibold">
                          Frontend Interface
                        </span>
                        <span className="font-mono text-xs text-white">
                          React 19 + Tailwind CSS v4
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9.5px] text-gray uppercase tracking-wider font-semibold">
                          License Scope
                        </span>
                        <span className="font-mono text-xs text-white">MIT License</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9.5px] text-gray uppercase tracking-wider font-semibold">
                          System Watchers
                        </span>
                        <span className="font-mono text-xs text-cyan font-bold">
                          Active & Engaged
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-center mt-5 pt-4 border-t border-tech-border/10">
                      <a
                        href="https://github.com/rayan-dev0/AtlasSave"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 bg-white/5 border border-tech-border/30 rounded-lg px-5 py-2.5 text-white font-bold no-underline transition-all duration-200 font-sans text-[11.5px] hover:bg-white hover:text-bg-inner hover:border-white hover:shadow-[0_0_12px_rgba(255,255,255,0.2)] hover:-translate-y-px active:translate-y-0"
                      >
                        <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
                        </svg>
                        VIEW SOURCE ON GITHUB
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
