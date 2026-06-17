import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Config, Profile, BackupInfo } from '../types';

interface GitCommit {
  hash: string;
  author: string;
  date: string;
  message: string;
}

interface StorageStats {
  total_size_bytes: number;
  backup_count: number;
  oldest_backup_time: string;
  newest_backup_time: string;
}

interface SystemStorageStats {
  primary_total_gb: number;
  primary_used_gb: number;
  primary_free_gb: number;
  primary_percent: number;
  cloud_total_gb: number;
  cloud_used_gb: number;
  cloud_free_gb: number;
  cloud_percent: number;
}

interface SaveTreeViewProps {
  config: Config;
  reloadConfig: () => void;
  initialProfileId?: string | null;
  initialOpenCreate?: boolean;
}

// Inline SVGs for beautiful, crisp, vector-based graphics
const BranchIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M18 18a3 3 0 100-6 3 3 0 000 6zm-12 0a3 3 0 100-6 3 3 0 000 6zm0-12a3 3 0 100-6 3 3 0 000 6zm6 7.5V11a3 3 0 00-3-3H6m6 3.5V20"
    />
  </svg>
);

const PlusIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);

const RefreshIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
    />
  </svg>
);

const FolderIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15a2.25 2.25 0 012.25 2.25v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
    />
  </svg>
);

const DatabaseIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75m-16.5-3.75v3.75"
    />
  </svg>
);

const TrashIcon: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
    />
  </svg>
);

const EditIcon: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
    />
  </svg>
);

const PlaythroughIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
    />
  </svg>
);

