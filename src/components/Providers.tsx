import React, { useState } from 'react';

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
      <header className="mb-7 shrink-0 flex justify-between items-center flex-wrap gap-4">
        <div className="flex flex-col">
          <h1 className="text-[22px] font-bold tracking-[1.5px] text-white uppercase font-sans">
            Backup Providers
          </h1>
          <p className="text-gray text-xs mt-1.25">
            Configure external copy routes and git sync repositories.
          </p>
        </div>
      </header>

      {/* Provider: Git Repository */}
      <div className="bg-bg-card backdrop-blur-md border border-tech-border rounded-card p-6 mb-6 relative overflow-hidden shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] transition-all duration-250 hover:border-cyan/25 hover:shadow-[0_8px_32px_0_rgba(0,242,254,0.05)]">
        <span className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan to-purple opacity-85 z-5" />
        <div
          className={`flex justify-between items-center transition-all duration-200 ${gitEnabled ? 'border-b border-tech-border/20 pb-3 mb-5' : 'pb-0 mb-0 border-b-0'}`}
        >
          <div>
            <span className="text-[13.5px] font-bold tracking-[0.8px] text-white uppercase">
              GIT VERSION CONTROL (PRIVATE REPO)
            </span>
            <p className="text-[11.5px] text-gray mt-1">
              Pushes ZIP files directly to your private Git repo organized by game folder.
            </p>
          </div>
          <div
            className="flex items-center gap-2.5 cursor-pointer select-none group"
            onClick={() => setGitEnabled(!gitEnabled)}
          >
            <div
              className={`w-10 h-[22px] rounded-[11px] border relative transition-all duration-200 group-hover:border-cyan ${gitEnabled ? 'bg-green/15 border-green' : 'bg-[#111a1b] border-tech-border'}`}
            >
              <div
                className={`w-3.5 h-3.5 rounded-full absolute top-[3px] transition-all duration-200 ${gitEnabled ? 'bg-green left-[20px] shadow-[0_0_8px_var(--color-green)]' : 'bg-gray left-[4px]'}`}
              ></div>
            </div>
          </div>
        </div>

        {gitEnabled && (
          <div className="w-full animate-[fade-slide-in_0.3s_cubic-bezier(0.4,0,0.2,1)]">
            <div className="flex flex-col gap-2 mb-5">
              <label className="font-mono text-[10px] font-bold text-gray uppercase tracking-[0.8px] flex justify-between items-center">
                REPOSITORY URL (HTTPS OR SSH)
              </label>
              <input
                className="grow bg-bg-inner border border-tech-border rounded-inner text-white py-2.5 px-3.5 font-sans text-[12.5px] outline-none h-[38px] transition-all duration-200 focus:border-cyan focus:shadow-[0_0_8px_rgba(0,242,254,0.2)] placeholder:text-gray/35"
                type="text"
                placeholder="e.g. git@github.com:username/saves.git"
                value={gitUrl}
                onChange={(e) => setGitUrl(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2 mb-5">
              <label className="font-mono text-[10px] font-bold text-gray uppercase tracking-[0.8px] flex justify-between items-center">
                BRANCH NAME
              </label>
              <input
                className="grow bg-bg-inner border border-tech-border rounded-inner text-white py-2.5 px-3.5 font-sans text-[12.5px] outline-none h-[38px] transition-all duration-200 focus:border-cyan focus:shadow-[0_0_8px_rgba(0,242,254,0.2)] placeholder:text-gray/35"
                type="text"
                placeholder="main"
                value={gitBranch}
                onChange={(e) => setGitBranch(e.target.value)}
              />
            </div>

            {/* Git Integration Help Accordion */}
            <details className="bg-purple/4 border border-purple/20 rounded-inner p-3 mb-5 cursor-pointer">
              <summary className="font-mono text-[10.5px] font-bold text-purple outline-none flex items-center gap-2 select-none">
                <svg
                  style={{ width: 14, height: 14 }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
                  />
                </svg>
                GIT & GITHUB CONFIGURATION GUIDE
              </summary>
              <div
                className="mt-2.5 text-gray text-[11px] leading-relaxed cursor-default flex flex-col gap-2.5"
                onClick={(e) => e.stopPropagation()}
              >
                <p>
                  AtlasSave streams your save ZIP archives directly into a private Git repository.
                  You can authenticate using HTTPS or SSH.
                </p>
                <div>
                  <strong className="text-white">Option A: HTTPS Authentication (Easiest)</strong>
                  <ul className="pl-4 mt-1 flex flex-col gap-0.5 list-none">
                    <li>
                      1. Create a <strong>private</strong> repository on GitHub (e.g.{' '}
                      <code>saves</code>).
                    </li>
                    <li>
                      2. Generate a <strong>Personal Access Token (PAT)</strong> with{' '}
                      <code>repo</code> scopes on GitHub settings.
                    </li>
                    <li>
                      3. Formulate the repository URL as:{' '}
                      <code>
                        https://&lt;username&gt;:&lt;token&gt;@github.com/&lt;username&gt;/&lt;repo&gt;.git
                      </code>
                      .
                    </li>
                    <li>4. Paste it above, save settings, and test repository connection.</li>
                  </ul>
                </div>
                <div>
                  <strong className="text-white">
                    Option B: SSH Authentication (Secure & Key-based)
                  </strong>
                  <ul className="pl-4 mt-1 flex flex-col gap-0.5 list-none">
                    <li>
                      1. Set up an SSH Key (e.g. <code>id_ed25519</code>) and register its public
                      key (<code>.pub</code>) on GitHub.
                    </li>
                    <li>
                      2. Use the SSH URL format:{' '}
                      <code>git@github.com:&lt;username&gt;/&lt;repo&gt;.git</code>.
                    </li>
                    <li>
                      3. In <strong>Advanced Settings</strong> below, provide the absolute path to
                      your private key file (e.g. <code>C:\Users\Name\.ssh\id_ed25519</code>).
                    </li>
                    <li>
                      4. Turn on <strong>Auto-Accept Host Keys</strong> to automatically accept
                      GitHub's fingerprint and prevent connection hangs.
                    </li>
                  </ul>
                </div>
              </div>
            </details>

            {/* Collapsible Advanced Settings Panel */}
            <button
              type="button"
              className="w-full inline-flex items-center justify-between gap-2 px-4 font-sans font-semibold text-[10px] rounded-inner cursor-pointer transition-all duration-200 h-[30px] border border-tech-border bg-transparent text-purple mb-5 select-none hover:not-disabled:bg-purple/8 hover:not-disabled:border-purple hover:not-disabled:shadow-[0_0_10px_rgba(208,188,255,0.2)] hover:not-disabled:-translate-y-0.5 active:not-disabled:translate-y-0"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <span>{showAdvanced ? 'HIDE' : 'SHOW'} ADVANCED GIT SETTINGS</span>
              <svg
                style={{
                  width: 12,
                  height: 12,
                  transform: showAdvanced ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.2s ease',
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
              <div className="grid grid-cols-2 gap-5 p-5 bg-[#040808]/45 border border-tech-border rounded-inner mb-5 animate-[fade-slide-in_0.2s_ease]">
                <div className="flex flex-col gap-2 col-span-2 m-0">
                  <label className="font-mono text-[10px] font-bold text-gray uppercase tracking-[0.8px] flex justify-between items-center">
                    GIT SYNC FREQUENCY
                  </label>
                  <select
                    className="grow bg-bg-inner text-white border border-tech-border rounded-inner py-2 px-3.5 font-sans text-[12.5px] outline-none h-[38px] transition-all duration-200 focus:border-cyan focus:shadow-[0_0_8px_rgba(0,242,254,0.2)]"
                    value={gitSyncInterval}
                    onChange={(e) => setGitSyncInterval(Number(e.target.value))}
                  >
                    <option value={0}>Real-time (Push on game write)</option>
                    <option value={5}>Every 5 minutes</option>
                    <option value={15}>Every 15 minutes</option>
                    <option value={30}>Every 30 minutes</option>
                    <option value={60}>Every 1 hour</option>
                    <option value={999999}>Manual Sync Only</option>
                  </select>
                </div>

                <div className="flex flex-col gap-2 m-0">
                  <div className="flex justify-between items-center h-[38px]">
                    <span className="font-mono text-[10px] font-bold text-gray uppercase tracking-[0.8px] flex justify-between items-center">
                      AUTO-FETCH REMOTE SAVES
                    </span>
                    <div
                      className="flex items-center gap-2.5 cursor-pointer select-none group"
                      onClick={() => setGitAutoFetch(!gitAutoFetch)}
                    >
                      <div
                        className={`w-10 h-[22px] rounded-[11px] border relative transition-all duration-200 group-hover:border-cyan ${gitAutoFetch ? 'bg-green/15 border-green' : 'bg-[#111a1b] border-tech-border'}`}
                      >
                        <div
                          className={`w-3.5 h-3.5 rounded-full absolute top-[3px] transition-all duration-200 ${gitAutoFetch ? 'bg-green left-[20px] shadow-[0_0_8px_var(--color-green)]' : 'bg-gray left-[4px]'}`}
                        ></div>
                      </div>
                    </div>
                  </div>
                  <p className="text-[11.5px] text-gray mt-1">
                    Automatically imports saves backed up from other devices.
                  </p>
                </div>

                <div className="flex flex-col gap-2 m-0">
                  <div className="flex justify-between items-center h-[38px]">
                    <span className="font-mono text-[10px] font-bold text-gray uppercase tracking-[0.8px] flex justify-between items-center">
                      AUTO-ACCEPT HOST KEYS
                    </span>
                    <div
                      className="flex items-center gap-2.5 cursor-pointer select-none group"
                      onClick={() => setAcceptNewHosts(!gitAcceptNewHosts)}
                    >
                      <div
                        className={`w-10 h-[22px] rounded-[11px] border relative transition-all duration-200 group-hover:border-cyan ${gitAcceptNewHosts ? 'bg-green/15 border-green' : 'bg-[#111a1b] border-tech-border'}`}
                      >
                        <div
                          className={`w-3.5 h-3.5 rounded-full absolute top-[3px] transition-all duration-200 ${gitAcceptNewHosts ? 'bg-green left-[20px] shadow-[0_0_8px_var(--color-green)]' : 'bg-gray left-[4px]'}`}
                        ></div>
                      </div>
                    </div>
                  </div>
                  <p className="text-[11.5px] text-gray mt-1">
                    Prevents background hangs by auto-verifying unknown hosts.
                  </p>
                </div>

                <div className="flex flex-col gap-2 col-span-2 m-0">
                  <label className="font-mono text-[10px] font-bold text-gray uppercase tracking-[0.8px] flex justify-between items-center">
                    CUSTOM SSH PRIVATE KEY FILE PATH
                  </label>
                  <input
                    className="grow bg-bg-inner border border-tech-border rounded-inner text-white py-2.5 px-3.5 font-sans text-[12.5px] outline-none h-[38px] transition-all duration-200 focus:border-cyan focus:shadow-[0_0_8px_rgba(0,242,254,0.2)] placeholder:text-gray/35"
                    type="text"
                    placeholder="e.g. C:\Users\YourName\.ssh\id_rsa (leave empty for system agent)"
                    value={gitSshKeyPath}
                    onChange={(e) => setGitSshKeyPath(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-2 m-0">
                  <label className="font-mono text-[10px] font-bold text-gray uppercase tracking-[0.8px] flex justify-between items-center">
                    GIT COMMIT AUTHOR NAME
                  </label>
                  <input
                    className="grow bg-bg-inner border border-tech-border rounded-inner text-white py-2.5 px-3.5 font-sans text-[12.5px] outline-none h-[38px] transition-all duration-200 focus:border-cyan focus:shadow-[0_0_8px_rgba(0,242,254,0.2)] placeholder:text-gray/35"
                    type="text"
                    placeholder="AtlasSave Bot"
                    value={gitUserName}
                    onChange={(e) => setGitUserName(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-2 m-0">
                  <label className="font-mono text-[10px] font-bold text-gray uppercase tracking-[0.8px] flex justify-between items-center">
                    GIT COMMIT AUTHOR EMAIL
                  </label>
                  <input
                    className="grow bg-bg-inner border border-tech-border rounded-inner text-white py-2.5 px-3.5 font-sans text-[12.5px] outline-none h-[38px] transition-all duration-200 focus:border-cyan focus:shadow-[0_0_8px_rgba(0,242,254,0.2)] placeholder:text-gray/35"
                    type="email"
                    placeholder="bot@atlassave.local"
                    value={gitUserEmail}
                    onChange={(e) => setGitUserEmail(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-between items-center mt-5 border-t border-tech-border/15 pt-3.75">
              <div className="flex items-center gap-3">
                <button
                  className="inline-flex items-center justify-center gap-2 px-4 font-sans font-semibold text-[11.5px] rounded-inner cursor-pointer transition-all duration-200 h-[34px] border border-tech-border bg-transparent text-purple select-none disabled:bg-[#465e60]/15 disabled:border-[#465e60]/20 disabled:text-[#a8bcbd]/40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none hover:not-disabled:bg-purple/8 hover:not-disabled:border-purple hover:not-disabled:shadow-[0_0_10px_rgba(208,188,255,0.2)] hover:not-disabled:-translate-y-0.5 active:not-disabled:translate-y-0"
                  onClick={handleTestGit}
                  disabled={gitTesting || !gitUrl.trim()}
                >
                  {gitTesting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-cyan/10 border-t-cyan rounded-full animate-spin"></div>
                      TESTING...
                    </>
                  ) : (
                    <>
                      <svg
                        style={{ width: 14, height: 14 }}
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
                      TEST REPO CONNECTION
                    </>
                  )}
                </button>
                {gitTestStatus && (
                  <span
                    className={`font-mono text-[10.5px] font-bold uppercase tracking-[0.8px] flex items-center ${gitTestStatus.startsWith('Git Connection Successful') ? 'text-green' : 'text-crimson'}`}
                  >
                    {gitTestStatus}
                  </span>
                )}
              </div>

              <button
                className="inline-flex items-center justify-center gap-2 px-4 font-sans font-semibold text-[11.5px] rounded-inner cursor-pointer transition-all duration-200 h-[34px] border border-transparent bg-cyan text-[#032021] select-none shadow-[0_2px_8px_rgba(0,242,254,0.15)] disabled:bg-[#465e60]/15 disabled:border-[#465e60]/20 disabled:text-[#a8bcbd]/40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none hover:not-disabled:bg-[#33f5ff] hover:not-disabled:shadow-[0_0_12px_rgba(0,242,254,0.45)] hover:not-disabled:-translate-y-0.5 active:not-disabled:translate-y-0"
                onClick={handleSaveGit}
                disabled={gitEnabled && !gitUrl.trim()}
              >
                <svg
                  style={{ width: 14, height: 14 }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                SAVE GIT SETTINGS
              </button>
            </div>
          </div>
        )}

        {!gitEnabled && (
          <div className="flex justify-between items-center mt-3.75 border-t border-tech-border/15 pt-3.75">
            <div></div>
            <button
              className="inline-flex items-center justify-center gap-2 px-4 font-sans font-semibold text-[11.5px] rounded-inner cursor-pointer transition-all duration-200 h-[34px] border border-transparent bg-cyan text-[#032021] select-none shadow-[0_2px_8px_rgba(0,242,254,0.15)] disabled:bg-[#465e60]/15 disabled:border-[#465e60]/20 disabled:text-[#a8bcbd]/40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none hover:not-disabled:bg-[#33f5ff] hover:not-disabled:shadow-[0_0_12px_rgba(0,242,254,0.45)] hover:not-disabled:-translate-y-0.5 active:not-disabled:translate-y-0"
              onClick={handleSaveGit}
            >
              <svg
                style={{ width: 14, height: 14 }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              DISABLE GIT PROVIDER
            </button>
          </div>
        )}
      </div>

      {/* Provider: Local / NAS Network Path */}
      <div className="bg-bg-card backdrop-blur-md border border-tech-border rounded-card p-6 mb-6 relative overflow-hidden shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] transition-all duration-250 hover:border-cyan/25 hover:shadow-[0_8px_32px_0_rgba(0,242,254,0.05)]">
        <span className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan to-purple opacity-85 z-5" />
        <div
          className={`flex justify-between items-center transition-all duration-200 ${localEnabled ? 'border-b border-tech-border/20 pb-3 mb-5' : 'pb-0 mb-0 border-b-0'}`}
        >
          <div>
            <span className="text-[13.5px] font-bold tracking-[0.8px] text-white uppercase">
              LOCAL / NETWORK BACKUP (NAS)
            </span>
            <p className="text-[11.5px] text-gray mt-1">
              Copies backup files to an external drive or network NAS directory.
            </p>
          </div>
          <div
            className="flex items-center gap-2.5 cursor-pointer select-none group"
            onClick={() => setLocalEnabled(!localEnabled)}
          >
            <div
              className={`w-10 h-[22px] rounded-[11px] border relative transition-all duration-200 group-hover:border-cyan ${localEnabled ? 'bg-green/15 border-green' : 'bg-[#111a1b] border-tech-border'}`}
            >
              <div
                className={`w-3.5 h-3.5 rounded-full absolute top-[3px] transition-all duration-200 ${localEnabled ? 'bg-green left-[20px] shadow-[0_0_8px_var(--color-green)]' : 'bg-gray left-[4px]'}`}
              ></div>
            </div>
          </div>
        </div>

        {localEnabled && (
          <div className="w-full animate-[fade-slide-in_0.3s_cubic-bezier(0.4,0,0.2,1)]">
            <div className="flex flex-col gap-2 mb-5">
              <label className="font-mono text-[10px] font-bold text-gray uppercase tracking-[0.8px] flex justify-between items-center">
                DESTINATION FOLDER PATH
              </label>
              <div className="flex gap-3">
                <input
                  className="grow bg-bg-inner border border-tech-border rounded-inner text-white py-2.5 px-3.5 font-sans text-[12.5px] outline-none h-[38px] transition-all duration-200 focus:border-cyan focus:shadow-[0_0_8px_rgba(0,242,254,0.2)] placeholder:text-gray/35"
                  type="text"
                  placeholder="e.g. D:\Backups\GameSaves or \\NAS\Saves"
                  value={localPath}
                  onChange={(e) => setLocalPath(e.target.value)}
                />
                <button
                  className="inline-flex items-center justify-center gap-2 px-4 font-sans font-semibold text-[11.5px] rounded-inner cursor-pointer transition-all duration-200 h-[38px] border border-tech-border bg-transparent text-purple select-none hover:not-disabled:bg-purple/8 hover:not-disabled:border-purple hover:not-disabled:shadow-[0_0_10px_rgba(208,188,255,0.2)] hover:not-disabled:-translate-y-0.5 active:not-disabled:translate-y-0"
                  onClick={() => handleBrowseDir(setLocalPath)}
                >
                  <svg
                    style={{ width: 14, height: 14 }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
                    />
                  </svg>
                  BROWSE
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center mt-5 border-t border-tech-border/15 pt-3.75">
              <div></div>
              <button
                className="inline-flex items-center justify-center gap-2 px-4 font-sans font-semibold text-[11.5px] rounded-inner cursor-pointer transition-all duration-200 h-[34px] border border-transparent bg-cyan text-[#032021] select-none shadow-[0_2px_8px_rgba(0,242,254,0.15)] disabled:bg-[#465e60]/15 disabled:border-[#465e60]/20 disabled:text-[#a8bcbd]/40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none hover:not-disabled:bg-[#33f5ff] hover:not-disabled:shadow-[0_0_12px_rgba(0,242,254,0.45)] hover:not-disabled:-translate-y-0.5 active:not-disabled:translate-y-0"
                onClick={handleSaveLocal}
                disabled={localEnabled && !localPath.trim()}
              >
                <svg
                  style={{ width: 14, height: 14 }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                SAVE LOCAL PATH SETTINGS
              </button>
            </div>
          </div>
        )}

        {!localEnabled && (
          <div className="flex justify-between items-center mt-3.75 border-t border-tech-border/15 pt-3.75">
            <div></div>
            <button
              className="inline-flex items-center justify-center gap-2 px-4 font-sans font-semibold text-[11.5px] rounded-inner cursor-pointer transition-all duration-200 h-[34px] border border-transparent bg-cyan text-[#032021] select-none shadow-[0_2px_8px_rgba(0,242,254,0.15)] disabled:bg-[#465e60]/15 disabled:border-[#465e60]/20 disabled:text-[#a8bcbd]/40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none hover:not-disabled:bg-[#33f5ff] hover:not-disabled:shadow-[0_0_12px_rgba(0,242,254,0.45)] hover:not-disabled:-translate-y-0.5 active:not-disabled:translate-y-0"
              onClick={handleSaveLocal}
            >
              <svg
                style={{ width: 14, height: 14 }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              DISABLE LOCAL PROVIDER
            </button>
          </div>
        )}
      </div>
    </>
  );
};
