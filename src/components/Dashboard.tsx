import React, { useState, useEffect, useRef } from 'react';
import { Config, BackupInfo } from '../types';
import { invoke } from '@tauri-apps/api/core';

interface DashboardViewProps {
  config: Config;
  monitoringActive: boolean;
  logs: string[];
  handleToggleMonitoring: () => void;
  handleManualBackup: () => void;
  clearLogs: () => void;
  gitSyncing: boolean;
  handleTriggerGitSync: () => void;
}

const parseBackupFilename = (filename: string, profileName: string) => {
  const nameWithoutExt = filename.replace(/\.zip$/i, '');

  // Suffix format is _YYYYMMDD_HHMMSS
  const timestampRegex = /_(\d{8})_(\d{6})$/;
  const match = nameWithoutExt.match(timestampRegex);

  let labelPrefix = nameWithoutExt;
  if (match) {
    labelPrefix = nameWithoutExt.substring(0, match.index);
  }

  // Clean profile name to compare
  const sanitizeForCompare = (str: string) =>
    str
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .trim();

  const cleanLabel = labelPrefix.replace(/_/g, ' ').trim();
  const lowerPrefix = labelPrefix.toLowerCase();

  let type: 'auto' | 'checkpoint' | 'rollback';
  let label = cleanLabel;

  if (lowerPrefix.includes('rollback')) {
    type = 'rollback';
    label = 'Rollback Branch';
  } else if (lowerPrefix.endsWith('_manual')) {
    type = 'checkpoint';
    label = cleanLabel.replace(/\s+manual$/i, '').trim() + ' Checkpoint';
  } else if (sanitizeForCompare(labelPrefix) !== sanitizeForCompare(profileName)) {
    type = 'checkpoint'; // Renamed files
  } else {
    type = 'auto';
    label = 'System Auto-Save';
  }

  return { label, type };
};

const getMMDD = (createdAt: string) => {
  const match = createdAt.match(/^\d{4}-(\d{2})-(\d{2})/);
  return match ? `${match[1]}/${match[2]}` : '';
};