export const SaveTreeView: React.FC<SaveTreeViewProps> = ({
  config,
  reloadConfig,
  initialProfileId,
  initialOpenCreate,
}) => {
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(
    config.profiles.length > 0 ? config.profiles[0] : null
  );

  // Tab state: 'git' | 'local' | 'stats' | 'playthroughs'
  const [activeTab, setActiveTab] = useState<'git' | 'local' | 'stats' | 'playthroughs'>(
    'playthroughs'
  );

  // Playthrough / Save Profiling states
  const [showCreateSp, setShowCreateSp] = useState(false);
  const [newSpName, setNewSpName] = useState('');
  const [initType, setInitType] = useState<'fresh' | 'copy_current' | 'copy_backup'>(
    'copy_current'
  );
  const [selectedBackupZip, setSelectedBackupZip] = useState('');
  const [editingSpId, setEditingSpId] = useState<string | null>(null);
  const [editingSpName, setEditingSpName] = useState('');

  // Git state
  const [branches, setBranches] = useState<string[]>([]);
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<GitCommit | null>(null);
  const [currentBranch, setCurrentBranch] = useState(config.providers.git.branch || 'main');
  const [newBranchName, setNewBranchName] = useState('');
  const [showNewBranchInput, setShowNewBranchInput] = useState(false);

  // Local NAS backups state
  const [localBackups, setLocalBackups] = useState<BackupInfo[]>([]);

  // Statistics state
  const [profileStats, setProfileStats] = useState<Record<string, StorageStats>>({});
  const [systemStats, setSystemStats] = useState<SystemStorageStats | null>(null);

  // Operation status feedback
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError: boolean } | null>(
    null
  );
  const [loading, setLoading] = useState(false);

  // Auto-redirect sync logic
  useEffect(() => {
    if (initialProfileId) {
      const found = config.profiles.find((p) => p.id === initialProfileId);
      if (found) {
        setSelectedProfile(found);
      }
    }
    if (initialOpenCreate) {
      setShowCreateSp(true);
      setActiveTab('playthroughs');
    }
  }, [initialProfileId, initialOpenCreate, config.profiles]);

  // Load Git and local backups data on selection changes
  useEffect(() => {
    loadGitData();
    loadLocalBackups();
    loadStatsData();
  }, [selectedProfile]);

  // Sync current branch state with external config updates
  useEffect(() => {
    setCurrentBranch(config.providers.git.branch || 'main');
  }, [config.providers.git.branch]);

  const loadGitData = async () => {
    if (!config.providers.git.enabled) return;
    try {
      const branchesList: string[] = await invoke('get_git_branches');
      setBranches(branchesList);

      const commitsList: GitCommit[] = await invoke('get_git_commits', { maxCount: 20 });
      setCommits(commitsList);
      if (commitsList.length > 0) {
        setSelectedCommit(commitsList[0]);
      } else {
        setSelectedCommit(null);
      }
    } catch (err) {
      console.error('Failed to load Git info:', err);
    }
  };

  const loadLocalBackups = async () => {
    if (!selectedProfile) return;
    try {
      const list: BackupInfo[] = await invoke('get_backups', { profileId: selectedProfile.id });
      setLocalBackups(list);
    } catch (err) {
      console.error('Failed to load local backups:', err);
    }
  };

  const loadStatsData = async () => {
    try {
      const sysStats: SystemStorageStats = await invoke('get_system_storage_stats');
      setSystemStats(sysStats);

      const statsMap: Record<string, StorageStats> = {};
      for (const p of config.profiles) {
        const pStats: StorageStats = await invoke('get_profile_storage_stats', { profileId: p.id });
        statsMap[p.id] = pStats;
      }
      setProfileStats(statsMap);
    } catch (err) {
      console.error('Failed to load storage statistics:', err);
    }
  };

  const handleCheckoutBranch = async (branchName: string) => {
    setLoading(true);
    setStatusMessage(null);
    try {
      await invoke('checkout_git_branch', { branch: branchName });
      setCurrentBranch(branchName);

      // Keep background uploader aligned with active branch
      const updatedConfig = { ...config };
      updatedConfig.providers.git.branch = branchName;
      await invoke('save_config', { newConfig: updatedConfig });
      reloadConfig();

      setStatusMessage({
        text: `Successfully checked out branch and aligned background sync: ${branchName}`,
        isError: false,
      });
      loadGitData();
    } catch (err) {
      setStatusMessage({ text: `Checkout failed: ${err}`, isError: true });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) return;
    setLoading(true);
    setStatusMessage(null);
    const branch = newBranchName.trim();
    try {
      await invoke('create_git_branch', { branch });
      setCurrentBranch(branch);
      setNewBranchName('');
      setShowNewBranchInput(false);

      // Keep background uploader aligned with active branch
      const updatedConfig = { ...config };
      updatedConfig.providers.git.branch = branch;
      await invoke('save_config', { newConfig: updatedConfig });
      reloadConfig();

      setStatusMessage({
        text: `Successfully created playthrough branch: ${branch}`,
        isError: false,
      });
      loadGitData();
    } catch (err) {
      setStatusMessage({ text: `Failed to create branch: ${err}`, isError: true });
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreCommit = async (commitHash: string) => {
    if (!selectedProfile) return;
    const confirm = window.confirm(
      `Are you sure you want to restore game saves for "${selectedProfile.name}" back to Git commit snapshot ${commitHash.substring(0, 7)}? A rollback zip of your active folder will be created first.`
    );
    if (!confirm) return;

    setLoading(true);
    setStatusMessage(null);
    try {
      await invoke('restore_git_commit', {
        profileId: selectedProfile.id,
        commitHash,
      });
      setStatusMessage({
        text: `Successfully restored saves to snapshot: ${commitHash.substring(0, 7)}`,
        isError: false,
      });
      reloadConfig();
      loadLocalBackups();
    } catch (err) {
      setStatusMessage({ text: `Restore failed: ${err}`, isError: true });
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreLocalBackup = async (filename: string) => {
    if (!selectedProfile) return;
    const confirm = window.confirm(
      `Are you sure you want to rollback "${selectedProfile.name}" to the backup "${filename}"?`
    );
    if (!confirm) return;

    setLoading(true);
    setStatusMessage(null);
    try {
      await invoke('restore_backup', { profileId: selectedProfile.id, filename });
      setStatusMessage({ text: `Successfully restored local backup: ${filename}`, isError: false });
      reloadConfig();
      loadLocalBackups();
    } catch (err) {
      setStatusMessage({ text: `Restore failed: ${err}`, isError: true });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLocalBackup = async (filename: string) => {
    if (!selectedProfile) return;
    const confirm = window.confirm(
      `Are you sure you want to permanently delete the backup "${filename}"?`
    );
    if (!confirm) return;

    try {
      await invoke('delete_backup', { profileId: selectedProfile.id, filename });
      loadLocalBackups();
      loadStatsData();
    } catch (err) {
      setStatusMessage({ text: `Delete failed: ${err}`, isError: true });
    }
  };

  const handleRenameLocalBackup = async (filename: string) => {
    if (!selectedProfile) return;
    const newName = window.prompt(
      'Enter new filename for backup (include .zip extension):',
      filename
    );
    if (!newName || newName.trim() === filename) return;

    try {
      await invoke('rename_backup', {
        profileId: selectedProfile.id,
        oldFilename: filename,
        newFilename: newName.trim(),
      });
      loadLocalBackups();
    } catch (err) {
      setStatusMessage({ text: `Rename failed: ${err}`, isError: true });
    }
  };

  const handleGitGC = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const result: string = await invoke('gc_git_repository');
      setStatusMessage({
        text: `Repository optimized successfully: ${result || 'Loose objects packed.'}`,
        isError: false,
      });
      loadStatsData();
    } catch (err) {
      setStatusMessage({
        text: `Optimization failed: ${err}`,
        isError: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlaythrough = async () => {
    if (!selectedProfile || !newSpName.trim()) return;
    setLoading(true);
    setStatusMessage(null);
    try {
      await invoke('create_save_profile', {
        profileId: selectedProfile.id,
        name: newSpName.trim(),
        initType,
        sourceBackupZip: initType === 'copy_backup' ? selectedBackupZip : null,
      });
      setStatusMessage({ text: `Successfully created playthrough: ${newSpName}`, isError: false });
      setNewSpName('');
      setShowCreateSp(false);
      reloadConfig();
    } catch (err) {
      setStatusMessage({ text: `Failed to create playthrough: ${err}`, isError: true });
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchPlaythrough = async (spId: string, spName: string) => {
    if (!selectedProfile) return;
    const confirm = window.confirm(
      `Are you sure you want to switch to playthrough "${spName}"? Your current active files will be saved first.`
    );
    if (!confirm) return;

    setLoading(true);
    setStatusMessage(null);
    try {
      await invoke('switch_save_profile', {
        profileId: selectedProfile.id,
        targetSpId: spId,
      });
      setStatusMessage({ text: `Successfully switched to playthrough: ${spName}`, isError: false });
      reloadConfig();
    } catch (err) {
      setStatusMessage({ text: `Failed to swap playthrough: ${err}`, isError: true });
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePlaythrough = async (spId: string, spName: string) => {
    if (!selectedProfile) return;
    const confirm = window.confirm(
      `Are you sure you want to permanently delete playthrough "${spName}"? This will erase all its saved states.`
    );
    if (!confirm) return;

    try {
      await invoke('delete_save_profile', {
        profileId: selectedProfile.id,
        spId,
      });
      setStatusMessage({ text: `Deleted playthrough: ${spName}`, isError: false });
      reloadConfig();
    } catch (err) {
      setStatusMessage({ text: `Failed to delete playthrough: ${err}`, isError: true });
    }
  };

  const handleRenamePlaythrough = async (spId: string) => {
    if (!selectedProfile || !editingSpName.trim()) return;
    try {
      await invoke('rename_save_profile', {
        profileId: selectedProfile.id,
        spId,
        newName: editingSpName.trim(),
      });
      setEditingSpId(null);
      setEditingSpName('');
      reloadConfig();
    } catch (err) {
      setStatusMessage({ text: `Failed to rename: ${err}`, isError: true });
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="flex flex-col h-full min-h-0 select-none">
      {/* Title & Description Header Section */}
      <header className="mb-6 shrink-0 flex justify-between items-center flex-wrap gap-4">
        <div className="flex flex-col">
          <h1 className="text-[22px] font-bold tracking-[1.5px] text-white uppercase font-sans">
            Save Playthrough Controller
          </h1>
          <p className="text-gray text-xs mt-1">
            Browse playthrough snapshots, manage development branches, inspect local archives, and
            analyze storage footprints.
          </p>
        </div>
      </header>

      {/* Main Split-Pane Layout Area */}
      <div className="grow min-h-0 flex gap-6 pb-2">
        {/* Left Side: Game Profiles Selector list */}
        <div className="w-[230px] shrink-0 flex flex-col gap-2.5 overflow-y-auto scrollbar">
          <span className="font-mono text-[9px] font-bold text-gray uppercase tracking-[0.8px] px-1 select-none">
            CHOOSE GAME PROFILE
          </span>
          {config.profiles.map((profile) => (
            <button
              key={profile.id}
              onClick={() => setSelectedProfile(profile)}
              className={`w-full text-left p-3.5 rounded-card border transition-all duration-200 cursor-pointer flex flex-col gap-1 relative overflow-hidden group
                ${
                  selectedProfile?.id === profile.id
                    ? 'bg-cyan/5 border-cyan shadow-[0_0_12px_rgba(0,242,254,0.06)]'
                    : 'bg-bg-card/45 border-tech-border/40 hover:border-cyan/35 hover:bg-white/1'
                }`}
            >
              {selectedProfile?.id === profile.id && (
                <span className="absolute top-0 left-0 bottom-0 w-[3px] bg-cyan" />
              )}
              <span className="text-[12.5px] font-bold text-white tracking-[0.2px] truncate">
                {profile.name}
              </span>
              <div className="flex items-center justify-between text-[10px] text-gray/80 mt-1">
                <span>Backups:</span>
                <span className="font-mono font-semibold text-white">
                  {profileStats[profile.id]?.backup_count ?? 0}
                </span>
              </div>
            </button>
          ))}
          {config.profiles.length === 0 && (
            <div className="text-center py-8 text-gray text-xs border border-dashed border-tech-border/30 rounded-card bg-black/10">
              No game profiles added.
            </div>
          )}
        </div>

        {/* Right Side: Active save tree controller detail card */}
        <div className="flex-1 min-h-0 bg-[#090f10]/70 backdrop-blur-md border border-tech-border rounded-card flex flex-col overflow-hidden shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]">
          {/* Top Sticky Header */}
          <div className="shrink-0 p-5 border-b border-tech-border/20 bg-[#070b0c]/90 z-20 flex justify-between items-center flex-wrap gap-4">
            <div className="flex-grow pr-4">
              <h2 className="text-sm font-bold tracking-[1.2px] text-white uppercase font-sans flex items-center gap-2">
                <span>
                  {selectedProfile ? `${selectedProfile.name} version tree` : 'Select Profile'}
                </span>
              </h2>
              <p className="text-[11px] text-gray mt-1">
                Explore chronological save checkpoints across cloud and NAS providers.
              </p>
            </div>

            {/* View Selection Mode Toggles */}
            <div className="flex border border-tech-border rounded-inner overflow-hidden h-[30px]">
              <button
                type="button"
                className={`px-3 font-sans font-bold text-[10px] tracking-[0.5px] transition-colors cursor-pointer select-none flex items-center gap-1.5
                  ${activeTab === 'playthroughs' ? 'bg-cyan/15 text-cyan' : 'text-gray/50 hover:text-white bg-transparent'}`}
                onClick={() => setActiveTab('playthroughs')}
              >
                <PlaythroughIcon className="w-3.5 h-3.5" />
                PLAYTHROUGHS
              </button>
              <button
                type="button"
                className={`px-3 font-sans font-bold text-[10px] tracking-[0.5px] transition-colors cursor-pointer select-none flex items-center gap-1.5 border-l border-tech-border
                  ${activeTab === 'git' ? 'bg-cyan/15 text-cyan' : 'text-gray/50 hover:text-white bg-transparent'}`}
                onClick={() => setActiveTab('git')}
              >
                <BranchIcon className="w-3.5 h-3.5" />
                GIT TREE
              </button>
              <button
                type="button"
                className={`px-3 font-sans font-bold text-[10px] tracking-[0.5px] transition-colors cursor-pointer select-none flex items-center gap-1.5 border-l border-tech-border
                  ${activeTab === 'local' ? 'bg-cyan/15 text-cyan' : 'text-gray/50 hover:text-white bg-transparent'}`}
                onClick={() => setActiveTab('local')}
              >
                <FolderIcon className="w-3.5 h-3.5" />
                NAS / LOCAL
              </button>
              <button
                type="button"
                className={`px-3 font-sans font-bold text-[10px] tracking-[0.5px] transition-colors cursor-pointer select-none flex items-center gap-1.5 border-l border-tech-border
                  ${activeTab === 'stats' ? 'bg-cyan/15 text-cyan' : 'text-gray/50 hover:text-white bg-transparent'}`}
                onClick={() => setActiveTab('stats')}
              >
                <DatabaseIcon className="w-3.5 h-3.5" />
                DB ANALYZE
              </button>
            </div>
          </div>

          {/* Operation Status Feedback message banner */}
          {statusMessage && (
            <div
              className={`shrink-0 px-5 py-3 border-b flex justify-between items-center text-xs animate-[fade-slide-in_0.2s_ease-out]
                ${statusMessage.isError ? 'bg-crimson/10 border-crimson/25 text-crimson' : 'bg-green/10 border-green/25 text-green'}`}
            >
              <span>{statusMessage.text}</span>
              <button
                onClick={() => setStatusMessage(null)}
                className="bg-transparent border-none text-[11px] font-bold text-gray hover:text-white cursor-pointer"
              >
                DISMISS
              </button>
            </div>
          )}

          {/* Detail content area */}
          <div className="grow min-h-0 relative flex flex-col bg-bg-inner/15">
            {/* Top Fade Overlay */}
            <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-[#090f10] to-transparent pointer-events-none z-10 opacity-80" />

            {/* Scrollable Content Body */}
            <div className="grow overflow-y-auto px-6 py-5 scrollbar">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <div className="w-6 h-6 border-2 border-t-cyan border-tech-border/30 rounded-full animate-spin"></div>
                  <span className="text-xs text-gray font-mono uppercase tracking-wider">
                    EXECUTING GIT REQUEST...
                  </span>
                </div>
              ) : (
                <>
                  {/* TAB: PLAYTHROUGHS SECTION */}
                  {activeTab === 'playthroughs' && selectedProfile && (
                    <div className="space-y-6 animate-fade-in">
                      {/* Playthrough Header Info */}
                      <div className="flex justify-between items-center bg-[#0d1618]/30 border border-tech-border/30 rounded-xl p-4 flex-wrap gap-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-cyan/10 rounded-inner text-cyan">
                            <PlaythroughIcon className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="text-[10px] text-gray uppercase font-mono font-bold tracking-wider block">
                              Active Playthrough Slot
                            </span>
                            <span className="text-white text-sm font-bold tracking-wide">
                              {selectedProfile.save_profiles?.find(
                                (sp) => sp.id === selectedProfile.active_save_profile_id
                              )?.name || 'Default Profile'}
                            </span>
                          </div>
                        </div>

                        {!showCreateSp && (
                          <button
                            onClick={() => {
                              setShowCreateSp(true);
                              setInitType('copy_current');
                              if (localBackups.length > 0) {
                                setSelectedBackupZip(localBackups[0].filename);
                              }
                            }}
                            className="inline-flex items-center gap-1.5 bg-cyan text-[#032021] font-bold text-[10.5px] tracking-[0.5px] px-4 py-2 rounded-inner border border-transparent hover:bg-[#33f5ff] hover:shadow-[0_0_10px_rgba(0,242,254,0.25)] transition-all cursor-pointer uppercase font-sans"
                          >
                            <PlusIcon className="w-3.5 h-3.5" />
                            Create Playthrough
                          </button>
                        )}
                      </div>

                      {/* Creation Mode Form Panel */}
                      {showCreateSp && (
                        <div className="border border-cyan/40 bg-[#061214]/60 rounded-xl p-5 space-y-4 animate-[fade-slide-in_0.2s_ease-out] relative">
                          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan to-purple" />
                          <div className="flex justify-between items-center border-b border-tech-border/20 pb-2.5">
                            <span className="font-mono text-[10px] font-bold text-white uppercase tracking-[0.8px]">
                              Configure New Playthrough
                            </span>
                            <button
                              onClick={() => {
                                setShowCreateSp(false);
                                setNewSpName('');
                              }}
                              className="text-gray/50 hover:text-white font-mono text-[9px] uppercase font-bold tracking-wide cursor-pointer"
                            >
                              [ Close ]
                            </button>
                          </div>

                          <div className="space-y-4">
                            {/* Input Name */}
                            <div className="flex flex-col gap-1.5">
                              <label className="font-mono text-[9px] font-bold text-gray uppercase tracking-[0.8px]">
                                Playthrough Title
                              </label>
                              <input
                                type="text"
                                className="w-full bg-bg-dark border border-tech-border rounded px-3.5 py-2 text-xs text-white font-mono outline-none focus:border-cyan"
                                placeholder="e.g. Rogue Playthrough, NG+ Run"
                                value={newSpName}
                                onChange={(e) => setNewSpName(e.target.value)}
                              />
                            </div>

                            {/* Init Source Selection */}
                            <div className="space-y-2">
                              <span className="font-mono text-[9px] font-bold text-gray uppercase tracking-[0.8px] block">
                                Save Initialization Source
                              </span>

                              <div className="grid grid-cols-1 gap-2.5">
                                {/* Radio 1: Copy Current */}
                                <label
                                  className={`border rounded-lg p-3 flex items-start gap-3 cursor-pointer transition-all duration-200 select-none
                                  ${initType === 'copy_current' ? 'border-cyan bg-cyan/5' : 'bg-black/15 border-tech-border/20 hover:border-cyan/30'}`}
                                >
                                  <input
                                    type="radio"
                                    name="init_type"
                                    className="mt-0.5 accent-cyan"
                                    checked={initType === 'copy_current'}
                                    onChange={() => setInitType('copy_current')}
                                  />
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-[11.5px] font-bold text-white leading-none">
                                      Copy Current Saves (Recommended)
                                    </span>
                                    <span className="text-[10px] text-gray/60 leading-normal">
                                      Initializes this playthrough with a copy of your active save
                                      files.
                                    </span>
                                  </div>
                                </label>

                                {/* Radio 2: Start Fresh */}
                                <label
                                  className={`border rounded-lg p-3 flex items-start gap-3 cursor-pointer transition-all duration-200 select-none
                                  ${initType === 'fresh' ? 'border-cyan bg-cyan/5' : 'bg-black/15 border-tech-border/20 hover:border-cyan/30'}`}
                                >
                                  <input
                                    type="radio"
                                    name="init_type"
                                    className="mt-0.5 accent-cyan"
                                    checked={initType === 'fresh'}
                                    onChange={() => setInitType('fresh')}
                                  />
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-[11.5px] font-bold text-white leading-none">
                                      Start Fresh (Clean Slate)
                                    </span>
                                    <span className="text-[10px] text-gray/60 leading-normal">
                                      Active save folder will be cleared so you can start a new
                                      playthrough from scratch.
                                    </span>
                                  </div>
                                </label>

                                {/* Radio 3: Restore Backup */}
                                <label
                                  className={`border rounded-lg p-3 flex flex-col gap-3 cursor-pointer transition-all duration-200 select-none
                                  ${initType === 'copy_backup' ? 'border-cyan bg-cyan/5' : 'bg-black/15 border-tech-border/20 hover:border-cyan/30'}`}
                                >
                                  <div className="flex items-start gap-3 w-full">
                                    <input
                                      type="radio"
                                      name="init_type"
                                      className="mt-0.5 accent-cyan"
                                      checked={initType === 'copy_backup'}
                                      onChange={() => setInitType('copy_backup')}
                                    />
                                    <div className="flex flex-col gap-0.5">
                                      <span className="text-[11.5px] font-bold text-white leading-none">
                                        Copy From Existing Save Point / Backup
                                      </span>
                                      <span className="text-[10px] text-gray/60 leading-normal">
                                        Extracts a previous backup archive directly as the initial
                                        state of this slot.
                                      </span>
                                    </div>
                                  </div>

                                  {initType === 'copy_backup' && (
                                    <div className="pl-6 w-full animate-[fade-slide-in_0.15s_ease-out]">
                                      {localBackups.length > 0 ? (
                                        <select
                                          className="w-full max-w-md bg-bg-dark border border-tech-border rounded py-1.5 px-2.5 text-xs text-white font-mono outline-none focus:border-cyan cursor-pointer"
                                          value={selectedBackupZip}
                                          onChange={(e) => setSelectedBackupZip(e.target.value)}
                                        >
                                          {localBackups.map((b) => (
                                            <option key={b.filename} value={b.filename}>
                                              {b.filename} ({formatSize(b.size_bytes)})
                                            </option>
                                          ))}
                                        </select>
                                      ) : (
                                        <span className="text-[10px] text-crimson font-bold uppercase tracking-wider block">
                                          No local backups available to copy from.
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </label>
                              </div>
                            </div>

                            {/* Submit Buttons */}
                            <div className="flex items-center gap-3 pt-2.5">
                              <button
                                onClick={handleCreatePlaythrough}
                                disabled={
                                  !newSpName.trim() ||
                                  loading ||
                                  (initType === 'copy_backup' && localBackups.length === 0)
                                }
                                className="bg-cyan text-bg-dark font-bold text-[10.5px] px-5 py-2.5 rounded-lg hover:bg-[#33f5ff] transition-all cursor-pointer uppercase disabled:opacity-45 disabled:cursor-not-allowed select-none"
                              >
                                CREATE PLAYTHROUGH
                              </button>
                              <button
                                onClick={() => {
                                  setShowCreateSp(false);
                                  setNewSpName('');
                                }}
                                className="bg-transparent border border-tech-border/40 text-gray hover:text-white font-bold text-[10.5px] px-5 py-2.5 rounded-lg transition-all cursor-pointer uppercase select-none"
                              >
                                CANCEL
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Playthrough List */}
                      <div className="space-y-3">
                        <span className="font-mono text-[9px] font-bold text-gray uppercase tracking-[0.8px] px-1 select-none">
                          ALL PLAYTHROUGHS
                        </span>

                        {(selectedProfile.save_profiles || []).map((sp) => {
                          const isActive = sp.id === selectedProfile.active_save_profile_id;
                          const isEditing = editingSpId === sp.id;

                          return (
                            <div
                              key={sp.id}
                              className={`p-4 border rounded-xl bg-black/15 flex items-center justify-between flex-wrap gap-4 transition-all duration-200
                                ${isActive ? 'border-cyan/45 shadow-[0_0_8px_rgba(0,242,254,0.03)] bg-cyan/[0.01]' : 'border-tech-border/15 hover:border-cyan/15 hover:bg-black/20'}`}
                            >
                              <div className="flex items-center gap-3.5 min-w-0 grow">
                                <div
                                  className={`p-2 rounded-lg shrink-0 ${isActive ? 'bg-cyan/10 text-cyan' : 'bg-white/5 text-gray/50'}`}
                                >
                                  <PlaythroughIcon className="w-5 h-5" />
                                </div>

                                <div className="flex-grow min-w-0">
                                  {isEditing ? (
                                    <div className="flex items-center gap-2 max-w-sm">
                                      <input
                                        type="text"
                                        className="grow bg-bg-dark border border-tech-border rounded px-2.5 py-1 text-xs text-white font-mono outline-none focus:border-cyan"
                                        value={editingSpName}
                                        onChange={(e) => setEditingSpName(e.target.value)}
                                        autoFocus
                                      />
                                      <button
                                        onClick={() => handleRenamePlaythrough(sp.id)}
                                        className="bg-cyan text-bg-dark font-bold text-[9px] px-2.5 py-1 rounded hover:bg-[#33f5ff] transition-all cursor-pointer"
                                      >
                                        SAVE
                                      </button>
                                      <button
                                        onClick={() => {
                                          setEditingSpId(null);
                                          setEditingSpName('');
                                        }}
                                        className="bg-transparent border border-tech-border/30 text-gray hover:text-white font-bold text-[9px] px-2.5 py-1 rounded transition-all cursor-pointer"
                                      >
                                        ESC
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <span className="text-[12.5px] font-bold text-white tracking-[0.2px] truncate">
                                        {sp.name}
                                      </span>
                                      <button
                                        onClick={() => {
                                          setEditingSpId(sp.id);
                                          setEditingSpName(sp.name);
                                        }}
                                        className="text-gray/45 hover:text-cyan p-0.5 transition-colors cursor-pointer"
                                        title="Rename"
                                      >
                                        <EditIcon className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  )}
                                  <div className="text-[10px] text-gray/45 font-mono mt-0.5 font-semibold">
                                    Created: {sp.created_at}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2.5 shrink-0">
                                {isActive ? (
                                  <span className="inline-flex items-center gap-1.5 font-mono text-[9.5px] font-bold text-green bg-green/10 border border-green/20 px-3 py-1.5 rounded-lg select-none shadow-[0_0_6px_rgba(34,197,94,0.06)]">
                                    <span className="w-1.5 h-1.5 bg-green rounded-full animate-pulse shadow-[0_0_4px_rgba(34,197,94,0.5)]"></span>
                                    ACTIVE SLOT
                                  </span>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => handleSwitchPlaythrough(sp.id, sp.name)}
                                      disabled={loading}
                                      className="bg-cyan/10 border border-cyan/20 hover:border-cyan text-cyan hover:text-white font-bold text-[10.5px] px-3.5 py-1.5 rounded-lg transition-all cursor-pointer uppercase tracking-[0.5px] disabled:opacity-40"
                                    >
                                      SWAP PLAYTHROUGH
                                    </button>
                                    <button
                                      onClick={() => handleDeletePlaythrough(sp.id, sp.name)}
                                      className="p-1.5 bg-crimson/10 border border-crimson/20 rounded text-crimson hover:bg-crimson hover:text-white transition-all cursor-pointer"
                                      title="Delete Playthrough"
                                    >
                                      <TrashIcon className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {(selectedProfile.save_profiles || []).length === 0 && (
                          <div className="text-center py-10 border border-dashed border-tech-border/20 rounded-xl bg-black/10">
                            <span className="text-gray text-xs">No playthroughs config found.</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 1: GIT VERSION CONTROL TREE */}
                  {activeTab === 'git' && (
                    <div className="space-y-6 animate-fade-in">
                      {/* Check if Git is enabled */}
                      {!config.providers.git.enabled ? (
                        <div className="border border-tech-border/20 rounded-xl p-6 bg-black/10 text-center space-y-3">
                          <span className="font-mono text-xs text-gray uppercase font-bold">
                            Git Provider Inactive
                          </span>
                          <p className="text-gray text-xs max-w-md mx-auto leading-relaxed">
                            To view branch trees and snapshot timelines, you need to enable and
                            configure the Git repository provider in Settings.
                          </p>
                        </div>
                      ) : (
                        <>
                          {/* Branch Management Hub */}
                          <div className="p-4 border border-tech-border/20 rounded-xl bg-black/15 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-cyan/10 rounded-inner text-cyan">
                                <BranchIcon className="w-5 h-5" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[11.5px] font-bold text-gray uppercase tracking-wider">
                                  ACTIVE GIT BRANCH
                                </span>
                                <span className="font-mono text-[13px] text-white font-bold">
                                  {currentBranch}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {showNewBranchInput ? (
                                <div className="flex items-center gap-2 animate-[fade-slide-in_0.15s_ease-out]">
                                  <input
                                    type="text"
                                    placeholder="Branch name..."
                                    value={newBranchName}
                                    onChange={(e) =>
                                      setNewBranchName(e.target.value.replace(/\s+/g, '-'))
                                    }
                                    className="bg-bg-dark border border-tech-border rounded px-3 py-1.5 text-xs text-white font-mono h-[32px] w-[140px] outline-none focus:border-cyan"
                                  />
                                  <button
                                    onClick={handleCreateBranch}
                                    className="bg-cyan text-bg-dark font-bold text-[10px] px-3.5 h-[32px] rounded border border-transparent hover:bg-[#33f5ff] transition-all cursor-pointer uppercase"
                                  >
                                    OK
                                  </button>
                                  <button
                                    onClick={() => {
                                      setShowNewBranchInput(false);
                                      setNewBranchName('');
                                    }}
                                    className="bg-transparent text-gray border border-tech-border/40 font-bold text-[10px] px-3.5 h-[32px] rounded hover:text-white transition-all cursor-pointer uppercase"
                                  >
                                    CANCEL
                                  </button>
                                </div>
                              ) : (
                                <>
                                  {/* Branch Switcher Select */}
                                  <select
                                    value={currentBranch}
                                    onChange={(e) => handleCheckoutBranch(e.target.value)}
                                    className="bg-bg-dark border border-tech-border rounded px-3.5 py-1.5 text-xs text-white font-mono h-[32px] outline-none focus:border-cyan cursor-pointer"
                                  >
                                    {branches.map((b) => (
                                      <option key={b} value={b}>
                                        {b}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    onClick={() => setShowNewBranchInput(true)}
                                    className="inline-flex items-center gap-1.5 bg-white/5 border border-tech-border/40 hover:border-cyan/45 text-white hover:text-cyan font-bold text-[10px] px-3.5 h-[32px] rounded transition-all cursor-pointer uppercase"
                                  >
                                    <PlusIcon className="w-3 h-3" />
                                    BRANCH Playthrough
                                  </button>
                                </>
                              )}
                              <button
                                onClick={loadGitData}
                                className="p-2 bg-white/5 border border-tech-border/40 rounded hover:border-cyan hover:text-cyan transition-all cursor-pointer"
                                title="Refresh Logs"
                              >
                                <RefreshIcon className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Commit Timeline Tree */}
                          <div className="flex gap-6 mt-6">
                            {/* Visual Timeline Nodes */}
                            <div className="flex-grow space-y-4 relative pl-5 border-l border-tech-border/20">
                              <div className="absolute top-0 bottom-0 left-0 w-[1px] bg-gradient-to-b from-cyan via-tech-border/30 to-transparent" />
                              {commits.map((commit) => (
                                <div
                                  key={commit.hash}
                                  onClick={() => setSelectedCommit(commit)}
                                  className={`p-3.5 rounded-xl border transition-all duration-200 cursor-pointer relative group flex flex-col gap-1.5
                                    ${
                                      selectedCommit?.hash === commit.hash
                                        ? 'bg-cyan/4 border-cyan shadow-[0_0_10px_rgba(0,242,254,0.04)]'
                                        : 'bg-black/10 border-tech-border/15 hover:border-cyan/30 hover:bg-black/20'
                                    }`}
                                >
                                  {/* Timeline node dot */}
                                  <div
                                    className={`w-2.5 h-2.5 rounded-full absolute -left-[25.5px] top-[18px] border-2 transition-all duration-200
                                      ${
                                        selectedCommit?.hash === commit.hash
                                          ? 'bg-cyan border-cyan shadow-[0_0_6px_var(--color-cyan)] scale-110'
                                          : 'bg-bg-dark border-tech-border group-hover:border-cyan'
                                      }`}
                                  />

                                  <div className="flex items-center justify-between flex-wrap gap-2 text-[10.5px]">
                                    <span className="font-mono text-cyan font-bold bg-cyan/10 border border-cyan/15 px-2 py-0.5 rounded">
                                      {commit.hash.substring(0, 7)}
                                    </span>
                                    <span className="text-gray/50 font-mono">{commit.date}</span>
                                  </div>

                                  <span className="text-[12.5px] font-semibold text-white tracking-[0.2px] leading-snug">
                                    {commit.message}
                                  </span>

                                  <div className="flex items-center gap-1.5 text-[10px] text-gray/60">
                                    <span>Author:</span>
                                    <span className="font-mono text-gray/90 font-medium">
                                      {commit.author}
                                    </span>
                                  </div>
                                </div>
                              ))}

                              {commits.length === 0 && (
                                <div className="text-center py-12 text-gray/55 text-xs">
                                  No commits found in the active branch repository.
                                </div>
                              )}
                            </div>

                            {/* Timeline Snapshot Detail Pane (Fixed right panel) */}
                            {selectedCommit && (
                              <div className="w-[280px] shrink-0 border border-tech-border/30 rounded-xl bg-black/20 p-5 self-start space-y-4 animate-[fade-slide-in_0.2s_ease-out]">
                                <span className="font-mono text-[9px] font-bold text-gray uppercase tracking-[0.8px] border-b border-tech-border/10 pb-2.5 block">
                                  SNAPSHOT SPECIFICATIONS
                                </span>

                                <div className="space-y-3.5 text-xs text-white">
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-[9.5px] text-gray uppercase">
                                      Commit Hash
                                    </span>
                                    <span className="font-mono text-[11px] text-cyan select-all break-all">
                                      {selectedCommit.hash}
                                    </span>
                                  </div>
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-[9.5px] text-gray uppercase">
                                      Timestamp
                                    </span>
                                    <span className="font-mono text-white">
                                      {selectedCommit.date}
                                    </span>
                                  </div>
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-[9.5px] text-gray uppercase">
                                      Message
                                    </span>
                                    <span className="font-medium text-white leading-normal">
                                      {selectedCommit.message}
                                    </span>
                                  </div>
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-[9.5px] text-gray uppercase">Author</span>
                                    <span className="font-medium text-white">
                                      {selectedCommit.author}
                                    </span>
                                  </div>
                                </div>

                                <button
                                  onClick={() => handleRestoreCommit(selectedCommit.hash)}
                                  className="w-full inline-flex items-center justify-center gap-1.5 bg-cyan text-[#032021] font-bold text-[11px] tracking-[0.5px] py-2.5 rounded-lg border border-transparent hover:bg-[#33f5ff] hover:shadow-[0_0_10px_rgba(0,242,254,0.3)] transition-all cursor-pointer uppercase mt-2"
                                >
                                  RESTORE TO THIS COMMIT
                                </button>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* TAB 2: NAS & LOCAL BACKUPS LIST */}
                  {activeTab === 'local' && (
                    <div className="space-y-4 animate-fade-in">
                      {localBackups.map((backup) => (
                        <div
                          key={backup.filename}
                          className="p-4 border border-tech-border/20 rounded-xl bg-black/15 flex items-center justify-between flex-wrap gap-4 hover:border-cyan/20 transition-all duration-200"
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div className="p-2 bg-white/5 rounded-lg text-gray/60 shrink-0">
                              <FolderIcon className="w-5 h-5" />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-[12.5px] font-bold text-white tracking-[0.2px] truncate select-all">
                                {backup.filename}
                              </span>
                              <div className="flex items-center gap-3 text-[10.5px] text-gray/50 mt-1 flex-wrap">
                                <span className="font-mono">{backup.created_at}</span>
                                <span className="w-1 h-1 bg-tech-border/30 rounded-full" />
                                <span className="font-mono">{formatSize(backup.size_bytes)}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleRestoreLocalBackup(backup.filename)}
                              className="bg-cyan/10 border border-cyan/20 hover:border-cyan text-cyan hover:text-white font-bold text-[10.5px] px-3.5 py-1.5 rounded-lg transition-all cursor-pointer uppercase tracking-[0.5px]"
                            >
                              RESTORE
                            </button>
                            <button
                              onClick={() => handleRenameLocalBackup(backup.filename)}
                              className="p-2 bg-white/5 border border-tech-border/30 rounded hover:border-cyan hover:text-cyan transition-all cursor-pointer"
                              title="Rename File"
                            >
                              <EditIcon className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteLocalBackup(backup.filename)}
                              className="p-2 bg-crimson/10 border border-crimson/20 rounded text-crimson hover:bg-crimson hover:text-white transition-all cursor-pointer"
                              title="Delete Archive"
                            >
                              <TrashIcon className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}

                      {localBackups.length === 0 && (
                        <div className="text-center py-16 text-gray border border-dashed border-tech-border/20 rounded-xl bg-black/10 space-y-2.5">
                          <span className="font-mono text-xs uppercase text-gray/60 font-bold block">
                            No archives found
                          </span>
                          <p className="text-xs text-gray/80 max-w-xs mx-auto leading-normal">
                            No zipped local backups exist for this game profile folder yet.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 3: STORAGE ANALYSIS AND DB DETAILS */}
                  {activeTab === 'stats' && (
                    <div className="space-y-6 animate-fade-in">
                      {/* Storage Progress Rings/Bars */}
                      {systemStats && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          {/* Primary drive space */}
                          <div className="p-5 border border-tech-border/20 rounded-xl bg-black/15 flex flex-col gap-3">
                            <span className="font-mono text-[9px] font-bold text-gray uppercase tracking-[0.8px]">
                              PRIMARY BACKUP HDD SPACE
                            </span>
                            <div className="flex justify-between text-xs text-white font-semibold mt-1">
                              <span>Used: {systemStats.primary_used_gb.toFixed(1)} GB</span>
                              <span>Free: {systemStats.primary_free_gb.toFixed(1)} GB</span>
                            </div>
                            {/* Gauge track */}
                            <div className="w-full h-2 rounded bg-tech-border/10 overflow-hidden relative border border-tech-border/10">
                              <div
                                className="h-full bg-cyan transition-all duration-300 shadow-[0_0_8px_var(--color-cyan)]"
                                style={{ width: `${systemStats.primary_percent}%` }}
                              />
                            </div>
                            <span className="text-[10.5px] text-gray/50 font-mono text-right mt-0.5">
                              {systemStats.primary_percent}% capacity filled (Total:{' '}
                              {systemStats.primary_total_gb.toFixed(0)} GB)
                            </span>
                          </div>

                          {/* Cloud/NAS drive space */}
                          <div className="p-5 border border-tech-border/20 rounded-xl bg-black/15 flex flex-col gap-3">
                            <span className="font-mono text-[9px] font-bold text-gray uppercase tracking-[0.8px]">
                              {config.providers.local_backup.enabled
                                ? 'SECONDARY NAS DRIVE SPACE'
                                : 'CLOUD GIT repository PRESET'}
                            </span>
                            <div className="flex justify-between text-xs text-white font-semibold mt-1">
                              <span>Used: {systemStats.cloud_used_gb.toFixed(2)} GB</span>
                              <span>Free: {systemStats.cloud_free_gb.toFixed(2)} GB</span>
                            </div>
                            {/* Gauge track */}
                            <div className="w-full h-2 rounded bg-tech-border/10 overflow-hidden relative border border-tech-border/10">
                              <div
                                className="h-full bg-purple transition-all duration-300 shadow-[0_0_8px_var(--color-purple)]"
                                style={{ width: `${systemStats.cloud_percent}%` }}
                              />
                            </div>
                            <span className="text-[10.5px] text-gray/50 font-mono text-right mt-0.5">
                              {systemStats.cloud_percent.toFixed(1)}% capacity filled (Total:{' '}
                              {systemStats.cloud_total_gb.toFixed(1)} GB)
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Profiles breakdown list */}
                      <div className="border border-tech-border/20 rounded-xl bg-black/15 p-5 space-y-4">
                        <span className="font-mono text-[9px] font-bold text-gray uppercase tracking-[0.8px] border-b border-tech-border/10 pb-2.5 block">
                          GAME DATABASE BREAKDOWN TABLE
                        </span>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-tech-border/20 text-gray/65 uppercase tracking-wider font-semibold text-[10px]">
                                <th className="pb-3 pr-4">Game Title</th>
                                <th className="pb-3 px-4">Backup Count</th>
                                <th className="pb-3 px-4">Allocated Size</th>
                                <th className="pb-3 px-4">Newest Backup</th>
                                <th className="pb-3 pl-4">Oldest Backup</th>
                              </tr>
                            </thead>
                            <tbody>
                              {config.profiles.map((p) => {
                                const stats = profileStats[p.id];
                                return (
                                  <tr
                                    key={p.id}
                                    className="border-b border-tech-border/10 text-white hover:bg-white/[0.01] transition-colors"
                                  >
                                    <td className="py-3 pr-4 font-bold max-w-[150px] truncate">
                                      {p.name}
                                    </td>
                                    <td className="py-3 px-4 font-mono font-semibold">
                                      {stats?.backup_count ?? 0} Archives
                                    </td>
                                    <td className="py-3 px-4 font-mono font-semibold">
                                      {formatSize(stats?.total_size_bytes ?? 0)}
                                    </td>
                                    <td className="py-3 px-4 font-mono text-gray/70">
                                      {stats?.newest_backup_time ?? 'N/A'}
                                    </td>
                                    <td className="py-3 pl-4 font-mono text-gray/70">
                                      {stats?.oldest_backup_time ?? 'N/A'}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Repository Footprint Optimization Section */}
                      {config.providers.git.enabled && (
                        <div className="border border-tech-border/20 rounded-xl bg-black/15 p-5 space-y-4 animate-fade-in">
                          <div className="flex justify-between items-center border-b border-tech-border/10 pb-2.5">
                            <span className="font-mono text-[9px] font-bold text-gray uppercase tracking-[0.8px]">
                              Repository Footprint Optimization
                            </span>
                            <span className="text-[10px] text-gray/60 font-mono bg-purple/10 border border-purple/15 px-2 py-0.5 rounded">
                              LTSC STABILITY CONTROL
                            </span>
                          </div>
                          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                            <div className="flex-1 space-y-1">
                              <h3 className="text-white text-xs font-semibold">
                                Clean Git History & Compress Objects
                              </h3>
                              <p className="text-[11px] text-gray/70 leading-relaxed">
                                Running garbage collection (`git gc`) optimizes the local database,
                                packages loose backup files, and cleans up historical blobs from the
                                local disk cache. This reduces the disk footprint of your version
                                tree.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={handleGitGC}
                              disabled={loading}
                              className="shrink-0 inline-flex items-center justify-center gap-1.5 bg-purple text-white font-bold text-[10.5px] tracking-[0.5px] px-4 py-2.5 rounded-lg border border-transparent hover:bg-purple/80 hover:shadow-[0_0_12px_rgba(168,85,247,0.25)] active:scale-95 transition-all cursor-pointer uppercase disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Optimize Git Repository
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
