import React, { useState, useEffect } from 'react';
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

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ globalConfig, onSave }) => {
  const [maxBackups, setMaxBackups] = useState(globalConfig.max_backups);
  const [debounceSeconds, setDebounceSeconds] = useState(globalConfig.debounce_seconds);
  const [runOnStartup, setRunOnStartup] = useState(globalConfig.run_on_startup);
  const [steamgriddbApiKey, setSteamgriddbApiKey] = useState(
    globalConfig.steamgriddb_api_key || ''
  );

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
    <>
      <header className="mb-7 shrink-0 flex justify-between items-center flex-wrap gap-4">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold tracking-[1.5px] text-white uppercase">
            Settings & System Hub
          </h1>
          <p className="text-gray text-xs mt-1.5">
            Configure system options, customize design interfaces, review connection guides, and
            view app info.
          </p>
        </div>
      </header>

      {/* Sub-tab navigation */}
      <nav className="flex gap-2 border-b border-tech-border pb-0.5 mb-6">
        <button
          className={`border-none bg-transparent text-gray font-sans text-[13px] font-medium px-4 py-2.5 cursor-pointer border-b-2 border-transparent transition-all duration-200 hover:text-white hover:border-b-cyan/30 ${
            activeSubTab === 'general'
              ? 'text-cyan border-b-cyan [text-shadow:0_0_8px_rgba(0,242,254,0.35)]'
              : ''
          }`}
          onClick={() => handleSubTabChange('general')}
        >
          General Parameters
        </button>
        <button
          className={`border-none bg-transparent text-gray font-sans text-[13px] font-medium px-4 py-2.5 cursor-pointer border-b-2 border-transparent transition-all duration-200 hover:text-white hover:border-b-cyan/30 ${
            activeSubTab === 'appearance'
              ? 'text-cyan border-b-cyan [text-shadow:0_0_8px_rgba(0,242,254,0.35)]'
              : ''
          }`}
          onClick={() => handleSubTabChange('appearance')}
        >
          Appearance & Themes
        </button>
        <button
          className={`border-none bg-transparent text-gray font-sans text-[13px] font-medium px-4 py-2.5 cursor-pointer border-b-2 border-transparent transition-all duration-200 hover:text-white hover:border-b-cyan/30 ${
            activeSubTab === 'help'
              ? 'text-cyan border-b-cyan [text-shadow:0_0_8px_rgba(0,242,254,0.35)]'
              : ''
          }`}
          onClick={() => handleSubTabChange('help')}
        >
          Help & Connection Center
        </button>
        <button
          className={`border-none bg-transparent text-gray font-sans text-[13px] font-medium px-4 py-2.5 cursor-pointer border-b-2 border-transparent transition-all duration-200 hover:text-white hover:border-b-cyan/30 ${
            activeSubTab === 'about text'
              ? 'text-cyan border-b-cyan [text-shadow:0_0_8px_rgba(0,242,254,0.35)]'
              : ''
          }`}
          onClick={() => handleSubTabChange('about text')}
        >
          About System
        </button>
      </nav>

      {/* RENDER ACTIVE SUB-TAB */}
      {activeSubTab === 'general' && (
        <div className="animate-fade-in">
          {/* General Parameters */}
          <div className="bg-bg-card backdrop-blur-[12px] border border-tech-border rounded-card p-6 mb-6 relative overflow-hidden shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] hover:border-cyan/25 hover:shadow-[0_8px_32px_0_rgba(0,242,254,0.05)] transition-all duration-250">
            <span className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan to-purple opacity-85 z-5" />
            <header className="flex justify-between items-center mb-5 border-b border-tech-border/20 pb-3">
              <span className="text-[13.5px] font-bold tracking-[0.8px] text-white uppercase">
                GENERAL PARAMETERS
              </span>
            </header>

            <div className="flex flex-col gap-2 mb-6">
              <div className="flex justify-between items-center">
                <label className="font-mono text-[10px] font-bold text-gray uppercase tracking-[0.8px] flex justify-between items-center">
                  MAX BACKUP SLOTS HELD (ROTATION BOUND): {maxBackups}
                </label>
              </div>
              <input
                type="range"
                min="2"
                max="100"
                value={maxBackups}
                onChange={(e) => setMaxBackups(parseInt(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--color-cyan)' }}
              />
              <p className="text-gray text-xs mt-1.5">
                Prunes older ZIP files automatically once slots for a game profile exceed this
                limit.
              </p>
            </div>

            <div className="flex flex-col gap-2 mb-6">
              <div className="flex justify-between items-center">
                <label className="font-mono text-[10px] font-bold text-gray uppercase tracking-[0.8px] flex justify-between items-center">
                  DEBOUNCE SETTLE DELAY: {debounceSeconds} SECONDS
                </label>
              </div>
              <input
                type="range"
                min="1"
                max="60"
                value={debounceSeconds}
                onChange={(e) => setDebounceSeconds(parseInt(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--color-cyan)' }}
              />
              <p className="text-gray text-xs mt-1.5">
                Quiet period required after a save file change occurs to ensure the game has
                finished its write block.
              </p>
            </div>

            <div className="flex flex-col gap-2 mb-6">
              <div className="flex justify-between items-center">
                <div>
                  <label className="font-mono text-[10px] font-bold text-gray uppercase tracking-[0.8px] flex justify-between items-center">
                    LAUNCH ON SYSTEM STARTUP
                  </label>
                  <p className="text-gray text-xs mt-1.5">
                    Starts AtlasSave automatically minimized in the tray on boot.
                  </p>
                </div>
                <div
                  className="flex items-center gap-2.5 cursor-pointer select-none group"
                  onClick={() => setRunOnStartup(!runOnStartup)}
                >
                  <div
                    className={`w-10 h-[22px] bg-[#111a1b] border rounded-[11px] relative transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] group-hover:border-cyan ${
                      runOnStartup ? 'bg-green/15 border-green' : 'border-tech-border'
                    }`}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded-full absolute top-[3px] transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                        runOnStartup
                          ? 'bg-green left-[20px] shadow-[0_0_8px_var(--color-green)]'
                          : 'bg-gray left-[4px]'
                      }`}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center border-t border-tech-border/20 pt-3.5">
              <div></div>
              <button
                className="inline-flex items-center justify-center gap-2 px-4 font-sans font-semibold text-[11.5px] rounded-inner cursor-pointer transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] h-8.5 border border-transparent select-none disabled:bg-tech-border/15 disabled:border-tech-border/20 disabled:text-gray/40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none bg-cyan text-[#032021] shadow-[0_2px_8px_rgba(0,242,254,0.15)] hover:not-disabled:bg-[#33f5ff] hover:not-disabled:shadow-[0_0_12px_rgba(0,242,254,0.45)] hover:not-disabled:-translate-y-px active:not-disabled:translate-y-0"
                onClick={() => onSave(maxBackups, debounceSeconds, runOnStartup, steamgriddbApiKey)}
              >
                SAVE GLOBAL SETTINGS
              </button>
            </div>
          </div>

          {/* Cover Art Resolvers */}
          <div className="bg-bg-card backdrop-blur-[12px] border border-tech-border rounded-card p-6 mb-6 relative overflow-hidden shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] hover:border-cyan/25 hover:shadow-[0_8px_32px_0_rgba(0,242,254,0.05)] transition-all duration-250 mt-6">
            <span className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan to-purple opacity-85 z-5" />
            <header className="flex flex-col items-start gap-1 mb-5 border-b border-tech-border/20 pb-3">
              <span className="text-[13.5px] font-bold tracking-[0.8px] text-white uppercase">
                COVER ART & METADATA RESOLVERS
              </span>
              <p className="text-[11.5px] text-gray mt-1">
                AtlasSave fetches game cover art dynamically. Free providers are active by default.
                Configure your API key to search premium databases like SteamGridDB.
              </p>
            </header>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                marginBottom: '24px',
              }}
            >
              {/* Provider 1: Steam */}
              <div className="flex items-center justify-between p-3 border border-tech-border rounded-inner bg-bg-card/30">
                <div className="flex flex-col gap-0.5">
                  <span className="font-semibold text-[12.5px] text-white">
                    Steam Store Search API
                  </span>
                  <span className="text-[11px] text-gray">
                    Primary keyless search resolver. Fetches official store headers.
                  </span>
                </div>
                <span className="font-mono text-[8px] font-bold px-2.5 py-0.5 rounded-[20px] uppercase tracking-[0.5px] bg-green/10 text-green border border-green/35 shadow-[0_0_6px_rgba(89,248,180,0.1)]">
                  FREE & ACTIVE
                </span>
              </div>

              {/* Provider 2: GOG Galaxy */}
              <div className="flex items-center justify-between p-3 border border-tech-border rounded-inner bg-bg-card/30">
                <div className="flex flex-col gap-0.5">
                  <span className="font-semibold text-[12.5px] text-white">
                    GOG Galaxy Database
                  </span>
                  <span className="text-[11px] text-gray">
                    Secondary fallback catalog search for custom game box-arts.
                  </span>
                </div>
                <span className="font-mono text-[8px] font-bold px-2.5 py-0.5 rounded-[20px] uppercase tracking-[0.5px] bg-green/10 text-green border border-green/35 shadow-[0_0_6px_rgba(89,248,180,0.1)]">
                  FREE & ACTIVE
                </span>
              </div>

              {/* Provider 3: Epic Games Store */}
              <div className="flex items-center justify-between p-3 border border-tech-border rounded-inner bg-bg-card/30">
                <div className="flex flex-col gap-0.5">
                  <span className="font-semibold text-[12.5px] text-white">
                    Epic Games Store GraphQL
                  </span>
                  <span className="text-[11px] text-gray">
                    Tertiary fallback API queries for high-resolution wide capsule graphics.
                  </span>
                </div>
                <span className="font-mono text-[8px] font-bold px-2.5 py-0.5 rounded-[20px] uppercase tracking-[0.5px] bg-green/10 text-green border border-green/35 shadow-[0_0_6px_rgba(89,248,180,0.1)]">
                  FREE & ACTIVE
                </span>
              </div>

              {/* Provider 4: SteamGridDB */}
              <div className="flex flex-col gap-3 p-4 border border-tech-border rounded-inner bg-bg-card/40">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-[12.5px] text-white">
                      SteamGridDB Service
                    </span>
                    <span className="text-[11px] text-gray">
                      Community-curated repository containing thousands of custom headers, logos,
                      and box arts.
                    </span>
                  </div>
                  <span
                    className={`font-mono text-[8px] font-bold px-2.5 py-0.5 rounded-[20px] uppercase tracking-[0.5px] ${
                      steamgriddbApiKey.trim()
                        ? 'bg-green/10 text-green border border-green/35 shadow-[0_0_6px_rgba(89,248,180,0.1)]'
                        : 'bg-gray/5 text-gray border border-gray/20'
                    }`}
                  >
                    {steamgriddbApiKey.trim() ? 'ACTIVE' : 'REQUIRES KEY'}
                  </span>
                </div>

                <div className="flex flex-col gap-2 mb-0 mt-2">
                  <label className="font-mono text-[10px] font-bold text-gray uppercase tracking-[0.8px] flex justify-between items-center w-full">
                    <span>STEAMGRIDDB API KEY / TOKEN</span>
                    <a
                      href="https://www.steamgriddb.com/profile/preferences/api"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan no-underline text-[9px] hover:underline"
                    >
                      GET API KEY ↗
                    </a>
                  </label>
                  <input
                    className="grow bg-bg-inner border border-tech-border rounded-inner text-white px-3.5 py-2.5 font-sans text-[12.5px] outline-none h-[38px] transition-all duration-200 focus:border-cyan focus:shadow-[0_0_8px_rgba(0,242,254,0.2)] placeholder:text-gray/35"
                    type="password"
                    placeholder="Paste your personal SteamGridDB API key here..."
                    value={steamgriddbApiKey}
                    onChange={(e) => setSteamgriddbApiKey(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center border-t border-tech-border/20 pt-3.5">
              <div></div>
              <button
                className="inline-flex items-center justify-center gap-2 px-4 font-sans font-semibold text-[11.5px] rounded-inner cursor-pointer transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] h-8.5 border border-transparent select-none disabled:bg-tech-border/15 disabled:border-tech-border/20 disabled:text-gray/40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none bg-cyan text-[#032021] shadow-[0_2px_8px_rgba(0,242,254,0.15)] hover:not-disabled:bg-[#33f5ff] hover:not-disabled:shadow-[0_0_12px_rgba(0,242,254,0.45)] hover:not-disabled:-translate-y-px active:not-disabled:translate-y-0"
                onClick={() => onSave(maxBackups, debounceSeconds, runOnStartup, steamgriddbApiKey)}
              >
                SAVE COVER RESOLVER SETTINGS
              </button>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'appearance' && (
        <div className="animate-fade-in bg-bg-card backdrop-blur-[12px] border border-tech-border rounded-card p-6 mb-6 relative overflow-hidden shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] hover:border-cyan/25 hover:shadow-[0_8px_32px_0_rgba(0,242,254,0.05)] transition-all duration-250">
          <span className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan to-purple opacity-85 z-5" />
          <header className="flex flex-col items-start gap-1 mb-5 border-b border-tech-border/20 pb-3">
            <span className="text-[13.5px] font-bold tracking-[0.8px] text-white uppercase">
              SYSTEM THEME SELECTOR
            </span>
            <p className="text-[11.5px] text-gray mt-1">
              Choose a curated theme to restyle application borders, fonts, colors, and glow states
              instantly.
            </p>
          </header>

          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4 mt-4">
            {THEMES.map((theme) => (
              <div
                key={theme.id}
                className={`border border-tech-border rounded-card bg-bg-card p-4 cursor-pointer transition-all duration-250 cubic-bezier(0.4,0,0.2,1) flex flex-col gap-3 hover:-translate-y-0.5 hover:border-cyan hover:shadow-neon ${
                  currentTheme === theme.id
                    ? 'border-cyan bg-cyan/4 shadow-neon [box-shadow:var(--shadow-neon),_inset_0_0_10px_rgba(0,242,254,0.05)]'
                    : ''
                }`}
                onClick={() => handleThemeChange(theme.id)}
              >
                <div
                  className="h-12 rounded-inner border border-white/8 flex items-center gap-1.5 px-3 overflow-hidden"
                  style={{ background: theme.colors[0] }}
                >
                  <div
                    className="w-3.5 h-3.5 rounded-full border border-white/20"
                    style={{ background: theme.colors[1] }}
                  ></div>
                  <div
                    className="w-3.5 h-3.5 rounded-full border border-white/20"
                    style={{ background: theme.colors[2] }}
                  ></div>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      fontFamily: theme.id === 'retro' ? 'var(--font-mono)' : 'var(--font-sans)',
                      color: theme.colors[1],
                    }}
                  >
                    {theme.id.toUpperCase()}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[13px] font-semibold text-white">{theme.name}</span>
                  <span className="text-[11px] text-gray">{theme.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeSubTab === 'help' && (
        <div className="animate-fade-in flex flex-col gap-4">
          {/* Guide 1: Git Integration */}
          <div className="border border-tech-border rounded-card bg-bg-card overflow-hidden">
            <header
              className="p-4 cursor-pointer flex items-center justify-between select-none bg-bg-card/20 transition-colors duration-200 hover:bg-cyan/3"
              onClick={() => toggleHelp('git')}
            >
              <div className="flex items-center gap-3">
                <svg
                  className="text-cyan drop-shadow-[0_0_4px_rgba(0,242,254,0.2)]"
                  width="16"
                  height="16"
                  fill="currentColor"
                  viewBox="0 0 16 16"
                >
                  <path
                    fillRule="evenodd"
                    d="M15.6 8.5c-.2-.6-.5-1.1-.9-1.5-.4-.4-.9-.7-1.5-.9-.6-.2-1.2-.2-1.8 0-.6.2-1.1.5-1.5.9l-1.4 1.4-1-1 1.4-1.4c.8-.8.8-2 0-2.8s-2-.8-2.8 0L6.1 5.1c-.4-.4-.9-.7-1.5-.9s-1.2-.2-1.8 0c-.6.2-1.1.5-1.5.9-.4.4-.7.9-.9 1.5s-.2 1.2 0 1.8c.2.6.5 1.1.9 1.5l2.8 2.8c.8.8 2 .8 2.8 0l1-1-1.4-1.4-.7.7c-.4.4-1 .4-1.4 0L4 7.7c-.4-.4-.4-1 0-1.4l1.4-1.4c.4-.4 1-.4 1.4 0l1 1-1.4 1.4c-.8.8-.8 2 0 2.8s2 .8 2.8 0l1.4-1.4c.4.4.9.7 1.5.9s1.2.2 1.8 0c.6-.2 1.1-.5 1.5-.9.4-.4.7-.9.9-1.5s.2-1.2 0-1.8z"
                  />
                </svg>
                <span className="font-semibold text-[13.5px] text-white">
                  Configuring Git & GitHub Sync Providers
                </span>
              </div>
              <span>{expandedHelp.git ? '▼' : '▶'}</span>
            </header>

            {expandedHelp.git && (
              <div className="p-5 border-t border-tech-border flex flex-col gap-3.5 leading-relaxed text-[12.5px] text-white bg-bg-inner">
                <p>
                  AtlasSave supports bi-directional Git repositories to back up and synchronize save
                  profiles across different hardware setups.
                </p>

                <h4 className="text-cyan text-[13px] font-semibold">
                  HTTPS Connection (Personal Access Token)
                </h4>
                <ul className="flex flex-col gap-2 pl-5 list-disc">
                  <li>
                    Generate a **Classic Personal Access Token** in your GitHub Settings (Developer
                    Settings &gt; Personal Access Tokens &gt; Tokens Classic).
                  </li>
                  <li>Enable the `repo` scope.</li>
                  <li>Format the HTTPS URL with your token in the Repository URL field:</li>
                </ul>
                <div className="font-mono bg-black/50 border border-tech-border/30 rounded-inner p-2.5 text-[11.5px] text-cyan overflow-x-auto">
                  https://your_username:your_github_token@github.com/username/your_saves_repo.git
                </div>

                <h4 className="text-cyan text-[13px] font-semibold mt-2.5">
                  SSH Connection (Custom Key Authentication)
                </h4>
                <ul className="flex flex-col gap-2 pl-5 list-disc">
                  <li>
                    Generate an SSH key pair specifically for AtlasSave (without
                    password/passphrase):
                  </li>
                  <div className="font-mono bg-black/50 border border-tech-border/30 rounded-inner p-2.5 text-[11.5px] text-cyan overflow-x-auto">
                    ssh-keygen -t ed25519 -f C:\Users\YourUser\.ssh\atlassave_key
                  </div>
                  <li>
                    Copy and add the contents of the public key (`atlassave_key.pub`) to your GitHub
                    Deploy Keys or Account SSH settings.
                  </li>
                  <li>
                    In AtlasSave Git Settings, specify the absolute path to your private key file:
                  </li>
                  <div className="font-mono bg-black/50 border border-tech-border/30 rounded-inner p-2.5 text-[11.5px] text-cyan overflow-x-auto">
                    C:\Users\YourUser\.ssh\atlassave_key
                  </div>
                  <li>
                    Ensure the repository URL is formatted as an SSH address (e.g.
                    `git@github.com:username/repo.git`).
                  </li>
                  <li>
                    Toggle **Auto-Accept Unknown Hosts** so background headless terminal operations
                    can sync automatically without connection prompts.
                  </li>
                </ul>
              </div>
            )}
          </div>

          {/* Guide 2: NAS Setup */}
          <div className="border border-tech-border rounded-card bg-bg-card overflow-hidden">
            <header
              className="p-4 cursor-pointer flex items-center justify-between select-none bg-bg-card/20 transition-colors duration-200 hover:bg-cyan/3"
              onClick={() => toggleHelp('nas')}
            >
              <div className="flex items-center gap-3">
                <svg
                  className="text-cyan drop-shadow-[0_0_4px_rgba(0,242,254,0.2)]"
                  width="16"
                  height="16"
                  fill="currentColor"
                  viewBox="0 0 16 16"
                >
                  <path d="M1 2a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2zm12 1H2v10h12V3z" />
                  <path d="M4.5 5.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0zm3 0a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0zm3 0a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0zM3 8h10v1H3V8zm0 2h10v1H3v-1z" />
                </svg>
                <span className="font-semibold text-[13.5px] text-white">
                  Local Folder & NAS Copy Backup Settings
                </span>
              </div>
              <span>{expandedHelp.nas ? '▼' : '▶'}</span>
            </header>

            {expandedHelp.nas && (
              <div className="p-5 border-t border-tech-border flex flex-col gap-3.5 leading-relaxed text-[12.5px] text-white bg-bg-inner">
                <p>
                  Local backup copies are ideal for network drives (NAS), secondary hard disks, or
                  USB drives.
                </p>
                <ul className="flex flex-col gap-2 pl-5 list-disc">
                  <li>Navigate to the **Providers** view page.</li>
                  <li>Enable the **Local Backup Destination** toggle.</li>
                  <li>
                    Click **Browse** to specify a folder path (for example, a mapped network drive
                    path like `Z:\Backups\AtlasSaves\`).
                  </li>
                  <li>Click **Save Destination** to persist the configuration.</li>
                  <li>
                    *Rotation limit rules apply*: Whenever a backup occurs, oldest files in this
                    destination folder will be rotated based on the Max Backups parameter.
                  </li>
                </ul>
              </div>
            )}
          </div>

          {/* Guide 3: Auto-detect Save Files */}
          <div className="border border-tech-border rounded-card bg-bg-card overflow-hidden">
            <header
              className="p-4 cursor-pointer flex items-center justify-between select-none bg-bg-card/20 transition-colors duration-200 hover:bg-cyan/3"
              onClick={() => toggleHelp('detect')}
            >
              <div className="flex items-center gap-3">
                <svg
                  className="text-cyan drop-shadow-[0_0_4px_rgba(0,242,254,0.2)]"
                  width="16"
                  height="16"
                  fill="currentColor"
                  viewBox="0 0 16 16"
                >
                  <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z" />
                </svg>
                <span className="font-semibold text-[13.5px] text-white">
                  Game Save Folder Auto-Detection Heuristics
                </span>
              </div>
              <span>{expandedHelp.detect ? '▼' : '▶'}</span>
            </header>

            {expandedHelp.detect && (
              <div className="p-5 border-t border-tech-border flex flex-col gap-3.5 leading-relaxed text-[12.5px] text-white bg-bg-inner">
                <p>
                  AtlasSave analyzes game executable paths to detect where save files are located on
                  your disk.
                </p>
                <ul className="flex flex-col gap-2 pl-5 list-disc">
                  <li>
                    In **Game Profiles**, click **Detect Save Directory** and select the main game
                    executable file (e.g. `eldenring.exe`).
                  </li>
                  <li>
                    The engine parses registry keys, game titles, and checks directory signatures
                    inside AppData, Saved Games, Steam Userdata, and My Documents folders.
                  </li>
                  <li>
                    If the scanner misses, select the save file folder manually by browsing to the
                    exact location.
                  </li>
                </ul>
              </div>
            )}
          </div>

          {/* Guide 4: Restoring Saves */}
          <div className="border border-tech-border rounded-card bg-bg-card overflow-hidden">
            <header
              className="p-4 cursor-pointer flex items-center justify-between select-none bg-bg-card/20 transition-colors duration-200 hover:bg-cyan/3"
              onClick={() => toggleHelp('restore')}
            >
              <div className="flex items-center gap-3">
                <svg
                  className="text-cyan drop-shadow-[0_0_4px_rgba(0,242,254,0.2)]"
                  width="16"
                  height="16"
                  fill="currentColor"
                  viewBox="0 0 16 16"
                >
                  <path
                    fillRule="evenodd"
                    d="M8 3a5 5 0 1 1-4.546 2.914.5.5 0 0 0-.908-.417A6 6 0 1 0 8 2v1z"
                  />
                  <path d="M8 4.4a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 0-1 0v4a.5.5 0 0 0 .5.5z" />
                  <path d="M3.854 3.146a.5.5 0 0 0-.708 0l-1.5 1.5a.5.5 0 0 0 0 .708l1.5 1.5a.5.5 0 0 0 .708-.708L2.707 4.5l1.147-1.146a.5.5 0 0 0 0-.708z" />
                </svg>
                <span className="font-semibold text-[13.5px] text-white">
                  Restore Safe-Rollbacks & Conflict Merging
                </span>
              </div>
              <span>{expandedHelp.restore ? '▼' : '▶'}</span>
            </header>

            {expandedHelp.restore && (
              <div className="p-5 border-t border-tech-border flex flex-col gap-3.5 leading-relaxed text-[12.5px] text-white bg-bg-inner">
                <p>
                  Restoring save files features automatic rollback protection to ensure you never
                  lose your current game progress.
                </p>
                <h4 className="text-cyan text-[13px] font-semibold">Automatic Rollback</h4>
                <p>
                  Whenever you trigger a restore of an older save file, AtlasSave immediately
                  packages the active files on disk into a **rollback zip** archive first. If a
                  restore goes wrong or you make a mistake, you can find the rollback archive in
                  your backup list and revert to it.
                </p>

                <h4 className="text-cyan text-[13px] font-semibold mt-2.5">
                  Bi-Directional Conflict Resolution
                </h4>
                <p>
                  During sync schedules, if remote Git changes are pulled, AtlasSave merges changes
                  automatically. It prioritizes the latest remote files using the `git pull --rebase
                  -X theirs` strategy, preventing local merge conflict blocks in headless mode.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeSubTab === 'about text' && (
        <div className="animate-fade-in">
          {/* About Header Banner */}
          <div className="flex flex-col items-center justify-center text-center py-8 px-5 [background:radial-gradient(circle,_rgba(0,242,254,0.05)_0%,_transparent_80%)] border border-tech-border rounded-card bg-bg-card mb-6 relative overflow-hidden shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] hover:border-cyan/25 hover:shadow-[0_8px_32px_0_rgba(0,242,254,0.05)] transition-all duration-250">
            <span className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan to-purple opacity-85 z-5" />
            <svg
              className="text-cyan drop-shadow-[0_0_12px_var(--color-cyan)] mb-4 animate-pulse-glow"
              width="64"
              height="64"
              fill="currentColor"
              viewBox="0 0 16 16"
            >
              <path d="M5.338 1.59a61.447 61.447 0 0 0-2.837.856.481.481 0 0 0-.328.39c-.554 4.157.726 7.19 2.253 9.188a10.725 10.725 0 0 0 2.287 2.233c.346.244.652.42.887.523a.482.482 0 0 0 .409 0c.235-.104.54-.28.888-.523a10.725 10.725 0 0 0 2.286-2.233c1.527-1.997 2.807-5.031 2.253-9.188a.48.48 0 0 0-.328-.39c-.651-.213-1.75-.56-2.837-.855C9.552 1.29 8.531 1.013 8 1c-.53.013-1.552.29-2.662.59zM8 0c.535 0 1.541.272 2.662.59 1.108.316 2.213.666 2.868.88a1.482 1.482 0 0 1 .998 1.15c.61 4.58-.9 7.965-2.583 10.165a11.725 11.725 0 0 1-2.51 2.453c-.379.27-.77.49-1.108.64a1.482 1.482 0 0 1-1.254 0c-.338-.15-.729-.37-1.108-.64a11.725 11.725 0 0 1-2.51-2.453C1.51 10.585.0 7.2.61 2.62a1.482 1.482 0 0 1 .998-1.15c.655-.215 1.76-.565 2.868-.88C5.64 0.272 6.645 0 8 0z" />
            </svg>
            <span className="text-2xl font-extrabold tracking-[4px] text-white mb-1 [text-shadow:0_0_15px_rgba(0,242,254,0.2)]">
              ATLAS SAVE
            </span>
            <span className="font-mono text-[11px] bg-cyan text-bg-inner px-2 py-0.5 rounded-[20px] font-bold tracking-[0.5px]">
              v0.1.0-alpha
            </span>
          </div>

          {/* Description Card */}
          <div className="border border-tech-border rounded-card bg-bg-card p-6 flex flex-col gap-4 mb-6 relative overflow-hidden shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] hover:border-cyan/25 hover:shadow-[0_8px_32px_0_rgba(0,242,254,0.05)] transition-all duration-250">
            <span className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan to-purple opacity-85 z-5" />
            <span className="text-[14px] font-bold text-white uppercase">PRODUCT DESCRIPTION</span>
            <p className="text-gray text-[12.5px] leading-relaxed">
              AtlasSave is a real-time game save manager designed for PC gamers who value security,
              stability, and speed. Utilizing a native Rust watcher, AtlasSave captures folder-level
              operations instantly, structures and rotates local backups, handles headless SSH and
              Git-sync pipelines, and keeps directories neatly segregated.
            </p>

            <div className="grid grid-cols-2 gap-4 mt-2 border-t border-tech-border/20 pt-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-gray uppercase">PLATFORM BACKEND</span>
                <span className="font-semibold text-xs text-white">Tauri v2 + Tokio + Rust</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-gray uppercase">FRONTEND STYLING</span>
                <span className="font-semibold text-xs text-white">
                  React + TypeScript + Tailwind CSS v4
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-gray uppercase">DEVELOPMENT LICENSE</span>
                <span className="font-semibold text-xs text-white">MIT License</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-gray uppercase">STATUS CODE</span>
                <span className="font-semibold text-xs text-cyan">Core Watchers Engaged</span>
              </div>
            </div>

            <div className="flex justify-center mt-4 pt-4 border-t border-tech-border/20">
              <a
                href="https://github.com/rayan-dev0/AtlasSave"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-white/8 border border-tech-border rounded-inner px-5 py-2.5 text-white font-semibold no-underline transition-all duration-200 font-sans hover:bg-white hover:text-bg-inner hover:border-white hover:shadow-[0_0_12px_rgba(255,255,255,0.2)]"
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
    </>
  );
};