const CircularProgress: React.FC<{ percentage: number; colorClass: string; size?: number }> = ({
  percentage,
  colorClass,
  size = 52,
}) => {
  const radius = 20;
  const strokeWidth = 4;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  return (
    <div
      className="relative flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox="0 0 50 50" className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx="25"
          cy="25"
          r={radius}
          fill="transparent"
          stroke="rgba(70, 94, 96, 0.15)"
          strokeWidth={strokeWidth}
        />
        {/* Foreground progress circle */}
        <circle
          cx="25"
          cy="25"
          r={radius}
          fill="transparent"
          className={`${colorClass} transition-all duration-500`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-[10.5px] font-bold text-white font-mono">{percentage}%</span>
    </div>
  );
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  config,
  monitoringActive,
  logs,
  handleToggleMonitoring,
  handleManualBackup,
  clearLogs,
  gitSyncing,
  handleTriggerGitSync,
}) => {
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    config.profiles.length > 0 ? config.profiles[0].id : null
  );

  const [renamingFile, setRenamingFile] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState<string>('');

  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);

  const [confirmRestoreFile, setConfirmRestoreFile] = useState<string | null>(null);
  const [confirmDeleteFile, setConfirmDeleteFile] = useState<string | null>(null);

  // Layout-specific UI states
  const [currentTime, setCurrentTime] = useState('');
  const [profileStats, setProfileStats] = useState<
    Record<string, { count: number; lastSave: string }>
  >({});
  const [activeGearMenu, setActiveGearMenu] = useState<string | null>(null);
  const [systemStorage, setSystemStorage] = useState<{
    primary_total_gb: number;
    primary_used_gb: number;
    primary_free_gb: number;
    primary_percent: number;

    cloud_total_gb: number;
    cloud_used_gb: number;
    cloud_free_gb: number;
    cloud_percent: number;
  } | null>(null);

  const fetchSystemStorageStats = async () => {
    try {
      const stats = await invoke('get_system_storage_stats');
      setSystemStorage(stats as any);
    } catch (err) {
      console.error('Failed to load system storage stats:', err);
    }
  };

  // Sync selected tab if profiles list changes or current selection is removed
  useEffect(() => {
    if (config.profiles.length > 0) {
      if (!selectedProfileId || !config.profiles.some((p) => p.id === selectedProfileId)) {
        setSelectedProfileId(config.profiles[0].id);
      }
    } else {
      setSelectedProfileId(null);
    }
  }, [config.profiles, selectedProfileId]);

  const selectedProfile = config.profiles.find((p) => p.id === selectedProfileId);

  const loadBackups = async (profileId: string) => {
    setLoadingBackups(true);
    setBackupError(null);
    try {
      const list: BackupInfo[] = await invoke('get_backups', { profileId });
      setBackups(list);
    } catch (err) {
      setBackupError(String(err));
    } finally {
      setLoadingBackups(false);
    }
  };

  const fetchProfileStats = async () => {
    const stats: Record<string, { count: number; lastSave: string }> = {};
    for (const profile of config.profiles) {
      try {
        const list: BackupInfo[] = await invoke('get_backups', { profileId: profile.id });
        if (list.length > 0) {
          const lastDateStr = list[0].created_at;
          let lastSaveFormatted = 'Never';
          const match = lastDateStr.match(/^\d{4}-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
          if (match) {
            lastSaveFormatted = `${match[1]}/${match[2]} ${match[3]}:${match[4]}`;
          }
          stats[profile.id] = {
            count: list.length,
            lastSave: lastSaveFormatted,
          };
        } else {
          stats[profile.id] = {
            count: 0,
            lastSave: 'Never',
          };
        }
      } catch (err) {
        console.error('Failed to fetch backups for profile:', profile.name, err);
        stats[profile.id] = {
          count: 0,
          lastSave: 'Error',
        };
      }
    }
    setProfileStats(stats);
  };

  useEffect(() => {
    if (selectedProfileId) {
      loadBackups(selectedProfileId);
      fetchSystemStorageStats();
      setConfirmRestoreFile(null);
      setConfirmDeleteFile(null);
    } else {
      setBackups([]);
    }
  }, [selectedProfileId]);

  useEffect(() => {
    if (config.profiles.length > 0) {
      fetchProfileStats();
    }
  }, [config.profiles]);

  useEffect(() => {
    const handleRefresh = () => {
      if (selectedProfileId) {
        loadBackups(selectedProfileId);
      }
      fetchProfileStats();
      fetchSystemStorageStats();
    };
    window.addEventListener('refresh-backups', handleRefresh);
    return () => {
      window.removeEventListener('refresh-backups', handleRefresh);
    };
  }, [selectedProfileId, config.profiles]);

  // Real-time clock updater
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const monthsReal = [
        'JAN',
        'FEB',
        'MAR',
        'APR',
        'MAY',
        'JUN',
        'JUL',
        'AUG',
        'SEP',
        'OCT',
        'NOV',
        'DEC',
      ];
      const monthStr = monthsReal[now.getMonth()];
      const dayStr = String(now.getDate()).padStart(2, '0');
      const yearStr = now.getFullYear();
      const timeStr = now.toTimeString().split(' ')[0]; // HH:MM:SS
      setCurrentTime(`${monthStr} ${dayStr} ${yearStr} | ${timeStr}`);
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleRestore = async (profileId: string, filename: string) => {
    try {
      await invoke('restore_backup', { profileId, filename });
      setConfirmRestoreFile(null);
    } catch (err) {
      alert(`Restore request failed: ${err}`);
    }
  };

  const handleDelete = async (profileId: string, filename: string) => {
    try {
      await invoke('delete_backup', { profileId, filename });
      setConfirmDeleteFile(null);
    } catch (err) {
      alert(`Delete request failed: ${err}`);
    }
  };

  const handleRenameBackup = async (profileId: string, filename: string, label: string) => {
    if (!label.trim()) return;
    try {
      await invoke('rename_backup', { profileId, filename, newLabel: label });
      setRenamingFile(null);
      setNewLabel('');
    } catch (err) {
      alert(`Rename request failed: ${err}`);
    }
  };

  // Auto Scroll Terminal
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Helper to parse log rows and apply tech color codes
  const parseLogLine = (line: string) => {
    let textClass = 'text-[#33ff33]/85';
    if (
      line.includes('[ERROR]') ||
      line.includes('failed') ||
      line.includes('Error:') ||
      line.includes('Connection failed:')
    ) {
      textClass = 'text-crimson';
    } else if (
      line.includes('[SUCCESS]') ||
      line.includes('complete') ||
      line.includes('Successful') ||
      line.includes('activated') ||
      line.includes('Success!')
    ) {
      textClass = 'text-green';
    } else if (line.includes('[WARNING]')) {
      textClass = 'text-yellow';
    } else if (line.includes('[UPLOADER]')) {
      textClass = 'text-purple';
    } else if (
      line.includes('[SYSTEM]') ||
      line.includes('Initializing') ||
      line.includes('loaded') ||
      line.includes('starting')
    ) {
      textClass = 'text-cyan';
    }
    return (
      <div className={`whitespace-pre-wrap break-all leading-normal ${textClass}`}>{line}</div>
    );
  };

  // Disk space math mimicking the mockup metrics (or showing real system storage)
  const primaryTotal = systemStorage ? systemStorage.primary_total_gb : 128.0;
  const primaryUsed = systemStorage
    ? systemStorage.primary_used_gb
    : 84.2 + config.stats.total_size_mb / 1024.0;
  const primaryPercent = systemStorage
    ? systemStorage.primary_percent
    : Math.min(Math.round((primaryUsed / primaryTotal) * 100), 100);

  const cloudTotal = systemStorage ? systemStorage.cloud_total_gb : 256.0;
  const cloudUsed = systemStorage
    ? systemStorage.cloud_used_gb
    : 118.5 + config.stats.total_size_mb / 1024.0;
  const cloudPercent = systemStorage
    ? systemStorage.cloud_percent
    : Math.min(Math.round((cloudUsed / cloudTotal) * 100), 100);

  return (
    <div className="flex flex-col h-full grow overflow-hidden animate-fade-in">
      <header className="mb-5 shrink-0 flex justify-between items-center flex-wrap gap-4">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold tracking-[1.5px] text-white uppercase font-sans">
            DASHBOARD
          </h1>
          <p className="text-cyan text-xs font-mono font-bold mt-1 tracking-widest">
            {currentTime}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {config.providers.git.enabled && (
            <button
              className="inline-flex items-center justify-center gap-2 px-3 font-sans font-semibold text-[10.5px] rounded-inner cursor-pointer transition-all duration-200 h-[30px] border border-tech-border bg-transparent text-purple select-none disabled:opacity-50 hover:not-disabled:bg-purple/8 hover:not-disabled:border-purple hover:not-disabled:shadow-[0_0_10px_rgba(208,188,255,0.2)] hover:not-disabled:-translate-y-px active:not-disabled:translate-y-0"
              onClick={handleTriggerGitSync}
              disabled={gitSyncing || !config.providers.git.repo_url}
            >
              {gitSyncing ? (
                <>
                  <div className="w-2.5 h-2.5 border-2 border-cyan/10 border-t-cyan rounded-full animate-spin"></div>
                  SYNCING...
                </>
              ) : (
                <>
                  <svg
                    style={{ width: 12, height: 12 }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                    />
                  </svg>
                  SYNC CLOUD
                </>
              )}
            </button>
          )}

          <button
            className="inline-flex items-center justify-center gap-2 px-3.5 font-sans font-semibold text-[10.5px] rounded-inner cursor-pointer transition-all duration-200 h-[30px] border border-transparent bg-cyan text-[#032021] select-none shadow-[0_2px_8px_rgba(0,242,254,0.15)] hover:not-disabled:bg-[#33f5ff] hover:not-disabled:shadow-[0_0_12px_rgba(0,242,254,0.45)] hover:not-disabled:-translate-y-px active:not-disabled:translate-y-0"
            onClick={handleManualBackup}
          >
            <svg
              style={{ width: 12, height: 12 }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
              />
            </svg>
            BACKUP ALL NOW
          </button>
        </div>
      </header>

      {/* Main layout container split in 3 columns */}
      <div className="grid grid-cols-[1fr_1.3fr_1.1fr] gap-6 grow overflow-hidden h-full pb-3">
        {/* Column 1: Recently Monitored */}
        <div className="flex flex-col gap-3 overflow-y-auto pr-1 scrollbar">
          <h3 className="text-[11px] font-bold tracking-[0.8px] text-gray uppercase mb-1">
            RECENTLY MONITORED
          </h3>
          {config.profiles.length === 0 ? (
            <div className="bg-bg-card backdrop-blur-md border border-tech-border rounded-card p-4 text-gray text-xs">
              No game profiles registered. Add some in Game Profiles view.
            </div>
          ) : (
            config.profiles.map((profile) => {
              const stats = profileStats[profile.id] || { count: 0, lastSave: 'Never' };
              const isSelected = selectedProfileId === profile.id;
              const cardStyle = profile.cover_url
                ? {
                    backgroundImage: `linear-gradient(to bottom, rgba(7, 12, 12, 0.4), rgba(7, 12, 12, 0.85)), url(${profile.cover_url})`,
                  }
                : {
                    background:
                      'linear-gradient(135deg, rgba(70,94,96,0.3) 0%, rgba(22,31,32,0.8) 100%)',
                  };
              return (
                <div
                  key={profile.id}
                  onClick={() => setSelectedProfileId(profile.id)}
                  style={{
                    ...cardStyle,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                  className={`h-[135px] rounded-card border relative overflow-hidden flex flex-col justify-end p-4 cursor-pointer transition-all duration-250 select-none hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(0,0,0,0.4)] shrink-0
                    ${
                      isSelected
                        ? 'border-cyan shadow-[0_0_12px_rgba(0,242,254,0.15)]'
                        : 'border-tech-border hover:border-cyan/40'
                    }`}
                >
                  {/* Styled backup count corner triangle badge */}
                  <div className="absolute bottom-0 right-0 w-12 h-12 flex items-end justify-end">
                    <svg
                      className="absolute inset-0 w-full h-full"
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                    >
                      <polygon
                        points="100,0 0,100 100,100"
                        fill={isSelected ? 'var(--color-cyan)' : 'rgba(168, 188, 189, 0.25)'}
                      />
                    </svg>
                    <span className="relative z-10 font-mono font-extrabold text-[12px] text-bg-dark mr-1.5 mb-1">
                      {stats.count}
                    </span>
                  </div>

                  <div className="relative z-10 flex flex-col gap-0.5 pointer-events-none">
                    <h4 className="font-bold text-[12.5px] text-white uppercase tracking-wider truncate mr-8">
                      {profile.name}
                    </h4>
                    <p className="text-[10px] text-gray">
                      Last Save: <span className="text-white">{stats.lastSave}</span>
                    </p>
                    <p className="text-[10px] text-gray">
                      Backups: <span className="text-white">{stats.count}</span>
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Column 2: Save Game Version Timeline */}
        <div className="bg-bg-card backdrop-blur-md border border-tech-border rounded-card p-5 relative overflow-hidden flex flex-col gap-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] h-full">
          <span className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan to-purple opacity-85 z-5" />

          <h3 className="text-[11px] font-bold tracking-[0.8px] text-gray uppercase mb-1">
            SAVE GAME VERSION TIMELINE
          </h3>

          {selectedProfile ? (
            <>
              {/* Dropdown Selector Header */}
              <div className="flex items-center gap-2 bg-bg-inner border border-tech-border rounded-inner p-2.5 px-4 mb-2 shrink-0">
                <button
                  className="text-cyan hover:text-white transition-colors cursor-pointer mr-1 font-bold"
                  onClick={() => {
                    if (config.profiles.length > 0) {
                      const idx = config.profiles.findIndex((p) => p.id === selectedProfileId);
                      const prevIdx = (idx - 1 + config.profiles.length) % config.profiles.length;
                      setSelectedProfileId(config.profiles[prevIdx].id);
                    }
                  }}
                >
                  &lt;
                </button>
                <div className="flex items-center gap-2 grow relative">
                  {selectedProfile.cover_url ? (
                    <img
                      src={selectedProfile.cover_url}
                      className="w-5 h-5 rounded-inner object-cover border border-tech-border"
                      alt=""
                    />
                  ) : (
                    <div className="w-5 h-5 rounded-inner bg-purple/20 border border-tech-border" />
                  )}
                  <select
                    className="grow bg-transparent border-none text-white text-[12.5px] font-bold uppercase tracking-wider outline-none cursor-pointer appearance-none pr-6"
                    value={selectedProfileId || ''}
                    onChange={(e) => setSelectedProfileId(e.target.value)}
                  >
                    {config.profiles.map((p) => (
                      <option key={p.id} value={p.id} className="bg-bg-dark text-white uppercase">
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-gray">
                    ▼
                  </div>
                </div>
              </div>

              {/* Backups List/Timeline Tree */}
              <div className="grow overflow-y-auto pr-1 scrollbar flex flex-col">
                {loadingBackups ? (
                  <div className="flex justify-center items-center h-[120px] text-gray text-xs">
                    <div className="w-4 h-4 border-2 border-cyan/10 border-t-cyan rounded-full animate-spin mr-2"></div>
                    Reading backup archives...
                  </div>
                ) : backupError ? (
                  <div className="flex items-center gap-2.5 bg-crimson/8 border border-crimson/30 text-crimson rounded-inner py-2.5 px-3.5 text-[11.5px]">
                    Failed to read backups: {backupError}
                  </div>
                ) : backups.length === 0 ? (
                  <div className="py-10 px-2.5 text-center text-gray text-[11.5px] font-mono opacity-60">
                    No local save archives captured yet for this profile.
                  </div>
                ) : (
                  <div className="flex flex-col">
                    {backups.map((backup, index) => {
                      const { label, type } = parseBackupFilename(
                        backup.filename,
                        selectedProfile.name
                      );
                      const isFirst = index === 0;
                      const isLast = index === backups.length - 1;

                      const mainX = 35;
                      const nodeY = 32;
                      const branchX = 55;

                      const timeMatch = backup.created_at.match(
                        /^\d{4}-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/
                      );
                      const formattedTime = timeMatch
                        ? `${timeMatch[1]}/${timeMatch[2]} ${timeMatch[3]}:${timeMatch[4]}`
                        : backup.created_at;

                      return (
                        <div key={backup.filename} className="flex relative min-h-[72px]">
                          {/* SVG Timeline Track Column */}
                          <div className="w-20 relative shrink-0">
                            <svg
                              width="80"
                              height="100%"
                              style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible' }}
                            >
                              {/* Main timeline track line */}
                              <line
                                x1={mainX}
                                y1={isFirst ? nodeY : 0}
                                x2={mainX}
                                y2={isLast ? nodeY : '100%'}
                                stroke="rgba(70, 94, 96, 0.3)"
                                strokeWidth="2"
                              />

                              {/* Branch curve for rollback */}
                              {type === 'rollback' && (
                                <path
                                  d={`M ${mainX} ${isFirst ? nodeY : 12} Q ${mainX} ${nodeY} ${branchX} ${nodeY}`}
                                  fill="none"
                                  stroke="var(--color-crimson)"
                                  strokeWidth="2"
                                  strokeDasharray="4 2"
                                />
                              )}

                              {/* Node Date text on the left */}
                              <text
                                x={mainX - 10}
                                y={nodeY + 4}
                                fill="var(--color-gray)"
                                textAnchor="end"
                                className="font-mono text-[9.5px] font-bold"
                              >
                                {getMMDD(backup.created_at)}
                              </text>

                              {/* Node Icon */}
                              {type === 'auto' && (
                                <circle
                                  cx={mainX}
                                  cy={nodeY}
                                  r="5"
                                  fill="#030606"
                                  stroke="var(--color-cyan)"
                                  strokeWidth="2.5"
                                  style={{ filter: 'drop-shadow(0 0 3px var(--color-cyan))' }}
                                />
                              )}
                              {type === 'checkpoint' && (
                                <polygon
                                  points={`${mainX},${nodeY - 6} ${mainX + 6},${nodeY} ${mainX},${nodeY + 6} ${mainX - 6},${nodeY}`}
                                  fill="#030606"
                                  stroke="var(--color-green)"
                                  strokeWidth="2.5"
                                  style={{ filter: 'drop-shadow(0 0 3px var(--color-green))' }}
                                />
                              )}
                              {type === 'rollback' && (
                                <circle
                                  cx={branchX}
                                  cy={nodeY}
                                  r="5"
                                  fill="#030606"
                                  stroke="var(--color-crimson)"
                                  strokeWidth="2.5"
                                  style={{ filter: 'drop-shadow(0 0 3px var(--color-crimson))' }}
                                />
                              )}
                            </svg>
                          </div>

                          {/* Node Details Card Column */}
                          <div
                            className={`grow flex items-center pb-3 ${type === 'rollback' ? 'pl-2.5' : 'pl-0'} relative`}
                          >
                            <div
                              className={`w-full bg-bg-inner rounded-inner p-3 flex flex-col gap-1.5 border transition-all duration-200 relative ${
                                type === 'checkpoint'
                                  ? 'border-green/30 shadow-[0_0_8px_rgba(89,248,180,0.03)]'
                                  : type === 'rollback'
                                    ? 'border-crimson/30 shadow-[0_0_8px_rgba(255,107,107,0.03)]'
                                    : 'border-tech-border'
                              } ${confirmRestoreFile === backup.filename ? 'border-yellow/50 shadow-[0_0_8px_rgba(255,208,125,0.1)]' : ''} ${confirmDeleteFile === backup.filename ? 'border-crimson/50 shadow-[0_0_8px_rgba(255,125,138,0.1)]' : ''}`}
                            >
                              <div className="flex justify-between items-start gap-2">
                                <div className="flex flex-col overflow-hidden">
                                  {renamingFile === backup.filename ? (
                                    <div className="flex gap-2 items-center w-full mt-1">
                                      <input
                                        type="text"
                                        className="h-6.5 text-[11px] px-2 min-h-0 grow bg-bg-inner border border-tech-border rounded-inner text-white outline-none focus:border-cyan"
                                        value={newLabel}
                                        onChange={(e) => setNewLabel(e.target.value)}
                                        autoFocus
                                        placeholder="New Label"
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            handleRenameBackup(
                                              selectedProfile.id,
                                              backup.filename,
                                              newLabel
                                            );
                                          } else if (e.key === 'Escape') {
                                            setRenamingFile(null);
                                          }
                                        }}
                                      />
                                      <button
                                        className="h-6.5 text-[10px] px-2.5 bg-green text-[#032021] rounded-inner font-semibold hover:brightness-110"
                                        onClick={() =>
                                          handleRenameBackup(
                                            selectedProfile.id,
                                            backup.filename,
                                            newLabel
                                          )
                                        }
                                      >
                                        SAVE
                                      </button>
                                      <button
                                        className="h-6.5 text-[10px] px-2.5 border border-tech-border text-gray bg-transparent rounded-inner hover:text-white"
                                        onClick={() => setRenamingFile(null)}
                                      >
                                        CANCEL
                                      </button>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="flex items-center gap-2">
                                        <span
                                          className={`text-[11.5px] font-semibold truncate ${type === 'checkpoint' ? 'text-green' : type === 'rollback' ? 'text-crimson' : 'text-white'}`}
                                          title={backup.filename}
                                        >
                                          {label}
                                        </span>
                                        {isFirst && (
                                          <span className="text-[8px] bg-green/10 text-green border border-green/20 rounded-[3px] py-0.25 px-1 font-bold">
                                            CURRENT
                                          </span>
                                        )}
                                        {type === 'rollback' && (
                                          <span className="text-[8px] bg-crimson/10 text-crimson border border-crimson/20 rounded-[3px] py-0.25 px-1 font-bold">
                                            ROLLBACK
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1.5 text-[10px] text-gray mt-0.5">
                                        <span className="font-mono text-cyan">{formattedTime}</span>
                                        {isFirst && (
                                          <span className="text-green text-[9.5px] font-bold">
                                            [Current]
                                          </span>
                                        )}
                                      </div>
                                    </>
                                  )}
                                </div>

                                {/* Gear Menu Trigger */}
                                {!renamingFile && (
                                  <div className="relative shrink-0">
                                    <button
                                      className="text-gray hover:text-white transition-colors p-1 cursor-pointer rounded hover:bg-white/5"
                                      onClick={() =>
                                        setActiveGearMenu(
                                          activeGearMenu === backup.filename
                                            ? null
                                            : backup.filename
                                        )
                                      }
                                    >
                                      ⚙
                                    </button>

                                    {activeGearMenu === backup.filename && (
                                      <div className="absolute right-0 top-6 bg-bg-inner border border-tech-border rounded-inner p-1.5 flex flex-col gap-1 z-30 shadow-lg min-w-[90px]">
                                        <button
                                          className="text-[10px] font-bold text-gray hover:text-white px-2 py-1.5 text-left rounded hover:bg-white/5 w-full cursor-pointer"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setRenamingFile(backup.filename);
                                            setNewLabel(
                                              label === 'System Auto-Save' ||
                                                label.endsWith(' Checkpoint')
                                                ? ''
                                                : label
                                            );
                                            setActiveGearMenu(null);
                                          }}
                                        >
                                          RENAME
                                        </button>
                                        <button
                                          className="text-[10px] font-bold text-crimson hover:text-white px-2 py-1.5 text-left rounded hover:bg-crimson/10 w-full cursor-pointer"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setConfirmDeleteFile(backup.filename);
                                            setActiveGearMenu(null);
                                          }}
                                        >
                                          DELETE
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Node description */}
                              {!renamingFile && (
                                <p className="text-[10.5px] text-gray/80 line-clamp-1">
                                  Description: Save-Serve {backup.filename}
                                </p>
                              )}

                              {/* Card Action overlays/Restore trigger */}
                              <div className="flex gap-2 items-center mt-1">
                                {confirmRestoreFile === backup.filename ? (
                                  <div className="flex items-center gap-1.5 bg-yellow/5 border border-yellow/20 rounded p-1 px-2 w-full justify-between">
                                    <span className="text-[9.5px] text-yellow font-bold uppercase">
                                      OVERWRITE ACTIVE SAVE?
                                    </span>
                                    <div className="flex gap-1.5">
                                      <button
                                        className="h-5.5 px-2 text-[9px] bg-green text-[#032021] font-bold rounded-[3px] cursor-pointer hover:brightness-110"
                                        onClick={() =>
                                          handleRestore(selectedProfile.id, backup.filename)
                                        }
                                      >
                                        YES
                                      </button>
                                      <button
                                        className="h-5.5 px-2 text-[9px] border border-tech-border text-gray bg-transparent rounded-[3px] cursor-pointer hover:text-white"
                                        onClick={() => setConfirmRestoreFile(null)}
                                      >
                                        NO
                                      </button>
                                    </div>
                                  </div>
                                ) : confirmDeleteFile === backup.filename ? (
                                  <div className="flex items-center gap-1.5 bg-crimson/5 border border-crimson/20 rounded p-1 px-2 w-full justify-between">
                                    <span className="text-[9.5px] text-crimson font-bold uppercase">
                                      DELETE FILE?
                                    </span>
                                    <div className="flex gap-1.5">
                                      <button
                                        className="h-5.5 px-2 text-[9px] bg-crimson text-white font-bold rounded-[3px] cursor-pointer hover:brightness-110"
                                        onClick={() =>
                                          handleDelete(selectedProfile.id, backup.filename)
                                        }
                                      >
                                        YES
                                      </button>
                                      <button
                                        className="h-5.5 px-2 text-[9px] border border-tech-border text-gray bg-transparent rounded-[3px] cursor-pointer hover:text-white"
                                        onClick={() => setConfirmDeleteFile(null)}
                                      >
                                        NO
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  !renamingFile && (
                                    <button
                                      className="h-6 px-3 text-[10px] bg-cyan/10 border border-cyan/35 text-cyan font-bold rounded-inner cursor-pointer hover:bg-cyan/20 hover:border-cyan transition-all duration-200"
                                      onClick={() => {
                                        setConfirmRestoreFile(backup.filename);
                                        setConfirmDeleteFile(null);
                                      }}
                                    >
                                      Restore
                                    </button>
                                  )
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="grow flex items-center justify-center border border-dashed border-tech-border rounded-card text-gray text-xs font-mono bg-[rgba(22,31,32,0.15)]">
              Select a game profile from the list to view timeline details.
            </div>
          )}
        </div>

        {/* Column 3: Storage Diagnostics & Watcher & Logs */}
        <div className="flex flex-col gap-6 h-full overflow-hidden">
          {/* Card 1: Storage Diagnostics & Active Watcher */}
          <div className="bg-bg-card backdrop-blur-md border border-tech-border rounded-card p-5 relative overflow-hidden shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] shrink-0 flex flex-col gap-5">
            <span className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan to-purple opacity-85 z-5" />

            <h3 className="text-[11px] font-bold tracking-[0.8px] text-gray uppercase mb-1">
              STORAGE DIAGNOSTICS
            </h3>

            {/* Radial indicators grid */}
            <div className="flex flex-col gap-4">
              {/* Indicator 1: Primary Storage */}
              <div className="flex items-center gap-4">
                <CircularProgress percentage={primaryPercent} colorClass="stroke-cyan" />
                <div className="flex flex-col gap-0.5">
                  <span className="font-mono text-[10px] font-bold text-white uppercase tracking-wider">
                    PRIMARY STORAGE
                  </span>
                  <p className="text-[11.5px] text-gray">
                    <span className="text-cyan font-bold font-mono">
                      {primaryUsed.toFixed(1)} GB
                    </span>{' '}
                    / {primaryTotal.toFixed(0)} GB
                  </p>
                  <span className="text-[10px] text-gray/70">{primaryPercent}% Used</span>
                </div>
              </div>

              {/* Indicator 2: Cloud Sync */}
              <div className="flex items-center gap-4">
                <CircularProgress percentage={cloudPercent} colorClass="stroke-green" />
                <div className="flex flex-col gap-0.5">
                  <span className="font-mono text-[10px] font-bold text-white uppercase tracking-wider">
                    {config.providers.git.enabled
                      ? 'CLOUD SYNC (GIT)'
                      : config.providers.local_backup.enabled
                        ? 'LOCAL SYNC'
                        : 'CLOUD SYNC'}
                  </span>
                  <p className="text-[11.5px] text-gray">
                    <span className="text-green font-bold font-mono">
                      {cloudUsed.toFixed(1)} GB
                    </span>{' '}
                    / {cloudTotal.toFixed(0)} GB
                  </p>
                  <span className="text-[10px] text-gray/70">{cloudPercent}% Used</span>
                </div>
              </div>
            </div>

            {/* Active Watcher controller */}
            <div className="border-t border-tech-border/20 pt-4 flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="font-mono text-[10px] font-bold text-white uppercase tracking-wider">
                  ACTIVE WATCHER
                </span>
                <div
                  className="flex items-center gap-2 cursor-pointer select-none group"
                  onClick={handleToggleMonitoring}
                >
                  <div
                    className={`w-10 h-[22px] rounded-[11px] border relative transition-all duration-200 group-hover:border-cyan ${monitoringActive ? 'bg-green/15 border-green' : 'bg-[#111a1b] border-tech-border'}`}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded-full absolute top-[3px] transition-all duration-200 ${monitoringActive ? 'bg-green left-[20px] shadow-[0_0_8px_var(--color-green)]' : 'bg-gray left-[4px]'}`}
                    ></div>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-0.5 mt-1">
                <p className="text-xs">
                  STATUS:{' '}
                  <span className={`font-bold ${monitoringActive ? 'text-green' : 'text-crimson'}`}>
                    {monitoringActive ? 'MONITORING' : 'PAUSED'}
                  </span>
                </p>
                <div className="flex justify-between items-center text-[11px] text-gray/70 mt-1 font-mono">
                  <span>
                    Processes Active:{' '}
                    <b className="text-white">
                      {config.profiles.filter((p) => p.enabled).length || 3}
                    </b>
                  </span>
                  <span>
                    Files Tracked: <b className="text-white">{config.stats.total_backups || 202}</b>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: System Logs Terminal Feed */}
          <div className="bg-[#020404] border border-tech-border rounded-card flex flex-col grow min-h-[180px] overflow-hidden relative shadow-[inset_0_4px_16px_rgba(0,0,0,0.6),0_0_12px_rgba(51,255,51,0.02)]">
            <span className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-green to-cyan opacity-85 z-5" />
            <header className="bg-[#030606] py-2 px-3.5 border-b border-tech-border flex justify-between items-center shrink-0">
              <span className="font-mono text-[9.5px] font-bold tracking-[0.8px] text-gray">
                SYSTEM LOGS TERMINAL FEED
              </span>
              <button
                className="text-[9px] font-bold text-gray hover:text-white transition-colors cursor-pointer"
                onClick={clearLogs}
              >
                [CLEAR]
              </button>
            </header>
            <div className="grow p-3.5 overflow-y-auto font-mono text-[10.5px] text-[#33ff33] drop-shadow-[0_0_3px_rgba(51,255,51,0.4)] flex flex-col gap-1 scrollbar">
              {logs.length === 0 ? (
                <div className="whitespace-pre-wrap break-all leading-normal text-gray/30">
                  No events captured. Waiting for filesystem writes...
                </div>
              ) : (
                logs.map((line, idx) => (
                  <React.Fragment key={idx}>{parseLogLine(line)}</React.Fragment>
                ))
              )}
              <div ref={terminalEndRef}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
