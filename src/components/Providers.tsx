import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

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
  reloadConfig?: () => void;

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

// Inline SVGs for beautiful, crisp, vector-based graphics
const GitIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    viewBox="0 0 24 24"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="18" cy="18" r="3" />
    <circle cx="6" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <path d="M18 15V9a4 4 0 0 0-4-4H9" />
    <line x1="6" y1="9" x2="6" y2="15" />
  </svg>
);

const ServerIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    viewBox="0 0 24 24"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
    <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
    <line x1="6" y1="6" x2="6.01" y2="6" />
    <line x1="6" y1="18" x2="6.01" y2="18" />
  </svg>
);

const ShieldIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
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
    <path d="m9 11 2 2 4-4" />
  </svg>
);

const SaveIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    viewBox="0 0 24 24"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
);

const HelpIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
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
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const FolderOpenIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    viewBox="0 0 24 24"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const ArrowRightIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    viewBox="0 0 24 24"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

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
  reloadConfig,

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
  const [activeTab, setActiveTab] = useState<'git' | 'local'>('git');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [showConfirmSaveGit, setShowConfirmSaveGit] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(
    null
  );

  const [inputMode, setInputMode] = useState<'url' | 'fields'>('url');
  const [fieldProtocol, setFieldProtocol] = useState<'https' | 'ssh'>('https');
  const [fieldHost, setFieldHost] = useState('github.com');
  const [fieldOwner, setFieldOwner] = useState('');
  const [fieldRepo, setFieldRepo] = useState('');
  const [fieldToken, setFieldToken] = useState('');
  const [fieldSshUser, setFieldSshUser] = useState('git');

  // Synchronize fields to gitUrl when fields change (only in fields mode)
  useEffect(() => {
    if (inputMode === 'fields') {
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
    inputMode,
    setGitUrl,
  ]);

  // Synchronize gitUrl to fields on mount or when gitUrl changes (only in url mode)
  useEffect(() => {
    if (inputMode === 'url' && gitUrl) {
      const parsed = parseGitUrl(gitUrl);
      setFieldProtocol(parsed.protocol);
      setFieldHost(parsed.host);
      setFieldOwner(parsed.owner);
      setFieldRepo(parsed.repo);
      setFieldToken(parsed.token);
      setFieldSshUser(parsed.sshUser);
    }
  }, [gitUrl, inputMode]);

  return (
    <div className="flex flex-col h-full min-h-0 select-none">
      {/* Title & Description Header Section */}
      <header className="mb-6 shrink-0 flex justify-between items-center flex-wrap gap-4">
        <div className="flex flex-col">
          <h1 className="text-[22px] font-bold tracking-[1.5px] text-white uppercase font-sans">
            Backup Providers
          </h1>
          <p className="text-gray text-xs mt-1">
            Configure external cloud versioning routes and local copy paths.
          </p>
        </div>
      </header>

      {/* Main Split-Pane Layout Area */}
      <div className="grow min-h-0 flex gap-6 pb-2">
        {/* Left Side: Directory Sidebar Navigation */}
        <div className="w-[230px] shrink-0 flex flex-col gap-3">
          {/* Git Provider Tab Button */}
          <button
            id="git-provider-tab"
            type="button"
            onClick={() => setActiveTab('git')}
            className={`w-full text-left p-4 rounded-card border transition-all duration-250 cursor-pointer flex flex-col gap-2 relative overflow-hidden group
              ${
                activeTab === 'git'
                  ? 'bg-cyan/5 border-cyan shadow-[0_0_12px_rgba(0,242,254,0.06)]'
                  : 'bg-bg-card/45 border-tech-border/40 hover:border-cyan/35 hover:bg-white/1'
              }`}
          >
            {/* Active Indicator bar */}
            {activeTab === 'git' && (
              <span className="absolute top-0 left-0 bottom-0 w-[3px] bg-cyan" />
            )}
            <div className="flex items-center gap-3">
              <div
                className={`p-1.5 rounded-inner transition-colors duration-250 ${activeTab === 'git' ? 'text-cyan bg-cyan/10' : 'text-gray group-hover:text-cyan'}`}
              >
                <GitIcon className="w-5 h-5" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[12.5px] font-bold tracking-[0.5px] text-white">
                  Git Repository
                </span>
                <span className="text-[10px] text-gray truncate">Cloud Versioning</span>
              </div>
            </div>

            {/* Status bar */}
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-tech-border/15 w-full">
              <span className="text-[9.5px] font-mono text-gray">STATUS:</span>
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${gitEnabled ? 'bg-green animate-pulse shadow-[0_0_6px_var(--color-green)]' : 'bg-gray/55'}`}
                />
                <span
                  className={`text-[9.5px] font-mono font-bold ${gitEnabled ? 'text-green' : 'text-gray/70'}`}
                >
                  {gitEnabled ? 'ENABLED' : 'DISABLED'}
                </span>
              </div>
            </div>
          </button>

          {/* Local / NAS Provider Tab Button */}
          <button
            id="local-provider-tab"
            type="button"
            onClick={() => setActiveTab('local')}
            className={`w-full text-left p-4 rounded-card border transition-all duration-250 cursor-pointer flex flex-col gap-2 relative overflow-hidden group
              ${
                activeTab === 'local'
                  ? 'bg-cyan/5 border-cyan shadow-[0_0_12px_rgba(0,242,254,0.06)]'
                  : 'bg-bg-card/45 border-tech-border/40 hover:border-cyan/35 hover:bg-white/1'
              }`}
          >
            {/* Active Indicator bar */}
            {activeTab === 'local' && (
              <span className="absolute top-0 left-0 bottom-0 w-[3px] bg-cyan" />
            )}
            <div className="flex items-center gap-3">
              <div
                className={`p-1.5 rounded-inner transition-colors duration-250 ${activeTab === 'local' ? 'text-cyan bg-cyan/10' : 'text-gray group-hover:text-cyan'}`}
              >
                <ServerIcon className="w-5 h-5" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[12.5px] font-bold tracking-[0.5px] text-white">
                  Local / NAS
                </span>
                <span className="text-[10px] text-gray truncate">Secondary Drive Copy</span>
              </div>
            </div>

            {/* Status bar */}
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-tech-border/15 w-full">
              <span className="text-[9.5px] font-mono text-gray">STATUS:</span>
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${localEnabled ? 'bg-green animate-pulse shadow-[0_0_6px_var(--color-green)]' : 'bg-gray/55'}`}
                />
                <span
                  className={`text-[9.5px] font-mono font-bold ${localEnabled ? 'text-green' : 'text-gray/70'}`}
                >
                  {localEnabled ? 'ENABLED' : 'DISABLED'}
                </span>
              </div>
            </div>
          </button>
        </div>

        {/* Right Side: Active Provider Configuration details card */}
        <div className="flex-1 min-h-0 bg-[#090f10]/70 backdrop-blur-md border border-tech-border rounded-card flex flex-col overflow-hidden shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]">
          {/* Top Sticky Header */}
          <div className="shrink-0 p-5 border-b border-tech-border/20 bg-[#070b0c]/90 z-20 flex justify-between items-center">
            {activeTab === 'git' ? (
              <div className="flex-grow pr-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold tracking-[1.2px] text-white uppercase font-sans">
                    Git Cloud Repository Settings
                  </h2>
                  <span
                    className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${gitEnabled ? 'bg-green/10 text-green border-green/35' : 'bg-gray/10 text-gray border-tech-border/30'}`}
                  >
                    {gitEnabled ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>
                <p className="text-[11px] text-gray mt-1">
                  Commit and push ZIP backups directly into your private Git repository.
                </p>
              </div>
            ) : (
              <div className="flex-grow pr-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold tracking-[1.2px] text-white uppercase font-sans">
                    Local & NAS Backup Settings
                  </h2>
                  <span
                    className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${localEnabled ? 'bg-green/10 text-green border-green/35' : 'bg-gray/10 text-gray border-tech-border/30'}`}
                  >
                    {localEnabled ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>
                <p className="text-[11px] text-gray mt-1">
                  Copy compressed backup files to an external drive, network mount, or custom folder
                  path.
                </p>
              </div>
            )}

            {/* Provider Enable / Disable Master Toggle Switch */}
            <div className="shrink-0">
              {activeTab === 'git' ? (
                <div
                  id="git-provider-toggle"
                  className="flex items-center gap-2.5 cursor-pointer select-none group"
                  onClick={() => setGitEnabled(!gitEnabled)}
                >
                  <span className="text-[10px] font-mono font-bold text-gray group-hover:text-cyan transition-colors duration-200">
                    {gitEnabled ? 'ACTIVE' : 'OFF'}
                  </span>
                  <div
                    className={`w-9 h-5 rounded-[10px] border relative transition-all duration-200 group-hover:border-cyan ${gitEnabled ? 'bg-green/15 border-green' : 'bg-bg-inner border-tech-border'}`}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded-full absolute top-[2px] transition-all duration-250 ease-out ${gitEnabled ? 'bg-green left-[18px] shadow-[0_0_8px_var(--color-green)]' : 'bg-gray/70 left-[3px]'}`}
                    />
                  </div>
                </div>
              ) : (
                <div
                  id="local-provider-toggle"
                  className="flex items-center gap-2.5 cursor-pointer select-none group"
                  onClick={() => setLocalEnabled(!localEnabled)}
                >
                  <span className="text-[10px] font-mono font-bold text-gray group-hover:text-cyan transition-colors duration-200">
                    {localEnabled ? 'ACTIVE' : 'OFF'}
                  </span>
                  <div
                    className={`w-9 h-5 rounded-[10px] border relative transition-all duration-200 group-hover:border-cyan ${localEnabled ? 'bg-green/15 border-green' : 'bg-bg-inner border-tech-border'}`}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded-full absolute top-[2px] transition-all duration-250 ease-out ${localEnabled ? 'bg-green left-[18px] shadow-[0_0_8px_var(--color-green)]' : 'bg-gray/70 left-[3px]'}`}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Scrollable Container with Custom Gradients Fades */}
          <div className="grow min-h-0 relative flex flex-col bg-bg-inner/15">
            {/* Top Fade Overlay */}
            <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-[#090f10] to-transparent pointer-events-none z-10 opacity-80" />

            {/* Active Content Body */}
            <div className="grow overflow-y-auto px-6 py-5 space-y-6 scrollbar">
              {activeTab === 'git' ? (
                <>
                  {/* Git Connection Disabled Warning message */}
                  {!gitEnabled && (
                    <div className="bg-tech-border/10 border border-tech-border/30 rounded-inner p-3.5 text-gray text-xs flex gap-3 items-center">
                      <HelpIcon className="w-5 h-5 text-gray/60 shrink-0" />
                      <span>
                        Git provider is currently disabled. Toggle the switch at the top right of
                        this panel to activate.
                      </span>
                    </div>
                  )}

                  {/* HTTPS / SSH URL Input / Split Toggle */}
                  <div
                    className={`space-y-3 transition-opacity duration-200 ${gitEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}
                  >
                    <div className="flex justify-between items-center">
                      <label className="font-mono text-[10px] font-bold text-gray uppercase tracking-[0.8px]">
                        Repository URL
                      </label>
                      <div className="flex border border-tech-border rounded-inner overflow-hidden h-[26px]">
                        <button
                          id="git-raw-url-btn"
                          type="button"
                          className={`px-2.5 font-sans font-bold text-[9px] transition-colors cursor-pointer select-none
                            ${inputMode === 'url' ? 'bg-cyan/15 text-cyan' : 'text-gray/50 hover:text-white bg-transparent'}`}
                          onClick={() => setInputMode('url')}
                          disabled={!gitEnabled}
                        >
                          RAW URL
                        </button>
                        <button
                          id="git-split-fields-btn"
                          type="button"
                          className={`px-2.5 font-sans font-bold text-[9px] transition-colors cursor-pointer select-none border-l border-tech-border
                            ${inputMode === 'fields' ? 'bg-cyan/15 text-cyan' : 'text-gray/50 hover:text-white bg-transparent'}`}
                          onClick={() => setInputMode('fields')}
                          disabled={!gitEnabled}
                        >
                          SPLIT FIELDS
                        </button>
                      </div>
                    </div>

                    {inputMode === 'url' ? (
                      <input
                        id="git-raw-url-input"
                        className="w-full bg-bg-inner border border-tech-border rounded-inner text-white py-2 px-3 font-sans text-[12.5px] outline-none h-[38px] transition-all duration-250 focus:border-cyan focus:shadow-[0_0_8px_rgba(0,242,254,0.2)] placeholder:text-gray/25"
                        type="text"
                        placeholder="e.g. git@github.com:username/game-saves.git"
                        value={gitUrl}
                        onChange={(e) => setGitUrl(e.target.value)}
                        disabled={!gitEnabled}
                      />
                    ) : (
                      <div className="grid grid-cols-2 gap-4 bg-black/20 p-4 border border-tech-border/30 rounded-inner animate-[fade-slide-in_0.2s_ease-out] relative">
                        {/* Protocol Toggle */}
                        <div className="flex flex-col gap-1.5 col-span-2">
                          <span className="font-mono text-[9px] font-bold text-gray uppercase tracking-[0.5px]">
                            Protocol
                          </span>
                          <div className="flex border border-tech-border rounded-inner overflow-hidden h-[30px] w-fit">
                            <button
                              id="git-protocol-https-btn"
                              type="button"
                              className={`px-4 font-sans font-bold text-[10px] transition-colors cursor-pointer select-none
                                ${fieldProtocol === 'https' ? 'bg-cyan/15 text-cyan' : 'text-gray/50 hover:text-white bg-transparent'}`}
                              onClick={() => setFieldProtocol('https')}
                              disabled={!gitEnabled}
                            >
                              HTTPS
                            </button>
                            <button
                              id="git-protocol-ssh-btn"
                              type="button"
                              className={`px-4 font-sans font-bold text-[10px] transition-colors cursor-pointer select-none border-l border-tech-border
                                ${fieldProtocol === 'ssh' ? 'bg-cyan/15 text-cyan' : 'text-gray/50 hover:text-white bg-transparent'}`}
                              onClick={() => setFieldProtocol('ssh')}
                              disabled={!gitEnabled}
                            >
                              SSH (KEY-BASED)
                            </button>
                          </div>
                        </div>

                        {/* Host domain */}
                        <div className="flex flex-col gap-1.5">
                          <label className="font-mono text-[9px] font-bold text-gray uppercase tracking-[0.5px]">
                            Host Domain
                          </label>
                          <input
                            id="git-host-domain-input"
                            type="text"
                            className="bg-bg-inner border border-tech-border rounded-inner text-white py-1 px-2.5 font-sans text-[12px] h-[34px] outline-none focus:border-cyan"
                            placeholder="github.com"
                            value={fieldHost}
                            onChange={(e) => setFieldHost(e.target.value)}
                            disabled={!gitEnabled}
                          />
                        </div>

                        {/* Owner/Username */}
                        <div className="flex flex-col gap-1.5">
                          <label className="font-mono text-[9px] font-bold text-gray uppercase tracking-[0.5px]">
                            Owner/Username
                          </label>
                          <input
                            id="git-owner-input"
                            type="text"
                            className="bg-bg-inner border border-tech-border rounded-inner text-white py-1 px-2.5 font-sans text-[12px] h-[34px] outline-none focus:border-cyan"
                            placeholder="username"
                            value={fieldOwner}
                            onChange={(e) => setFieldOwner(e.target.value)}
                            disabled={!gitEnabled}
                          />
                        </div>

                        {/* Repository Name */}
                        <div className="flex flex-col gap-1.5 col-span-2">
                          <label className="font-mono text-[9px] font-bold text-gray uppercase tracking-[0.5px]">
                            Repository Name
                          </label>
                          <input
                            id="git-repo-name-input"
                            type="text"
                            className="bg-bg-inner border border-tech-border rounded-inner text-white py-1 px-2.5 font-sans text-[12px] h-[34px] outline-none focus:border-cyan"
                            placeholder="saves (do not include .git)"
                            value={fieldRepo}
                            onChange={(e) => setFieldRepo(e.target.value)}
                            disabled={!gitEnabled}
                          />
                        </div>

                        {/* Conditional Auth Fields */}
                        {fieldProtocol === 'https' ? (
                          <div className="flex flex-col gap-1.5 col-span-2">
                            <label className="font-mono text-[9px] font-bold text-gray uppercase tracking-[0.5px]">
                              Personal Access Token (PAT)
                            </label>
                            <input
                              id="git-pat-token-input"
                              type="password"
                              className="bg-bg-inner border border-tech-border rounded-inner text-white py-1 px-2.5 font-sans text-[12px] h-[34px] outline-none focus:border-cyan placeholder:text-gray/20"
                              placeholder="ghp_... (leave empty for public repos)"
                              value={fieldToken}
                              onChange={(e) => setFieldToken(e.target.value)}
                              disabled={!gitEnabled}
                            />
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1.5 col-span-2">
                            <label className="font-mono text-[9px] font-bold text-gray uppercase tracking-[0.5px]">
                              SSH Username
                            </label>
                            <input
                              id="git-ssh-user-input"
                              type="text"
                              className="bg-bg-inner border border-tech-border rounded-inner text-white py-1 px-2.5 font-sans text-[12px] h-[34px] outline-none focus:border-cyan"
                              placeholder="git"
                              value={fieldSshUser}
                              onChange={(e) => setFieldSshUser(e.target.value)}
                              disabled={!gitEnabled}
                            />
                          </div>
                        )}

                        {/* Real-time compiled URL indicator */}
                        <div className="col-span-2 mt-2 pt-2 border-t border-tech-border/10">
                          <span className="font-mono text-[8.5px] text-gray/50 uppercase">
                            COMPILED URL PREVIEW:
                          </span>
                          <div className="font-mono text-[10.5px] text-cyan break-all select-all mt-1 bg-black/25 p-2 rounded-inner border border-tech-border/15">
                            {gitUrl || '(please complete fields above)'}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Branch name */}
                  <div
                    className={`space-y-2 transition-opacity duration-200 ${gitEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}
                  >
                    <label className="font-mono text-[10px] font-bold text-gray uppercase tracking-[0.8px]">
                      Branch Name
                    </label>
                    <input
                      id="git-branch-input"
                      className="w-full bg-bg-inner border border-tech-border rounded-inner text-white py-2 px-3 font-sans text-[12.5px] outline-none h-[38px] transition-all duration-250 focus:border-cyan focus:shadow-[0_0_8px_rgba(0,242,254,0.2)] placeholder:text-gray/25"
                      type="text"
                      placeholder="main"
                      value={gitBranch}
                      onChange={(e) => setGitBranch(e.target.value)}
                      disabled={!gitEnabled}
                    />
                  </div>

                  {/* Git Setup Guide details */}
                  <div
                    className={`transition-opacity duration-200 ${gitEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}
                  >
                    <details className="bg-purple/4 border border-purple/20 rounded-inner p-3 cursor-pointer group">
                      <summary className="font-mono text-[10.5px] font-bold text-purple outline-none flex items-center gap-2 select-none">
                        <HelpIcon className="w-3.5 h-3.5 text-purple" />
                        <span>GIT & GITHUB CONFIGURATION GUIDE</span>
                        <ArrowRightIcon className="w-3 h-3 text-purple ml-auto transition-transform duration-200 group-open:rotate-90" />
                      </summary>
                      <div
                        className="mt-3 text-gray text-[11px] leading-relaxed cursor-default flex flex-col gap-3 border-t border-purple/10 pt-2.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <p>
                          AtlasSave streams your compressed game saves into an isolated Git
                          repository.
                        </p>
                        <div>
                          <strong className="text-white">A: HTTPS Authentication (Easiest)</strong>
                          <ul className="pl-4 mt-1 space-y-1 list-decimal text-gray/90">
                            <li>Create a private repository on GitHub/GitLab.</li>
                            <li>Generate a Personal Access Token (PAT) with repo privileges.</li>
                            <li>
                              Use this syntax for the URL:
                              <div className="font-mono bg-black/40 border border-tech-border/20 rounded-inner p-2 mt-1 text-[10px] text-cyan overflow-x-auto select-all whitespace-nowrap scrollbar">
                                https://&lt;username&gt;:&lt;token&gt;@github.com/&lt;username&gt;/&lt;repo&gt;.git
                              </div>
                            </li>
                          </ul>
                        </div>
                        <div>
                          <strong className="text-white">B: SSH Authentication (Key-based)</strong>
                          <ul className="pl-4 mt-1 space-y-1 list-decimal text-gray/90">
                            <li>Add your SSH Public Key (.pub) to your Git account.</li>
                            <li>
                              Use the standard SSH address:{' '}
                              <code>git@github.com:username/repo.git</code>
                            </li>
                            <li>
                              Provide the path to your SSH private key in Advanced Settings below.
                            </li>
                          </ul>
                        </div>
                      </div>
                    </details>
                  </div>

                  {/* Collapsible Advanced Settings button */}
                  <div
                    className={`transition-opacity duration-200 ${gitEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}
                  >
                    <button
                      id="git-advanced-toggle-btn"
                      type="button"
                      className="w-full inline-flex items-center justify-between px-4 font-sans font-semibold text-[10.5px] rounded-inner cursor-pointer transition-all duration-200 h-[32px] border border-tech-border/60 bg-transparent text-purple select-none hover:bg-purple/6 hover:border-purple"
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      disabled={!gitEnabled}
                    >
                      <span>{showAdvanced ? 'HIDE' : 'SHOW'} ADVANCED GIT CONFIG</span>
                      <svg
                        style={{
                          width: 12,
                          height: 12,
                          transform: showAdvanced ? 'rotate(180deg)' : 'none',
                          transition: 'transform 0.25s ease',
                        }}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth="2"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                        />
                      </svg>
                    </button>

                    {showAdvanced && (
                      <div className="grid grid-cols-2 gap-4 mt-3 p-4 bg-black/30 border border-tech-border/55 rounded-inner animate-[fade-slide-in_0.2s_ease-out]">
                        {/* Sync frequency */}
                        <div className="flex flex-col gap-1.5 col-span-2">
                          <label className="font-mono text-[9.5px] font-bold text-gray uppercase tracking-[0.8px]">
                            Git Sync Frequency
                          </label>
                          <select
                            id="git-sync-frequency-select"
                            className="w-full bg-bg-inner text-white border border-tech-border rounded-inner py-1.5 px-2.5 font-sans text-[12px] outline-none h-[34px] transition-all focus:border-cyan"
                            value={gitSyncInterval}
                            onChange={(e) => setGitSyncInterval(Number(e.target.value))}
                          >
                            <option value={0}>Real-time (Push immediately on file write)</option>
                            <option value={5}>Every 5 minutes</option>
                            <option value={15}>Every 15 minutes</option>
                            <option value={30}>Every 30 minutes</option>
                            <option value={60}>Every 1 hour</option>
                            <option value={999999}>Manual Sync Only</option>
                          </select>
                        </div>

                        {/* Auto-fetch saves */}
                        <div className="flex flex-col gap-1.5 bg-bg-inner/30 p-2.5 border border-tech-border/15 rounded-inner">
                          <div className="flex justify-between items-center">
                            <span className="font-mono text-[9.5px] font-bold text-gray uppercase tracking-[0.8px]">
                              Auto-Fetch Remotes
                            </span>
                            <div
                              id="git-auto-fetch-toggle"
                              className="flex items-center cursor-pointer select-none group"
                              onClick={() => setGitAutoFetch(!gitAutoFetch)}
                            >
                              <div
                                className={`w-8 h-[18px] rounded-[9px] border relative transition-all duration-200 ${gitAutoFetch ? 'bg-green/15 border-green' : 'bg-bg-inner border-tech-border'}`}
                              >
                                <div
                                  className={`w-3 h-3 rounded-full absolute top-[2px] transition-all duration-200 ${gitAutoFetch ? 'bg-green left-[16px]' : 'bg-gray left-[3px]'}`}
                                />
                              </div>
                            </div>
                          </div>
                          <p className="text-[10px] text-gray/80 leading-normal">
                            Imports remote cloud saves automatically on start.
                          </p>
                        </div>

                        {/* Auto-accept hosts */}
                        <div className="flex flex-col gap-1.5 bg-bg-inner/30 p-2.5 border border-tech-border/15 rounded-inner">
                          <div className="flex justify-between items-center">
                            <span className="font-mono text-[9.5px] font-bold text-gray uppercase tracking-[0.8px]">
                              Auto-Accept Hosts
                            </span>
                            <div
                              id="git-auto-accept-hosts-toggle"
                              className="flex items-center cursor-pointer select-none group"
                              onClick={() => setAcceptNewHosts(!gitAcceptNewHosts)}
                            >
                              <div
                                className={`w-8 h-[18px] rounded-[9px] border relative transition-all duration-200 ${gitAcceptNewHosts ? 'bg-green/15 border-green' : 'bg-bg-inner border-tech-border'}`}
                              >
                                <div
                                  className={`w-3 h-3 rounded-full absolute top-[2px] transition-all duration-200 ${gitAcceptNewHosts ? 'bg-green left-[16px]' : 'bg-gray left-[3px]'}`}
                                />
                              </div>
                            </div>
                          </div>
                          <p className="text-[10px] text-gray/80 leading-normal">
                            Accepts unknown server keys silently (SSH).
                          </p>
                        </div>

                        {/* Private Key Path */}
                        <div className="flex flex-col gap-1.5 col-span-2">
                          <label className="font-mono text-[9.5px] font-bold text-gray uppercase tracking-[0.8px]">
                            Custom SSH Private Key File Path
                          </label>
                          <div className="flex gap-3">
                            <input
                              id="git-ssh-key-path-input"
                              className="grow bg-bg-inner border border-tech-border rounded-inner text-white py-1.5 px-3 font-sans text-[12px] outline-none h-[34px] focus:border-cyan placeholder:text-gray/20 font-mono"
                              type="text"
                              placeholder="e.g. C:\Users\Username\.ssh\id_ed25519"
                              value={gitSshKeyPath}
                              onChange={(e) => setGitSshKeyPath(e.target.value)}
                            />
                            <button
                              id="git-ssh-key-browse-btn"
                              type="button"
                              className="inline-flex items-center justify-center gap-2 px-4 font-sans font-semibold text-[11px] rounded-inner cursor-pointer transition-all duration-200 h-[34px] border border-tech-border bg-transparent text-purple select-none hover:bg-purple/8 hover:border-purple"
                              onClick={async () => {
                                const selected = await invoke<string | null>('select_ssh_key_file');
                                if (selected) {
                                  setGitSshKeyPath(selected);
                                }
                              }}
                            >
                              <FolderOpenIcon className="w-3.5 h-3.5" />
                              <span>BROWSE KEY</span>
                            </button>
                          </div>
                        </div>

                        {/* Commit Author Name */}
                        <div className="flex flex-col gap-1.5">
                          <label className="font-mono text-[9.5px] font-bold text-gray uppercase tracking-[0.8px]">
                            Git Commit Author Name
                          </label>
                          <input
                            id="git-author-name-input"
                            className="w-full bg-bg-inner border border-tech-border rounded-inner text-white py-1.5 px-3 font-sans text-[12px] outline-none h-[34px] focus:border-cyan placeholder:text-gray/25"
                            type="text"
                            placeholder="AtlasSave Bot"
                            value={gitUserName}
                            onChange={(e) => setGitUserName(e.target.value)}
                          />
                        </div>

                        {/* Commit Author Email */}
                        <div className="flex flex-col gap-1.5">
                          <label className="font-mono text-[9.5px] font-bold text-gray uppercase tracking-[0.8px]">
                            Git Commit Author Email
                          </label>
                          <input
                            id="git-author-email-input"
                            className="w-full bg-bg-inner border border-tech-border rounded-inner text-white py-1.5 px-3 font-sans text-[12px] outline-none h-[34px] focus:border-cyan placeholder:text-gray/25"
                            type="email"
                            placeholder="bot@atlassave.local"
                            value={gitUserEmail}
                            onChange={(e) => setGitUserEmail(e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* Local Backup Disabled Warning message */}
                  {!localEnabled && (
                    <div className="bg-tech-border/10 border border-tech-border/30 rounded-inner p-3.5 text-gray text-xs flex gap-3 items-center">
                      <HelpIcon className="w-5 h-5 text-gray/60 shrink-0" />
                      <span>
                        Local / NAS backup destination is currently disabled. Toggle the switch at
                        the top right of this panel to activate.
                      </span>
                    </div>
                  )}

                  {/* Path input with folder picker button */}
                  <div
                    className={`space-y-2 transition-opacity duration-200 ${localEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}
                  >
                    <label className="font-mono text-[10px] font-bold text-gray uppercase tracking-[0.8px] flex justify-between items-center">
                      Destination Folder Path
                    </label>
                    <div className="flex gap-3">
                      <input
                        id="local-dest-path-input"
                        className="grow bg-bg-inner border border-tech-border rounded-inner text-white py-2 px-3 font-sans text-[12.5px] outline-none h-[38px] transition-all duration-250 focus:border-cyan placeholder:text-gray/25"
                        type="text"
                        placeholder="e.g. D:\Backups\GameSaves or \\NetworkNAS\Shared\Saves"
                        value={localPath}
                        onChange={(e) => setLocalPath(e.target.value)}
                        disabled={!localEnabled}
                      />
                      <button
                        id="local-dest-browse-btn"
                        type="button"
                        className="inline-flex items-center justify-center gap-2 px-4 font-sans font-semibold text-[11px] rounded-inner cursor-pointer transition-all duration-200 h-[38px] border border-tech-border bg-transparent text-purple select-none hover:bg-purple/8 hover:border-purple"
                        onClick={() => handleBrowseDir(setLocalPath)}
                        disabled={!localEnabled}
                      >
                        <FolderOpenIcon className="w-4 h-4" />
                        <span>BROWSE</span>
                      </button>
                    </div>
                  </div>

                  {/* Local Backups Explanatory Cards */}
                  <div
                    className={`transition-opacity duration-200 ${localEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}
                  >
                    <div className="border border-tech-border/20 bg-bg-card/30 rounded-inner p-4 space-y-3">
                      <div className="flex items-center gap-2 text-white">
                        <HelpIcon className="w-4 h-4 text-cyan" />
                        <span className="font-sans font-bold text-[11.5px] tracking-[0.5px] uppercase">
                          How Local / NAS copies work
                        </span>
                      </div>
                      <p className="text-gray text-[11px] leading-relaxed">
                        When a save update settles, AtlasSave compresses the target directory into a
                        ZIP archive and copies it here.
                      </p>
                      <ul className="pl-4 space-y-1 list-disc text-gray/80 text-[10.5px]">
                        <li>
                          Creates separate sub-directories automatically for each Game Profile.
                        </li>
                        <li>
                          Saves are timestamped: <code>ProfileName_YYYYMMDD_HHMMSS.zip</code>.
                        </li>
                        <li>
                          Automatically rotates older backup slots according to your{' '}
                          <b>Max Backups</b> preference.
                        </li>
                      </ul>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Bottom Fade Overlay */}
            <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-[#090f10] to-transparent pointer-events-none z-10 opacity-80" />
          </div>

          {/* Sticky Bottom Action Footer Bar */}
          <div className="shrink-0 p-4 border-t border-tech-border/20 bg-[#070b0c]/90 z-20 flex items-center justify-between">
            {activeTab === 'git' ? (
              <>
                <div className="flex flex-col items-start gap-1 max-w-[60%]">
                  <button
                    id="git-test-connection-btn"
                    type="button"
                    className="inline-flex items-center justify-center gap-2 px-4 font-sans font-semibold text-[11px] rounded-inner cursor-pointer transition-all duration-200 h-[32px] border border-tech-border bg-transparent text-purple select-none disabled:bg-[#465e60]/10 disabled:border-[#465e60]/20 disabled:text-[#a8bcbd]/30 disabled:cursor-not-allowed hover:bg-purple/8 hover:border-purple hover:-translate-y-0.5 active:translate-y-0 shrink-0"
                    onClick={handleTestGit}
                    disabled={gitTesting || !gitUrl.trim() || !gitEnabled}
                  >
                    {gitTesting ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-cyan/15 border-t-cyan rounded-full animate-spin"></div>
                        <span>TESTING CONNECTION...</span>
                      </>
                    ) : (
                      <>
                        <ShieldIcon className="w-3.5 h-3.5" />
                        <span>TEST CONNECTION</span>
                      </>
                    )}
                  </button>
                  {gitTestStatus && (
                    <span
                      className={`font-mono text-[9px] font-bold uppercase tracking-[0.5px] line-clamp-1 ${gitTestStatus.startsWith('Git Connection Successful') || gitTestStatus.includes('Successful') ? 'text-green' : 'text-crimson'}`}
                      title={gitTestStatus}
                    >
                      {gitTestStatus}
                    </span>
                  )}
                </div>

                <button
                  id="git-save-settings-btn"
                  type="button"
                  className="inline-flex items-center justify-center gap-2 px-4 font-sans font-semibold text-[11px] rounded-inner cursor-pointer transition-all duration-200 h-[32px] border border-transparent bg-cyan text-[#032021] select-none shadow-[0_2px_8px_rgba(0,242,254,0.15)] disabled:bg-[#465e60]/15 disabled:text-[#a8bcbd]/40 disabled:cursor-not-allowed hover:bg-[#33f5ff] hover:shadow-[0_0_12px_rgba(0,242,254,0.45)] hover:-translate-y-0.5 active:translate-y-0"
                  onClick={() => {
                    if (gitEnabled) {
                      setShowConfirmSaveGit(true);
                      setImportResult(null);
                    } else {
                      handleSaveGit();
                    }
                  }}
                  disabled={gitEnabled && !gitUrl.trim()}
                >
                  <SaveIcon className="w-3.5 h-3.5" />
                  <span>{gitEnabled ? 'SAVE GIT SETTINGS' : 'DISABLE GIT PROVIDER'}</span>
                </button>
              </>
            ) : (
              <>
                <div />
                <button
                  id="local-save-settings-btn"
                  type="button"
                  className="inline-flex items-center justify-center gap-2 px-4 font-sans font-semibold text-[11px] rounded-inner cursor-pointer transition-all duration-200 h-[32px] border border-transparent bg-cyan text-[#032021] select-none shadow-[0_2px_8px_rgba(0,242,254,0.15)] disabled:bg-[#465e60]/15 disabled:text-[#a8bcbd]/40 disabled:cursor-not-allowed hover:bg-[#33f5ff] hover:shadow-[0_0_12px_rgba(0,242,254,0.45)] hover:-translate-y-0.5 active:translate-y-0"
                  onClick={handleSaveLocal}
                  disabled={localEnabled && !localPath.trim()}
                >
                  <SaveIcon className="w-3.5 h-3.5" />
                  <span>{localEnabled ? 'SAVE LOCAL SETTINGS' : 'DISABLE LOCAL PROVIDER'}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {showConfirmSaveGit && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-[#070b0c] border border-tech-border max-w-[440px] w-full p-6 rounded-card shadow-[0_0_50px_rgba(0,242,254,0.12)] flex flex-col gap-4 text-center relative">
            <span className="font-sans font-bold text-sm tracking-[1.5px] text-cyan uppercase">
              Git Repository Import
            </span>

            {isImporting ? (
              <div className="flex flex-col items-center justify-center py-6 gap-4">
                <div className="w-8 h-8 border-4 border-cyan/15 border-t-cyan rounded-full animate-spin"></div>
                <div className="flex flex-col gap-1.5">
                  <span className="font-mono text-[10.5px] text-white uppercase tracking-[0.5px]">
                    CHECKING REMOTE REPOSITORY...
                  </span>
                  <span className="text-[10px] text-gray px-4 leading-relaxed">
                    Connecting to the Git remote, downloading configuration files, and verifying
                    backup data. This may take a few seconds.
                  </span>
                </div>
              </div>
            ) : importResult ? (
              <div className="flex flex-col items-center justify-center py-2 gap-4">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${importResult.success ? 'bg-green/10 text-green border border-green/30' : 'bg-crimson/10 text-crimson border border-crimson/30'}`}
                >
                  {importResult.success ? (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
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
                    {importResult.success ? 'Operation Completed' : 'Operation Failed'}
                  </span>
                  <p className="text-[11px] text-gray px-2 leading-relaxed whitespace-pre-line">
                    {importResult.message}
                  </p>
                </div>
                <button
                  type="button"
                  className="mt-2 inline-flex items-center justify-center gap-2 px-6 font-sans font-semibold text-[11px] rounded-inner cursor-pointer transition-all duration-200 h-[32px] border border-transparent bg-cyan text-[#032021] select-none hover:bg-[#33f5ff] hover:shadow-[0_0_12px_rgba(0,242,254,0.45)]"
                  onClick={() => {
                    setShowConfirmSaveGit(false);
                    setImportResult(null);
                  }}
                >
                  CLOSE
                </button>
              </div>
            ) : (
              <>
                <p className="text-gray text-xs leading-relaxed px-1">
                  AtlasSave will verify if an existing backup configuration exists in your remote
                  Git repository.
                </p>
                <div className="border border-tech-border/20 bg-bg-card/30 rounded-inner p-3.5 text-left text-[10.5px] leading-relaxed text-gray flex flex-col gap-1.5 font-mono">
                  <div className="flex items-center gap-2 text-white font-sans font-bold text-[11px] uppercase tracking-[0.5px]">
                    <HelpIcon className="w-4 h-4 text-cyan" />
                    <span>How it works:</span>
                  </div>
                  <div>
                    <span className="text-cyan">• CHECK & IMPORT</span>: Verifies config, imports
                    profiles, downloads backup archives, and extracts the latest save files
                    automatically.
                  </div>
                  <div>
                    <span className="text-purple">• SAVE ONLY</span>: Saves these Git settings
                    normally without checking for remote config files.
                  </div>
                </div>

                <div className="flex flex-col gap-2.5 mt-2">
                  <button
                    type="button"
                    className="w-full inline-flex items-center justify-center gap-2 px-4 font-sans font-bold text-[11px] rounded-inner cursor-pointer transition-all duration-200 h-[34px] border border-transparent bg-cyan text-[#032021] select-none shadow-[0_2px_8px_rgba(0,242,254,0.15)] hover:bg-[#33f5ff] hover:shadow-[0_0_12px_rgba(0,242,254,0.45)]"
                    onClick={async () => {
                      setIsImporting(true);
                      setImportResult(null);
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
                        } else {
                          setImportResult({
                            success: true,
                            message:
                              'No existing configuration was found in the repository.\nYour Git settings have been saved normally.',
                          });
                        }
                        if (reloadConfig) {
                          await reloadConfig();
                        }
                      } catch (err) {
                        setImportResult({
                          success: false,
                          message: `Operation failed:\n${err}`,
                        });
                      } finally {
                        setIsImporting(false);
                      }
                    }}
                  >
                    CHECK & IMPORT
                  </button>
                  <button
                    type="button"
                    className="w-full inline-flex items-center justify-center gap-2 px-4 font-sans font-semibold text-[11px] rounded-inner cursor-pointer transition-all duration-200 h-[34px] border border-tech-border bg-transparent text-purple select-none hover:bg-purple/8 hover:border-purple"
                    onClick={async () => {
                      await handleSaveGit();
                      setShowConfirmSaveGit(false);
                    }}
                  >
                    SAVE ONLY
                  </button>
                  <button
                    type="button"
                    className="w-full inline-flex items-center justify-center gap-2 px-4 font-sans font-semibold text-[11px] rounded-inner cursor-pointer transition-all duration-200 h-[34px] border border-tech-border bg-transparent text-gray select-none hover:text-white"
                    onClick={() => setShowConfirmSaveGit(false)}
                  >
                    CANCEL
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
