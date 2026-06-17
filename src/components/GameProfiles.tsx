import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Config, Profile } from '../types';

interface GameProfilesViewProps {
  config: Config;
  newProfileName: string;
  setNewProfileName: (val: string) => void;
  newProfilePath: string;
  setNewProfilePath: (val: string) => void;
  gameExePath: string;
  setGameExePath: (val: string) => void;
  editingProfileId: string | null;
  setEditingProfileId: (val: string | null) => void;
  confirmDeleteId: string | null;
  setConfirmDeleteId: (val: string | null) => void;
  detectionMessage: { text: string; isError: boolean } | null;
  setDetectionMessage: (val: { text: string; isError: boolean } | null) => void;
  detecting: boolean;
  handleBrowseDir: (setter: (val: string) => void) => void;
  handleBrowseFileAndDetect: () => void;
  handleAddProfile: (
    name: string,
    path: string,
    coverUrl: string | null,
    exePath: string | null
  ) => void;
  handleSaveProfileEdit: (
    id: string,
    name: string,
    path: string,
    enabled: boolean,
    coverUrl?: string | null,
    exePath?: string | null
  ) => void;
  handleRemoveProfile: (id: string) => void;
  handleToggleProfileEnabled: (profile: Profile) => void;
  backingUp: boolean;
  reloadConfig: () => void;
  onNavigateToSaveTree: (profileId: string, openCreate: boolean) => void;
}

interface CoverSearchResult {
  title: string;
  cover_url: string;
  source: string;
}

interface StorageStats {
  total_size_bytes: number;
  backup_count: number;
  oldest_backup_time: string;
  newest_backup_time: string;
}

interface BackupInfo {
  filename: string;
  path: string;
  size_bytes: number;
  created_at: string;
}

// Inline SVGs for beautiful design accents
const SearchIcon = () => (
  <svg
    className="w-4 h-4 text-gray/50"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    viewBox="0 0 24 24"
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const GridIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
  </svg>
);

const ListIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

const PlayIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

const SyncIcon = ({ className = 'w-4 h-4' }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    viewBox="0 0 24 24"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
  </svg>
);

const HistoryIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const FolderIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const EditIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const TrashIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

const PlaythroughIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
    />
  </svg>
);

const CloseIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const SaveIcon = ({ className = 'w-4 h-4' }) => (
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

// Format bytes into readable format
const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Component for cover image or premium initials placeholder
const CoverPoster: React.FC<{ coverUrl: string | null; name: string; sizeClassName?: string }> = ({
  coverUrl,
  name,
  sizeClassName = 'w-full h-full',
}) => {
  if (coverUrl) {
    return (
      <img
        src={coverUrl}
        alt={name}
        className={`${sizeClassName} object-cover transition-transform duration-500 group-hover:scale-105`}
        onError={(e) => {
          // Fallback if image fails to load
          e.currentTarget.style.display = 'none';
        }}
      />
    );
  }

  // Get initials of the game name (max 2 characters)
  const initials = name
    .split(' ')
    .filter((w) => w.length > 0)
    .map((w) => w.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div
      className={`${sizeClassName} bg-gradient-to-br from-[#0c1618] to-[#120813] relative flex items-center justify-center overflow-hidden border border-tech-border/30`}
    >
      {/* Cyber Grid Styling */}
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(var(--border-color-tech)_1px,transparent_1px)] [background-size:16px_16px]" />
      <span className="font-sans font-black text-4xl tracking-[2px] text-cyan/25 drop-shadow-[0_0_12px_rgba(0,242,254,0.15)] [text-shadow:0_0_15px_rgba(0,242,254,0.3)] select-none">
        {initials || 'AS'}
      </span>
    </div>
  );
};

export const GameProfilesView: React.FC<GameProfilesViewProps> = ({
  config,
  newProfileName,
  setNewProfileName,
  newProfilePath,
  setNewProfilePath,
  gameExePath,
  setGameExePath,
  editingProfileId,
  setEditingProfileId,
  confirmDeleteId,
  setConfirmDeleteId,
  detectionMessage,
  setDetectionMessage,
  detecting,
  handleBrowseDir,
  handleBrowseFileAndDetect,
  handleAddProfile,
  handleSaveProfileEdit,
  handleRemoveProfile,
  handleToggleProfileEnabled,
  backingUp,
  reloadConfig,
  onNavigateToSaveTree,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [showSteamScanner, setShowSteamScanner] = useState(false);

  // Layout and filter states
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'backups' | 'size'>('name');

  // Drawer selected profile
  const [selectedHistoryProfile, setSelectedHistoryProfile] = useState<Profile | null>(null);

  // Separate states for cover art search and selection in the Add form
  const [coverSearchTerm, setCoverSearchTerm] = useState('');
  const [selectedCoverUrl, setSelectedCoverUrl] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<CoverSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleSearchAddCovers = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!coverSearchTerm.trim()) return;

    setSearching(true);
    setSearchError(null);
    try {
      const results: CoverSearchResult[] = await invoke('search_game_covers', {
        searchTerm: coverSearchTerm.trim(),
      });
      setSearchResults(results);
      if (results.length === 0) {
        setSearchError('No cover art matches found.');
      }
    } catch (err) {
      setSearchError(String(err));
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    setCoverSearchTerm(newProfileName);
    if (newProfileName.trim()) {
      const runImmediateSearch = async () => {
        setSearching(true);
        setSearchError(null);
        try {
          const results: CoverSearchResult[] = await invoke('search_game_covers', {
            searchTerm: newProfileName.trim(),
          });
          setSearchResults(results);
          if (results.length > 0) {
            setSelectedCoverUrl(results[0].cover_url);
          }
        } catch {
          // Ignore background fetch error
        } finally {
          setSearching(false);
        }
      };
      runImmediateSearch();
    } else {
      setSearchResults([]);
      setSelectedCoverUrl(null);
    }
  }, [newProfileName]);

  // If editing, render the dedicated Edit Profile View subpage
  if (editingProfileId) {
    const profileToEdit = config.profiles.find((p) => p.id === editingProfileId);
    if (profileToEdit) {
      return (
        <EditProfileView
          profile={profileToEdit}
          onSave={handleSaveProfileEdit}
          onCancel={() => setEditingProfileId(null)}
          onBrowseDir={handleBrowseDir}
        />
      );
    }
  }

  // Filter & Sort game profiles
  const getProcessedProfiles = () => {
    // 1. Text filter
    let list = config.profiles.filter((p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // 2. Status filter
    if (statusFilter === 'enabled') {
      list = list.filter((p) => p.enabled);
    } else if (statusFilter === 'disabled') {
      list = list.filter((p) => !p.enabled);
    }

    // 3. Sort (Note: backups & size are queried asynchronously per-card, so sorting by those is mock-fallback based on profile indices or stats if available, we'll sort dynamically if we store them or we can query them. To do it reliably, we will do sorting by Name here)
    if (sortBy === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }

    return list;
  };

  const processedProfiles = getProcessedProfiles();

  return (
    <div className="flex flex-col h-full min-h-0 relative select-none">
      <header className="mb-4 shrink-0 flex justify-between items-center flex-wrap gap-4">
        <div className="flex flex-col">
          <h1 className="text-[22px] font-bold tracking-[1.5px] text-white uppercase font-sans">
            Game Profiles
          </h1>
          <p className="text-gray text-xs mt-1">
            Configure game locations, trigger manual backup runs, and play games.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="inline-flex items-center justify-center gap-2 px-4 font-sans font-semibold text-[11px] rounded-inner cursor-pointer transition-all duration-200 h-[34px] border border-tech-border bg-transparent text-purple select-none hover:bg-purple/8 hover:border-purple"
            onClick={() => setShowSteamScanner(true)}
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16">
              <path d="M14.285 4.887A8.04 8.04 0 0 0 16 0H0v16h8.868a8.04 8.04 0 0 0 5.417-3.113l-3.32-3.32a3.85 3.85 0 0 1-2.965.867 3.858 3.858 0 0 1-3.218-3.218 3.858 3.858 0 0 1 .867-2.965l3.32-3.32a3.85 3.85 0 0 1 2.965-.867 3.858 3.858 0 0 1 3.218 3.218 3.858 3.858 0 0 1-.867 2.965l3.32 3.32ZM7.785 8a.215.215 0 1 1-.43 0 .215.215 0 0 1 .43 0ZM13 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm-4 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" />
            </svg>
            SCAN STEAM LIBRARY
          </button>
        </div>
      </header>

      {/* Toolbar Filters Panel */}
      <div className="shrink-0 mb-5 flex justify-between items-center bg-bg-card/30 border border-tech-border/40 rounded-card p-3 gap-4 flex-wrap">
        {/* Search */}
        <div className="relative w-[220px]">
          <input
            type="text"
            className="w-full bg-bg-inner border border-tech-border rounded-inner text-white py-1.5 pl-8 pr-3 font-sans text-[12px] outline-none h-[34px] focus:border-cyan"
            placeholder="Search game..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div className="absolute left-2.5 top-1/2 -translate-y-1/2">
            <SearchIcon />
          </div>
        </div>

        {/* Filter / Sort */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] font-bold text-gray uppercase tracking-[0.5px]">
              Filter:
            </span>
            <select
              className="bg-bg-inner text-white border border-tech-border rounded-inner py-1 px-2.5 font-sans text-[11.5px] h-[34px] outline-none focus:border-cyan"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <option value="all">All Games</option>
              <option value="enabled">Enabled Only</option>
              <option value="disabled">Disabled Only</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] font-bold text-gray uppercase tracking-[0.5px]">
              Sort:
            </span>
            <select
              className="bg-bg-inner text-white border border-tech-border rounded-inner py-1 px-2.5 font-sans text-[11.5px] h-[34px] outline-none focus:border-cyan"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
            >
              <option value="name">Game Name</option>
            </select>
          </div>
        </div>

        {/* Layout Switcher */}
        <div className="flex border border-tech-border rounded-inner overflow-hidden h-[34px]">
          <button
            type="button"
            className={`px-3 flex items-center justify-center cursor-pointer transition-colors ${viewMode === 'grid' ? 'bg-cyan/15 text-cyan' : 'text-gray/50 hover:text-white bg-transparent'}`}
            onClick={() => setViewMode('grid')}
            title="Grid Poster View"
          >
            <GridIcon />
          </button>
          <button
            type="button"
            className={`px-3 flex items-center justify-center cursor-pointer transition-colors border-l border-tech-border ${viewMode === 'list' ? 'bg-cyan/15 text-cyan' : 'text-gray/50 hover:text-white bg-transparent'}`}
            onClick={() => setViewMode('list')}
            title="Detailed List View"
          >
            <ListIcon />
          </button>
        </div>
      </div>

      {/* Main Container Area */}
      <div className="grow overflow-y-auto min-h-0 pr-1 pb-4 scrollbar">
        {processedProfiles.length === 0 ? (
          <div className="bg-bg-card backdrop-blur-md border border-tech-border rounded-card p-10 text-center relative overflow-hidden shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]">
            <span className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan to-purple opacity-85 z-5" />
            <p className="text-gray text-xs">
              No game profiles match search filters. Click "Add New Game Profile" below to start.
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          /* GRID VIEW Poster Layout */
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-5">
            {processedProfiles.map((profile) => (
              <ProfileCard
                key={profile.id}
                profile={profile}
                confirmDeleteId={confirmDeleteId}
                setConfirmDeleteId={setConfirmDeleteId}
                handleToggleProfileEnabled={handleToggleProfileEnabled}
                setEditingProfileId={setEditingProfileId}
                handleRemoveProfile={handleRemoveProfile}
                onOpenHistory={setSelectedHistoryProfile}
                backingUp={backingUp}
                reloadConfig={reloadConfig}
                onNavigateToSaveTree={onNavigateToSaveTree}
              />
            ))}
          </div>
        ) : (
          /* DETAILED LIST VIEW Table Layout */
          <DetailedListView
            profiles={processedProfiles}
            confirmDeleteId={confirmDeleteId}
            setConfirmDeleteId={setConfirmDeleteId}
            handleToggleProfileEnabled={handleToggleProfileEnabled}
            setEditingProfileId={setEditingProfileId}
            handleRemoveProfile={handleRemoveProfile}
            onOpenHistory={setSelectedHistoryProfile}
            backingUp={backingUp}
            reloadConfig={reloadConfig}
            onNavigateToSaveTree={onNavigateToSaveTree}
          />
        )}

        {/* Card: Add Game Profile Add button */}
        {!isAdding ? (
          <div
            className="bg-bg-card/20 backdrop-blur-md border border-dashed border-cyan/45 rounded-card p-5 mt-6 flex justify-center items-center cursor-pointer transition-all duration-250 hover:border-cyan hover:bg-bg-card/40"
            onClick={() => setIsAdding(true)}
          >
            <div className="flex items-center gap-2 font-bold text-cyan text-[12px] tracking-[1.5px] uppercase">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              ADD NEW GAME PROFILE
            </div>
          </div>
        ) : (
          <div className="bg-bg-card backdrop-blur-md border border-tech-border rounded-card p-6 mt-6 relative overflow-hidden shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] animate-[fade-slide-in_0.25s_ease-out]">
            <span className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan to-purple opacity-85 z-5" />
            <header className="flex justify-between items-center mb-5 border-b border-tech-border/20 pb-3">
              <span className="text-[12px] font-bold tracking-[1px] text-white uppercase">
                ADD GAME PROFILE DETAILS
              </span>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 px-3 font-sans font-semibold text-[10px] rounded-inner cursor-pointer h-7 border border-tech-border bg-transparent text-crimson hover:bg-crimson/8 hover:border-crimson transition-all duration-200"
                onClick={() => {
                  setIsAdding(false);
                  setNewProfileName('');
                  setNewProfilePath('');
                  setGameExePath('');
                  setDetectionMessage(null);
                  setCoverSearchTerm('');
                  setSelectedCoverUrl(null);
                  setSearchResults([]);
                  setSearchError(null);
                }}
              >
                <CloseIcon className="w-3.5 h-3.5" />
                CANCEL
              </button>
            </header>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAddProfile(
                  newProfileName,
                  newProfilePath,
                  selectedCoverUrl,
                  gameExePath || null
                );
                setIsAdding(false);
              }}
            >
              <div className="grid grid-cols-2 gap-6 max-md:grid-cols-1 max-md:gap-5">
                {/* Left Column */}
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-mono text-[9px] font-bold text-gray uppercase tracking-[0.8px]">
                      Game Profile Name
                    </label>
                    <input
                      className="w-full bg-bg-inner border border-tech-border rounded-inner text-white py-2 px-3 font-sans text-[12.5px] outline-none h-[38px] transition-all focus:border-cyan placeholder:text-gray/20"
                      type="text"
                      placeholder="e.g. Elden Ring, The Witcher 3"
                      value={newProfileName}
                      onChange={(e) => setNewProfileName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-mono text-[9px] font-bold text-gray uppercase tracking-[0.8px]">
                      Game Executable Link (For Auto-Detect & Launch)
                    </label>
                    <div className="flex gap-3">
                      <input
                        className="grow bg-bg-inner border border-tech-border rounded-inner text-white py-2 px-3 font-sans text-[12.5px] outline-none h-[38px] transition-all focus:border-cyan placeholder:text-gray/20"
                        type="text"
                        placeholder="Link game executable to auto-scan saves..."
                        value={gameExePath}
                        onChange={(e) => setGameExePath(e.target.value)}
                      />
                      <button
                        type="button"
                        className="inline-flex items-center justify-center gap-2 px-4 font-sans font-semibold text-[11px] rounded-inner cursor-pointer transition-all duration-200 h-[38px] border border-tech-border bg-transparent text-purple select-none hover:bg-purple/8 hover:border-purple"
                        onClick={handleBrowseFileAndDetect}
                        disabled={detecting}
                      >
                        {detecting ? 'SCANNING...' : 'BROWSE EXE'}
                      </button>
                    </div>
                  </div>

                  {detectionMessage && (
                    <div
                      className={`flex items-center gap-2.5 border rounded-inner py-2 px-3 text-[11px] ${detectionMessage.isError ? 'bg-crimson/8 border-crimson/30 text-crimson' : 'bg-green/8 border-green/30 text-green'}`}
                    >
                      <span className="font-mono">{detectionMessage.text}</span>
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5">
                    <label className="font-mono text-[9px] font-bold text-gray uppercase tracking-[0.8px]">
                      Saves Save Folder Path
                    </label>
                    <div className="flex gap-3">
                      <input
                        className="grow bg-bg-inner border border-tech-border rounded-inner text-white py-2 px-3 font-sans text-[12.5px] outline-none h-[38px] transition-all focus:border-cyan placeholder:text-gray/20"
                        type="text"
                        placeholder="Paste game saves folder path..."
                        value={newProfilePath}
                        onChange={(e) => setNewProfilePath(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        className="inline-flex items-center justify-center gap-2 px-4 font-sans font-semibold text-[11px] rounded-inner cursor-pointer transition-all duration-200 h-[38px] border border-tech-border bg-transparent text-purple select-none hover:bg-purple/8 hover:border-purple"
                        onClick={() => handleBrowseDir(setNewProfilePath)}
                      >
                        BROWSE
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-mono text-[9px] font-bold text-gray uppercase tracking-[0.8px]">
                      Poster Art Backdrop Preview
                    </label>
                    <div className="h-[90px] rounded-inner border border-tech-border/30 overflow-hidden relative flex items-center justify-center bg-bg-inner">
                      <CoverPoster coverUrl={selectedCoverUrl} name={newProfileName} />
                      {selectedCoverUrl && (
                        <button
                          type="button"
                          className="absolute top-2 right-2 px-2 py-1 bg-black/60 rounded-inner font-sans font-semibold text-[9px] text-crimson hover:bg-crimson/20 border border-crimson/30"
                          onClick={() => setSelectedCoverUrl(null)}
                        >
                          REMOVE ART
                        </button>
                      )}
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full inline-flex items-center justify-center gap-2 px-4 font-sans font-semibold text-[11.5px] rounded-inner cursor-pointer transition-all duration-200 h-[36px] border border-transparent bg-cyan text-[#032021] select-none mt-2 shadow-[0_2px_8px_rgba(0,242,254,0.15)] disabled:bg-[#465e60]/15 disabled:text-[#a8bcbd]/40 hover:bg-[#33f5ff] hover:shadow-[0_0_12px_rgba(0,242,254,0.45)] hover:-translate-y-0.5"
                    disabled={!newProfileName.trim() || !newProfilePath.trim()}
                  >
                    <SaveIcon className="w-3.5 h-3.5" />
                    <span>SAVE GAME PROFILE</span>
                  </button>
                </div>

                {/* Right Column */}
                <div className="flex flex-col gap-4 border-l border-tech-border/30 pl-6 max-md:border-l-0 max-md:pl-0 max-md:border-t max-md:pt-5">
                  <span className="text-[10px] font-bold tracking-[0.8px] text-white uppercase font-mono">
                    CHOOSE GAME POSTER COVER ART
                  </span>

                  <div className="flex gap-3">
                    <input
                      className="grow bg-bg-inner border border-tech-border rounded-inner text-white py-2 px-3.5 font-sans text-[12px] outline-none h-[38px] transition-all focus:border-cyan placeholder:text-gray/25"
                      value={coverSearchTerm}
                      onChange={(e) => setCoverSearchTerm(e.target.value)}
                      placeholder="Type game title to search..."
                    />
                    <button
                      className="inline-flex items-center justify-center gap-2 px-4 font-sans font-semibold text-[11px] rounded-inner cursor-pointer transition-all duration-200 h-[38px] border border-tech-border bg-transparent text-purple select-none hover:bg-purple/8 hover:border-purple"
                      type="button"
                      onClick={() => handleSearchAddCovers()}
                      disabled={searching || !coverSearchTerm.trim()}
                    >
                      {searching ? 'SEARCHING...' : 'SEARCH COVER'}
                    </button>
                  </div>

                  {searchError && (
                    <div className="bg-crimson/8 border border-crimson/20 text-crimson rounded-inner p-2.5 text-[11px] font-mono">
                      {searchError}
                    </div>
                  )}

                  <div className="flex flex-col gap-2.5 max-h-[220px] overflow-y-auto pr-1 scrollbar">
                    {searchResults.map((res, index) => {
                      const isSelected = selectedCoverUrl === res.cover_url;
                      return (
                        <div
                          key={index}
                          className={`border rounded-inner p-2 flex items-center gap-3 cursor-pointer transition-all duration-200 h-[56px] ${isSelected ? 'border-cyan bg-cyan/4' : 'bg-bg-inner border-tech-border/50 hover:border-cyan'}`}
                          onClick={() => setSelectedCoverUrl(res.cover_url)}
                        >
                          <img
                            src={res.cover_url}
                            alt={res.title}
                            className="w-16 h-full object-cover rounded-inner border border-tech-border/30"
                          />
                          <div className="flex flex-col gap-0.5 grow overflow-hidden">
                            <span className="text-[11px] font-bold text-white truncate">
                              {res.title}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[7px] font-bold px-1 rounded-full uppercase bg-cyan/15 text-cyan border border-cyan/20">
                                {res.source}
                              </span>
                              {newProfileName !== res.title && (
                                <button
                                  type="button"
                                  className="font-sans font-semibold text-[7px] border border-tech-border/40 px-1 py-0.25 rounded-inner bg-transparent text-purple hover:text-white"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setNewProfileName(res.title);
                                  }}
                                >
                                  AUTO-FILL TITLE
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Slide-out History Drawer Panel */}
      {selectedHistoryProfile && (
        <BackupHistoryDrawer
          profile={selectedHistoryProfile}
          onClose={() => setSelectedHistoryProfile(null)}
        />
      )}

      {/* Steam Library Scanner Modal overlay */}
      {showSteamScanner && (
        <SteamLibraryScanner
          config={config}
          onClose={() => setShowSteamScanner(false)}
          onImport={(name, path, coverUrl, exePath) => {
            handleAddProfile(name, path, coverUrl, exePath);
          }}
        />
      )}
    </div>
  );
};

/* ==========================================
   GRID CARD COMPONENT - ProfileCard
   ========================================== */
interface ProfileCardProps {
  profile: Profile;
  confirmDeleteId: string | null;
  setConfirmDeleteId: (id: string | null) => void;
  handleToggleProfileEnabled: (profile: Profile) => void;
  setEditingProfileId: (id: string | null) => void;
  handleRemoveProfile: (id: string) => void;
  onOpenHistory: (profile: Profile) => void;
  backingUp: boolean;
  reloadConfig: () => void;
  onNavigateToSaveTree: (profileId: string, openCreate: boolean) => void;
}

const ProfileCard: React.FC<ProfileCardProps> = ({
  profile,
  confirmDeleteId,
  setConfirmDeleteId,
  handleToggleProfileEnabled,
  setEditingProfileId,
  handleRemoveProfile,
  onOpenHistory,
  backingUp,
  reloadConfig,
  onNavigateToSaveTree,
}) => {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [launching, setLaunching] = useState(false);

  const fetchStats = async () => {
    try {
      const storageStats: StorageStats = await invoke('get_profile_storage_stats', {
        profileId: profile.id,
      });
      setStats(storageStats);
    } catch {
      // Quiet fail if folder doesn't exist
    }
  };

  useEffect(() => {
    fetchStats();

    // Listen to refresh events (for local restores, deletes, etc.)
    const handleRefresh = () => {
      fetchStats();
    };
    window.addEventListener('refresh-backups', handleRefresh);

    // Also listen to Tauri events
    const unlisten = listen('backups-updated', () => {
      fetchStats();
    });

    return () => {
      window.removeEventListener('refresh-backups', handleRefresh);
      unlisten.then((f) => f());
    };
  }, [profile.id]);

  const handlePlay = async () => {
    if (!profile.exe_path) return;
    setLaunching(true);
    try {
      await invoke('launch_game', {
        profileId: profile.id,
        exePath: profile.exe_path,
      });
      // The launch handles background processes, we'll keep visual indicator for 6 seconds
      setTimeout(() => setLaunching(false), 6000);
    } catch (err) {
      alert(`Launch error: ${err}`);
      setLaunching(false);
    }
  };

  const handleBackupNow = async () => {
    try {
      await invoke('manual_backup_profile', { profileId: profile.id });
      fetchStats();
    } catch (err) {
      alert(`Backup error: ${err}`);
    }
  };

  const handleOpenFolder = async () => {
    try {
      await invoke('open_backup_directory', { profileId: profile.id });
    } catch (err) {
      alert(`Folder open error: ${err}`);
    }
  };

  const handleSwitchPlaythrough = async (spId: string, spName: string) => {
    const confirm = window.confirm(
      `Are you sure you want to switch to playthrough "${spName}"? Your current active files will be saved first.`
    );
    if (!confirm) return;

    try {
      await invoke('switch_save_profile', {
        profileId: profile.id,
        targetSpId: spId,
      });
      reloadConfig();
      fetchStats();
      window.dispatchEvent(new CustomEvent('refresh-backups'));
    } catch (err) {
      alert(`Playthrough swap failed: ${err}`);
    }
  };

  return (
    <div className="group bg-[#090f10]/60 backdrop-blur-sm border border-tech-border/45 rounded-card overflow-hidden flex flex-col relative aspect-[3/4.6] transition-all duration-300 hover:border-cyan/50 hover:shadow-[0_4px_24px_rgba(0,242,254,0.08)]">
      {/* Visual Game poster cover art */}
      <div className="w-full grow relative overflow-hidden">
        <CoverPoster
          coverUrl={profile.cover_url || null}
          name={profile.name}
          sizeClassName="w-full h-full"
        />

        {/* Status badges */}
        <div className="absolute top-2.5 left-2.5 z-10 flex flex-col gap-1.5 pointer-events-none">
          {launching && (
            <span className="font-mono text-[8.5px] font-bold py-0.5 px-2 bg-green text-[#032021] rounded-inner animate-pulse tracking-[0.5px] shadow-[0_0_8px_var(--color-green)]">
              LAUNCHED
            </span>
          )}
          {!profile.enabled && (
            <span className="font-mono text-[8.5px] font-bold py-0.5 px-2 bg-black/60 text-gray/70 rounded-inner border border-tech-border/20">
              MUTED
            </span>
          )}
        </div>

        {/* Hover action overlay drawer */}
        <div className="absolute inset-0 bg-black/85 backdrop-blur-xs flex flex-col justify-center items-center gap-3 p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-250 z-20">
          {profile.exe_path && (
            <button
              onClick={handlePlay}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-1.75 font-sans font-bold text-[10.5px] rounded-inner cursor-pointer bg-green text-[#032021] border border-transparent select-none hover:bg-[#7effca] hover:scale-102 transition-all"
            >
              <PlayIcon className="w-3.5 h-3.5" />
              <span>PLAY GAME</span>
            </button>
          )}

          <button
            onClick={handleBackupNow}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-1.75 font-sans font-bold text-[10.5px] rounded-inner cursor-pointer bg-cyan text-[#032021] border border-transparent select-none disabled:opacity-40 disabled:cursor-not-allowed hover:not-disabled:bg-[#33f5ff] hover:not-disabled:scale-102 transition-all"
            disabled={backingUp}
          >
            {backingUp ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-cyan/15 border-t-cyan rounded-full animate-spin"></div>
                <span>BACKING UP...</span>
              </>
            ) : (
              <>
                <SyncIcon className="w-3 h-3" />
                <span>BACKUP NOW</span>
              </>
            )}
          </button>

          <button
            onClick={() => onOpenHistory(profile)}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-1.75 font-sans font-bold text-[10.5px] rounded-inner cursor-pointer bg-bg-inner/80 border border-tech-border text-white select-none hover:border-cyan hover:text-cyan hover:scale-102 transition-all"
          >
            <HistoryIcon className="w-3.5 h-3.5" />
            <span>BACKUP HISTORY</span>
          </button>

          <button
            onClick={handleOpenFolder}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-1.5 font-sans font-semibold text-[10px] rounded-inner cursor-pointer bg-bg-inner/40 border border-tech-border/55 text-gray select-none hover:text-white"
          >
            <FolderIcon className="w-3 h-3" />
            <span>OPEN BACKUPS FOLDER</span>
          </button>

          <div className="flex gap-2.5 w-full mt-2 border-t border-tech-border/15 pt-2.5">
            <button
              onClick={() => setEditingProfileId(profile.id)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.25 font-sans font-semibold text-[9.5px] rounded-inner cursor-pointer border border-tech-border bg-transparent text-purple hover:bg-purple/6 hover:border-purple"
            >
              <EditIcon className="w-3 h-3" />
              <span>EDIT</span>
            </button>
            <button
              onClick={() => setConfirmDeleteId(profile.id)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.25 font-sans font-semibold text-[9.5px] rounded-inner cursor-pointer border border-tech-border bg-transparent text-crimson hover:bg-crimson/6 hover:border-crimson"
            >
              <TrashIcon className="w-3 h-3" />
              <span>REMOVE</span>
            </button>
          </div>
        </div>
      </div>

      {/* Info panel footer */}
      <div className="shrink-0 p-3 bg-[#080d0e]/95 border-t border-tech-border/25 flex flex-col gap-1.5">
        <div className="flex justify-between items-center">
          <span className="text-[12.5px] font-bold text-white truncate pr-2" title={profile.name}>
            {profile.name}
          </span>
          <div
            className="shrink-0 flex items-center select-none group"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleProfileEnabled(profile);
            }}
          >
            <div
              className={`w-7 h-4 rounded-[8px] border relative transition-all duration-200 ${profile.enabled ? 'bg-green/10 border-green' : 'bg-bg-inner border-tech-border'}`}
            >
              <div
                className={`w-2.5 h-2.5 rounded-full absolute top-[2px] transition-all duration-200 ${profile.enabled ? 'bg-green left-[13px] shadow-[0_0_6px_var(--color-green)]' : 'bg-gray/50 left-[2px]'}`}
              />
            </div>
          </div>
        </div>

        {/* Mini stats */}
        <div className="flex justify-between items-center font-mono text-[9px] text-gray/60 mt-0.5">
          <span>{stats ? `${stats.backup_count} Backups` : '0 Backups'}</span>
          <span>{stats ? formatBytes(stats.total_size_bytes) : '0 Bytes'}</span>
        </div>

        {/* Playthrough select row */}
        <div className="flex items-center gap-2 border-t border-tech-border/15 pt-2.5 mt-1">
          <div className="flex items-center gap-1 shrink-0 text-cyan select-none">
            <PlaythroughIcon className="w-3.5 h-3.5 text-cyan" />
            <span className="text-[8.5px] font-bold uppercase tracking-widest text-gray/70">
              SLOT:
            </span>
          </div>
          <div className="flex items-center gap-1.5 grow relative min-w-0">
            <select
              className="w-full bg-bg-inner/40 border border-tech-border/30 rounded-inner text-cyan font-bold text-[10px] py-0.75 px-1.5 pr-5 outline-none cursor-pointer appearance-none focus:border-cyan/60 truncate"
              value={profile.active_save_profile_id || ''}
              onChange={(e) => {
                const targetId = e.target.value;
                if (targetId === '__create_new__') {
                  onNavigateToSaveTree(profile.id, true);
                  return;
                }
                const targetSp = profile.save_profiles?.find((sp) => sp.id === targetId);
                if (targetSp) {
                  handleSwitchPlaythrough(targetId, targetSp.name);
                }
              }}
            >
              {profile.save_profiles?.map((sp) => (
                <option key={sp.id} value={sp.id} className="bg-bg-dark text-cyan">
                  {sp.name}
                </option>
              )) || (
                <option value="" className="bg-bg-dark text-cyan">
                  Default
                </option>
              )}
              <option value="__create_new__" className="bg-bg-dark text-cyan font-bold">
                + Create New Playthrough...
              </option>
            </select>
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-cyan text-[7px]">
              ▼
            </div>
          </div>
        </div>

        {/* Delete Confirmation details overlay */}
        {confirmDeleteId === profile.id && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm z-30 flex flex-col justify-center items-center p-4 text-center">
            <span className="font-mono text-[10px] font-bold text-crimson uppercase tracking-[1px] mb-2">
              CONFIRM REMOVAL?
            </span>
            <p className="text-gray text-[10.5px] leading-normal mb-4 px-2">
              This deletes tracking metadata. Game archives on disk remain safe.
            </p>
            <div className="flex gap-3 w-full max-w-[180px]">
              <button
                className="flex-1 py-1.5 font-sans font-bold text-[10px] rounded-inner cursor-pointer bg-crimson text-black hover:bg-crimson-hover"
                onClick={() => handleRemoveProfile(profile.id)}
              >
                REMOVE
              </button>
              <button
                className="flex-1 py-1.5 font-sans font-bold text-[10px] rounded-inner cursor-pointer border border-tech-border text-gray hover:text-white"
                onClick={() => setConfirmDeleteId(null)}
              >
                CANCEL
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ==========================================
   LIST LAYOUT COMPONENT - DetailedListView
   ========================================== */
interface DetailedListViewProps {
  profiles: Profile[];
  confirmDeleteId: string | null;
  setConfirmDeleteId: (id: string | null) => void;
  handleToggleProfileEnabled: (profile: Profile) => void;
  setEditingProfileId: (id: string | null) => void;
  handleRemoveProfile: (id: string) => void;
  onOpenHistory: (profile: Profile) => void;
  backingUp: boolean;
  reloadConfig: () => void;
  onNavigateToSaveTree: (profileId: string, openCreate: boolean) => void;
}

const DetailedListView: React.FC<DetailedListViewProps> = ({
  profiles,
  confirmDeleteId,
  setConfirmDeleteId,
  handleToggleProfileEnabled,
  setEditingProfileId,
  handleRemoveProfile,
  onOpenHistory,
  backingUp,
  reloadConfig,
  onNavigateToSaveTree,
}) => {
  return (
    <div className="bg-[#090f10]/60 backdrop-blur-sm border border-tech-border/40 rounded-card overflow-hidden">
      <div className="overflow-x-auto w-full scrollbar">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-tech-border/30 bg-[#070b0c]/80 text-[10px] font-mono font-bold text-gray uppercase tracking-[0.8px]">
              <th className="py-3 px-4 w-[20%]">Game Title</th>
              <th className="py-3 px-3 w-[10%]">Active Monitor</th>
              <th className="py-3 px-3 w-[12%]">Playthrough</th>
              <th className="py-3 px-3 w-[10%]">Backups Count</th>
              <th className="py-3 px-3 w-[10%]">Disk Size</th>
              <th className="py-3 px-3 w-[22%]">Saves Folder</th>
              <th className="py-3 px-4 text-right w-[16%]">Management Actions</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((profile) => (
              <ListRow
                key={profile.id}
                profile={profile}
                confirmDeleteId={confirmDeleteId}
                setConfirmDeleteId={setConfirmDeleteId}
                handleToggleProfileEnabled={handleToggleProfileEnabled}
                setEditingProfileId={setEditingProfileId}
                handleRemoveProfile={handleRemoveProfile}
                onOpenHistory={onOpenHistory}
                backingUp={backingUp}
                reloadConfig={reloadConfig}
                onNavigateToSaveTree={onNavigateToSaveTree}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ListRow: React.FC<{
  profile: Profile;
  confirmDeleteId: string | null;
  setConfirmDeleteId: (id: string | null) => void;
  handleToggleProfileEnabled: (profile: Profile) => void;
  setEditingProfileId: (id: string | null) => void;
  handleRemoveProfile: (id: string) => void;
  onOpenHistory: (profile: Profile) => void;
  backingUp: boolean;
  reloadConfig: () => void;
  onNavigateToSaveTree: (profileId: string, openCreate: boolean) => void;
}> = ({
  profile,
  confirmDeleteId,
  setConfirmDeleteId,
  handleToggleProfileEnabled,
  setEditingProfileId,
  handleRemoveProfile,
  onOpenHistory,
  backingUp,
  reloadConfig,
  onNavigateToSaveTree,
}) => {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [launching, setLaunching] = useState(false);

  const fetchStats = async () => {
    try {
      const storageStats: StorageStats = await invoke('get_profile_storage_stats', {
        profileId: profile.id,
      });
      setStats(storageStats);
    } catch {
      // Quiet fail
    }
  };

  useEffect(() => {
    fetchStats();

    const handleRefresh = () => {
      fetchStats();
    };
    window.addEventListener('refresh-backups', handleRefresh);

    const unlisten = listen('backups-updated', () => {
      fetchStats();
    });

    return () => {
      window.removeEventListener('refresh-backups', handleRefresh);
      unlisten.then((f) => f());
    };
  }, [profile.id]);

  const handlePlay = async () => {
    if (!profile.exe_path) return;
    setLaunching(true);
    try {
      await invoke('launch_game', {
        profileId: profile.id,
        exePath: profile.exe_path,
      });
      setTimeout(() => setLaunching(false), 6000);
    } catch (err) {
      alert(`Launch error: ${err}`);
      setLaunching(false);
    }
  };

  const handleBackupNow = async () => {
    try {
      await invoke('manual_backup_profile', { profileId: profile.id });
      fetchStats();
    } catch (err) {
      alert(`Backup error: ${err}`);
    }
  };

  const handleSwitchPlaythrough = async (spId: string, spName: string) => {
    const confirm = window.confirm(
      `Are you sure you want to switch to playthrough "${spName}"? Your current active files will be saved first.`
    );
    if (!confirm) return;

    try {
      await invoke('switch_save_profile', {
        profileId: profile.id,
        targetSpId: spId,
      });
      reloadConfig();
      fetchStats();
      window.dispatchEvent(new CustomEvent('refresh-backups'));
    } catch (err) {
      alert(`Playthrough swap failed: ${err}`);
    }
  };

  return (
    <tr
      className={`border-b border-tech-border/15 hover:bg-white/1.5 transition-colors text-xs text-gray
        ${!profile.enabled ? 'opacity-55' : ''}`}
    >
      <td className="py-2.5 px-4 font-bold text-white flex items-center gap-3 min-w-0">
        <div className="w-10 h-7 rounded-inner overflow-hidden shrink-0 border border-tech-border/30 bg-[#0c1618]">
          {profile.cover_url ? (
            <img src={profile.cover_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center font-mono text-[9px] font-black text-cyan/30">
              {profile.name.substring(0, 2).toUpperCase()}
            </div>
          )}
        </div>
        <span className="truncate pr-1" title={profile.name}>
          {profile.name}
        </span>
        {launching && (
          <span className="w-1.5 h-1.5 rounded-full bg-green animate-ping shadow-[0_0_6px_var(--color-green)]" />
        )}
      </td>

      <td className="py-2.5 px-3">
        <div
          className="flex items-center cursor-pointer select-none group w-fit"
          onClick={() => handleToggleProfileEnabled(profile)}
        >
          <div
            className={`w-7 h-4 rounded-[8px] border relative transition-all duration-200 ${profile.enabled ? 'bg-green/10 border-green' : 'bg-bg-inner border-tech-border'}`}
          >
            <div
              className={`w-2.5 h-2.5 rounded-full absolute top-[2px] transition-all duration-200 ${profile.enabled ? 'bg-green left-[13px]' : 'bg-gray/50 left-[2px]'}`}
            />
          </div>
        </div>
      </td>

      <td className="py-2.5 px-3">
        <div className="flex items-center gap-1.5 relative min-w-[100px] max-w-[160px]">
          <select
            className="w-full bg-bg-inner/60 border border-tech-border/40 rounded-inner text-cyan font-semibold text-[11px] py-1 px-2 pr-6 outline-none cursor-pointer appearance-none focus:border-cyan"
            value={profile.active_save_profile_id || ''}
            onChange={(e) => {
              const targetId = e.target.value;
              if (targetId === '__create_new__') {
                onNavigateToSaveTree(profile.id, true);
                return;
              }
              const targetSp = profile.save_profiles?.find((sp) => sp.id === targetId);
              if (targetSp) {
                handleSwitchPlaythrough(targetId, targetSp.name);
              }
            }}
          >
            {profile.save_profiles?.map((sp) => (
              <option key={sp.id} value={sp.id} className="bg-bg-dark text-cyan font-semibold">
                {sp.name}
              </option>
            )) || (
              <option value="" className="bg-bg-dark text-cyan font-semibold">
                Default
              </option>
            )}
            <option value="__create_new__" className="bg-bg-dark text-cyan font-bold">
              + Create New Playthrough...
            </option>
          </select>
          <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-cyan text-[8px]">
            ▼
          </div>
        </div>
      </td>

      <td className="py-2.5 px-3 font-mono text-[11px]">
        {stats ? stats.backup_count : '0'} backups
      </td>

      <td className="py-2.5 px-3 font-mono text-[11px] text-cyan">
        {stats ? formatBytes(stats.total_size_bytes) : '0 Bytes'}
      </td>

      <td
        className="py-2.5 px-3 font-mono text-[10px] max-w-[180px] truncate"
        title={profile.source_path}
      >
        {profile.source_path}
      </td>

      <td className="py-2.5 px-4 text-right">
        {confirmDeleteId === profile.id ? (
          <div className="inline-flex items-center gap-2">
            <span className="font-mono text-[9px] text-crimson font-bold">SURE?</span>
            <button
              onClick={() => handleRemoveProfile(profile.id)}
              className="px-2 py-0.5 rounded-inner bg-crimson text-black font-semibold hover:bg-crimson-hover"
            >
              YES
            </button>
            <button
              onClick={() => setConfirmDeleteId(null)}
              className="px-2 py-0.5 rounded-inner border border-tech-border text-gray hover:text-white"
            >
              NO
            </button>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 justify-end">
            {profile.exe_path && (
              <button
                onClick={handlePlay}
                className="p-1 rounded-inner bg-green/10 text-green hover:bg-green hover:text-black border border-green/30 transition-colors"
                title="Launch Game"
              >
                <PlayIcon className="w-3 h-3" />
              </button>
            )}

            <button
              onClick={handleBackupNow}
              className="p-1 rounded-inner bg-cyan/10 text-cyan hover:not-disabled:bg-cyan hover:not-disabled:text-black border border-cyan/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Backup Now"
              disabled={backingUp}
            >
              <SyncIcon className="w-3 h-3" />
            </button>

            <button
              onClick={() => onOpenHistory(profile)}
              className="p-1 rounded-inner border border-tech-border text-gray hover:border-cyan hover:text-cyan bg-transparent transition-colors"
              title="Backup History"
            >
              <HistoryIcon className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setEditingProfileId(profile.id)}
              className="p-1 rounded-inner border border-tech-border text-purple hover:border-purple/80 hover:bg-purple/5 bg-transparent transition-colors"
              title="Edit Profile"
            >
              <EditIcon className="w-3 h-3" />
            </button>

            <button
              onClick={() => setConfirmDeleteId(profile.id)}
              className="p-1 rounded-inner border border-tech-border text-crimson hover:border-crimson/85 hover:bg-crimson/5 bg-transparent transition-colors"
              title="Delete Profile"
            >
              <TrashIcon className="w-3 h-3" />
            </button>
          </div>
        )}
      </td>
    </tr>
  );
};

/* ==========================================
   BACKUP HISTORY DRAWER COMPONENT
   ========================================== */
interface BackupHistoryDrawerProps {
  profile: Profile;
  onClose: () => void;
}

const BackupHistoryDrawer: React.FC<BackupHistoryDrawerProps> = ({ profile, onClose }) => {
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [restoringFilename, setRestoringFilename] = useState<string | null>(null);
  const [restoringSuccess, setRestoringSuccess] = useState<string | null>(null);

  // Inplace rename state
  const [renamingFilename, setRenamingFilename] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');

  // Delete confirm state
  const [deleteConfirmFilename, setDeleteConfirmFilename] = useState<string | null>(null);

  const loadBackups = async () => {
    setLoading(true);
    try {
      const list: BackupInfo[] = await invoke('get_backups', { profileId: profile.id });
      setBackups(list);
      const storageStats: StorageStats = await invoke('get_profile_storage_stats', {
        profileId: profile.id,
      });
      setStats(storageStats);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBackups();

    // Reload list on update event
    const handleRefresh = () => {
      loadBackups();
    };
    window.addEventListener('refresh-backups', handleRefresh);

    const unlisten = listen('backups-updated', () => {
      loadBackups();
    });

    return () => {
      window.removeEventListener('refresh-backups', handleRefresh);
      unlisten.then((f) => f());
    };
  }, [profile.id]);

  const handleRestore = async (filename: string) => {
    setRestoringFilename(filename);
    setRestoringSuccess(null);
    try {
      await invoke('restore_backup', { profileId: profile.id, filename });
      setRestoringSuccess(`Restored successfully!`);
      setTimeout(() => {
        setRestoringFilename(null);
        setRestoringSuccess(null);
      }, 3000);
    } catch (err) {
      alert(`Restore failed: ${err}`);
      setRestoringFilename(null);
    }
  };

  const handleRenameClick = (bk: BackupInfo) => {
    setRenamingFilename(bk.filename);
    // Strip timestamp or clean label
    const nameWithoutExt = bk.filename.replace('.zip', '');
    // Remove the trailing timestamp if present (15 chars like _20260617_150000)
    const label =
      nameWithoutExt.length > 16
        ? nameWithoutExt.substring(0, nameWithoutExt.length - 15)
        : nameWithoutExt;
    setRenameText(label.replace(/[_-]/g, ' '));
  };

  const handleRenameSubmit = async (oldFilename: string) => {
    if (!renameText.trim()) return;
    try {
      await invoke('rename_backup', {
        profileId: profile.id,
        filename: oldFilename,
        newLabel: renameText.trim(),
      });
      setRenamingFilename(null);
      loadBackups();
    } catch (err) {
      alert(`Rename failed: ${err}`);
    }
  };

  const handleDelete = async (filename: string) => {
    try {
      await invoke('delete_backup', { profileId: profile.id, filename });
      setDeleteConfirmFilename(null);
      loadBackups();
    } catch (err) {
      alert(`Delete failed: ${err}`);
    }
  };

  const handleOpenFolder = async () => {
    try {
      await invoke('open_backup_directory', { profileId: profile.id });
    } catch (err) {
      alert(`Folder open error: ${err}`);
    }
  };

  const handlePrune = async (keepCount: number) => {
    try {
      const deleted: number = await invoke('prune_profile_backups', {
        profileId: profile.id,
        keepCount,
      });
      alert(`Successfully pruned ${deleted} older backup files.`);
      loadBackups();
    } catch (err) {
      alert(`Pruning failed: ${err}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex justify-end animate-[fadeIn_0.2s_ease-out]">
      {/* Click outside to close */}
      <div className="flex-1" onClick={onClose} />

      {/* Drawer Container Panel */}
      <div className="w-[390px] h-full bg-[#070b0c] border-l border-tech-border flex flex-col shadow-[0_0_40px_rgba(0,0,0,0.85)] z-60 animate-[slide-in-right_0.25s_cubic-bezier(0.4,0,0.2,1)] relative overflow-hidden">
        {/* Accent strip */}
        <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-gradient-to-b from-cyan to-purple" />

        {/* Drawer Header */}
        <header className="p-4 border-b border-tech-border/30 bg-[#090f10]/80 shrink-0 flex justify-between items-center">
          <div className="flex flex-col min-w-0 pr-4">
            <h3 className="text-xs font-bold tracking-[1.5px] text-white uppercase font-sans truncate">
              {profile.name}
            </h3>
            <span className="text-[10px] text-gray/70 font-mono mt-0.5">
              BACKUP HISTORY MANAGER
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-inner border border-tech-border bg-transparent text-gray hover:text-white cursor-pointer"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </header>

        {/* Stats banner details */}
        <div className="p-4 bg-bg-inner/40 border-b border-tech-border/15 shrink-0 flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2 font-mono text-[10px] text-gray/80">
            <div>
              SIZEPreserved:{' '}
              <b className="text-cyan font-bold">
                {stats ? formatBytes(stats.total_size_bytes) : '0 Bytes'}
              </b>
            </div>
            <div>
              SLOTSCount: <b className="text-white font-bold">{stats ? stats.backup_count : '0'}</b>
            </div>
            <div className="col-span-2 text-[9.5px]">
              LATEST:{' '}
              <span className="text-purple">{stats ? stats.newest_backup_time : 'Never'}</span>
            </div>
          </div>

          <div className="flex gap-2.5 mt-2 border-t border-tech-border/10 pt-2.5">
            <button
              onClick={handleOpenFolder}
              className="flex-1 py-1 px-2.5 inline-flex justify-center items-center gap-1.5 border border-tech-border/60 rounded-inner font-sans font-semibold text-[10px] text-white hover:border-cyan hover:text-cyan bg-transparent cursor-pointer"
            >
              <FolderIcon className="w-3 h-3" />
              <span>SHOW FILES</span>
            </button>
            <select
              className="py-1 px-2 bg-bg-inner border border-tech-border rounded-inner text-[10px] text-purple outline-none focus:border-purple/80 cursor-pointer max-w-[140px]"
              onChange={(e) => {
                const count = parseInt(e.target.value);
                if (count > 0) handlePrune(count);
              }}
              defaultValue=""
            >
              <option value="" disabled>
                PRUNE BACKUPS
              </option>
              <option value="5">Keep 5 latest</option>
              <option value="10">Keep 10 latest</option>
              <option value="15">Keep 15 latest</option>
            </select>
          </div>
        </div>

        {/* Scrollable list content */}
        <div className="grow overflow-y-auto p-4 space-y-3 relative scrollbar">
          {loading ? (
            <div className="flex flex-col justify-center items-center py-20 text-gray gap-2">
              <div className="w-5 h-5 border-2 border-cyan/15 border-t-cyan rounded-full animate-spin" />
              <span className="font-mono text-[10px]">READING DISK ARCHIVES...</span>
            </div>
          ) : backups.length === 0 ? (
            <div className="text-center py-20 text-gray/50 font-mono text-[10.5px]">
              No backup slots archived for this game yet. Backups compile automatically on game
              saves writes.
            </div>
          ) : (
            backups.map((bk) => {
              const isRestoring = restoringFilename === bk.filename;
              const isRenaming = renamingFilename === bk.filename;
              const isDeleting = deleteConfirmFilename === bk.filename;

              // Extract custom label out of filename (e.g. EldenRing_customLabel_timestamp -> customLabel)
              const displayLabel = () => {
                const nameWithoutExt = bk.filename.replace('.zip', '');
                // Check if filename has manual/rollback suffixes or timestamps
                const clean = nameWithoutExt.substring(0, nameWithoutExt.length - 15); // strip timestamp
                const parts = clean.split('_');
                // Remove game name prefix if matches
                const labelText = parts.slice(1).join(' ');
                return labelText ? labelText.toUpperCase() : 'AUTO SAVE';
              };

              return (
                <div
                  key={bk.filename}
                  className={`bg-[#090f10]/70 border rounded-card p-3 flex flex-col gap-2 relative transition-all duration-200
                    ${isRestoring ? 'border-green bg-green/5' : 'border-tech-border/30 hover:border-tech-border/75'}`}
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex flex-col min-w-0">
                      {isRenaming ? (
                        <div
                          className="flex items-center gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            value={renameText}
                            onChange={(e) => setRenameText(e.target.value)}
                            className="bg-bg-inner border border-tech-border rounded-inner text-white py-0.5 px-2 text-[11px] h-6 outline-none focus:border-cyan w-[140px]"
                            autoFocus
                          />
                          <button
                            onClick={() => handleRenameSubmit(bk.filename)}
                            className="px-1.5 py-0.5 bg-cyan text-black rounded-inner font-sans font-bold text-[9px] h-6 hover:bg-[#33f5ff]"
                          >
                            SAVE
                          </button>
                          <button
                            onClick={() => setRenamingFilename(null)}
                            className="px-1.5 py-0.5 border border-tech-border text-gray rounded-inner font-sans font-semibold text-[9px] h-6"
                          >
                            X
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 select-text">
                          <span
                            onClick={() => handleRenameClick(bk)}
                            className={`text-[11px] font-bold truncate pr-1 cursor-pointer transition-colors duration-150 hover:text-cyan
                              ${displayLabel() === 'AUTO SAVE' ? 'text-white' : 'text-purple'}`}
                            title="Click to rename/label this backup"
                          >
                            {displayLabel()}
                          </span>
                        </div>
                      )}

                      <span className="font-mono text-[9px] text-gray/50 mt-0.5 select-all">
                        {bk.created_at}
                      </span>
                    </div>

                    <span className="font-mono text-[9.5px] text-cyan self-start mt-0.5 shrink-0">
                      {formatBytes(bk.size_bytes)}
                    </span>
                  </div>

                  {/* Actions bar list */}
                  <div className="flex justify-between items-center border-t border-tech-border/10 pt-2">
                    {isDeleting ? (
                      <div className="flex items-center gap-1.5 ml-auto">
                        <span className="font-mono text-[8.5px] font-bold text-crimson">
                          DELETE?
                        </span>
                        <button
                          onClick={() => handleDelete(bk.filename)}
                          className="px-2 py-0.5 bg-crimson text-black rounded-inner font-bold text-[9px]"
                        >
                          CONFIRM
                        </button>
                        <button
                          onClick={() => setDeleteConfirmFilename(null)}
                          className="px-2 py-0.5 border border-tech-border text-gray rounded-inner font-semibold text-[9px]"
                        >
                          CANCEL
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleRenameClick(bk)}
                            className="font-sans font-bold text-[9px] text-purple/80 hover:text-purple cursor-pointer bg-transparent border-none outline-none"
                          >
                            RENAME
                          </button>
                          <button
                            onClick={() => setDeleteConfirmFilename(bk.filename)}
                            className="font-sans font-bold text-[9px] text-crimson/80 hover:text-crimson cursor-pointer bg-transparent border-none outline-none"
                          >
                            DELETE
                          </button>
                        </div>

                        <button
                          onClick={() => handleRestore(bk.filename)}
                          disabled={isRestoring}
                          className={`inline-flex items-center justify-center gap-1 px-3 py-1 font-sans font-bold text-[9.5px] rounded-inner cursor-pointer select-none transition-all
                            ${isRestoring ? 'bg-green/10 text-green border border-green/35' : 'bg-green text-[#032021] hover:bg-[#7effca] border border-transparent hover:-translate-y-0.5'}`}
                        >
                          {isRestoring ? (
                            <>
                              <div className="w-2.5 h-2.5 border border-green/20 border-t-green rounded-full animate-spin" />
                              <span>RESTORED...</span>
                            </>
                          ) : (
                            <>
                              <span>RESTORE SLOT</span>
                            </>
                          )}
                        </button>
                      </>
                    )}
                  </div>

                  {/* Restored feedback alert */}
                  {isRestoring && restoringSuccess && (
                    <div className="absolute inset-0 bg-green/95 text-black font-bold text-xs flex justify-center items-center rounded-card z-10 animate-[fadeIn_0.15s_ease-out]">
                      <span>{restoringSuccess}</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

/* ==========================================
   EDIT PROFILE COMPONENT - EditProfileView
   ========================================== */
interface EditProfileViewProps {
  profile: Profile;
  onSave: (
    id: string,
    name: string,
    path: string,
    enabled: boolean,
    coverUrl?: string | null,
    exePath?: string | null
  ) => void;
  onCancel: () => void;
  onBrowseDir: (setter: (val: string) => void) => void;
}

function EditProfileView({ profile, onSave, onCancel, onBrowseDir }: EditProfileViewProps) {
  const [name, setName] = useState(profile.name);
  const [path, setPath] = useState(profile.source_path);
  const [coverUrl, setCoverUrl] = useState<string | null>(profile.cover_url || null);
  const [exePath, setExePath] = useState(profile.exe_path || '');

  // Separate search state
  const [searchTerm, setSearchTerm] = useState(profile.name);
  const [searchResults, setSearchResults] = useState<CoverSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleBrowseExe = async () => {
    try {
      const selected: string | null = await invoke('select_file');
      if (selected) {
        setExePath(selected);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSearchCovers = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchTerm.trim()) return;

    setSearching(true);
    setSearchError(null);
    try {
      const results: CoverSearchResult[] = await invoke('search_game_covers', {
        searchTerm: searchTerm.trim(),
      });
      setSearchResults(results);
      if (results.length === 0) {
        setSearchError('No cover art matches found.');
      }
    } catch (err) {
      setSearchError(String(err));
    } finally {
      setSearching(false);
    }
  };

  // Run search once initially on edit page load
  useEffect(() => {
    handleSearchCovers();
  }, []);

  return (
    <div className="flex flex-col h-full min-h-0 select-none">
      <header className="mb-4 shrink-0 flex justify-between items-center flex-wrap gap-4">
        <div className="flex flex-col">
          <h1 className="text-[22px] font-bold tracking-[1.5px] text-white uppercase font-sans">
            Edit Profile
          </h1>
          <p className="text-gray text-xs mt-1">
            Adjust folder paths, custom cover art, and game executables.
          </p>
        </div>
        <button
          className="inline-flex items-center justify-center gap-2 px-4 font-sans font-semibold text-[11px] rounded-inner cursor-pointer transition-all duration-200 h-[34px] border border-tech-border bg-transparent text-purple select-none hover:bg-purple/8 hover:border-purple"
          onClick={onCancel}
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
              d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
            />
          </svg>
          BACK TO PROFILES
        </button>
      </header>

      <div className="grow overflow-y-auto min-h-0 pr-1 pb-4 scrollbar">
        <div className="grid grid-cols-2 gap-6 max-md:grid-cols-1 max-md:gap-5">
          {/* Left Column: Details form */}
          <div className="bg-bg-card backdrop-blur-md border border-tech-border rounded-card p-6 relative overflow-hidden shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] flex flex-col gap-4">
            <span className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan to-purple opacity-85 z-5" />
            <span className="text-[12px] font-bold tracking-[0.8px] text-white uppercase font-mono">
              PROFILE CONFIG PROPERTIES
            </span>

            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[9px] font-bold text-gray uppercase tracking-[0.8px]">
                Game Profile Identifier
              </label>
              <input
                className="w-full bg-bg-inner border border-tech-border rounded-inner text-white py-2 px-3 font-sans text-[12.5px] outline-none h-[38px] transition-all focus:border-cyan"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Game profile identifier"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[9px] font-bold text-gray uppercase tracking-[0.8px]">
                Save Game Folder Path
              </label>
              <div className="flex gap-3">
                <input
                  className="grow bg-bg-inner border border-tech-border rounded-inner text-white py-2 px-3 font-sans text-[12.5px] outline-none h-[38px] transition-all focus:border-cyan"
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                />
                <button
                  className="inline-flex items-center justify-center gap-2 px-4 font-sans font-semibold text-[11px] rounded-inner cursor-pointer transition-all duration-200 h-[38px] border border-tech-border bg-transparent text-purple select-none hover:bg-purple/8 hover:border-purple"
                  type="button"
                  onClick={() => onBrowseDir(setPath)}
                >
                  BROWSE
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[9px] font-bold text-gray uppercase tracking-[0.8px]">
                Linked Game Executable File Path (For launch syncs)
              </label>
              <div className="flex gap-3">
                <input
                  className="grow bg-bg-inner border border-tech-border rounded-inner text-white py-2 px-3 font-sans text-[12.5px] outline-none h-[38px] transition-all focus:border-cyan placeholder:text-gray/20"
                  value={exePath}
                  onChange={(e) => setExePath(e.target.value)}
                  placeholder="Optional linked executable (e.g. eldenring.exe)..."
                />
                <button
                  className="inline-flex items-center justify-center gap-2 px-4 font-sans font-semibold text-[11px] rounded-inner cursor-pointer transition-all duration-200 h-[38px] border border-tech-border bg-transparent text-purple select-none hover:bg-purple/8 hover:border-purple"
                  type="button"
                  onClick={handleBrowseExe}
                >
                  BROWSE EXE
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[9px] font-bold text-gray uppercase tracking-[0.8px]">
                Poster Art Backdrop Preview
              </label>
              <div className="h-[120px] rounded-inner border border-tech-border/30 overflow-hidden relative flex items-center justify-center bg-bg-inner">
                <CoverPoster coverUrl={coverUrl} name={name} />
                {coverUrl && (
                  <button
                    type="button"
                    className="absolute top-2 right-2 px-2 py-1 bg-black/60 rounded-inner font-sans font-semibold text-[9px] text-crimson hover:bg-crimson/20 border border-crimson/30"
                    onClick={() => setCoverUrl(null)}
                  >
                    REMOVE ART
                  </button>
                )}
              </div>
            </div>

            <button
              className="w-full inline-flex items-center justify-center gap-2 px-4 font-sans font-semibold text-[11.5px] rounded-inner cursor-pointer transition-all duration-200 h-[36px] border border-transparent bg-cyan text-[#032021] select-none mt-2 shadow-[0_2px_8px_rgba(0,242,254,0.15)] hover:bg-[#33f5ff] hover:shadow-[0_0_12px_rgba(0,242,254,0.45)] hover:-translate-y-0.5"
              onClick={() =>
                onSave(profile.id, name, path, profile.enabled, coverUrl, exePath || null)
              }
              disabled={!name.trim() || !path.trim()}
            >
              <SaveIcon className="w-3.5 h-3.5" />
              <span>SAVE PROFILE CHANGES</span>
            </button>
          </div>

          {/* Right Column: Cover Art Selection */}
          <div className="bg-bg-card backdrop-blur-md border border-tech-border rounded-card p-6 relative overflow-hidden shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] flex flex-col gap-4">
            <span className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan to-purple opacity-85 z-5" />
            <span className="text-[12px] font-bold tracking-[0.8px] text-white uppercase font-mono">
              RESOLVE COVER ART FROM STORES
            </span>

            <form onSubmit={handleSearchCovers} className="flex gap-3">
              <input
                className="grow bg-bg-inner border border-tech-border rounded-inner text-white py-2.5 px-3.5 font-sans text-[12px] outline-none h-[38px] transition-all focus:border-cyan placeholder:text-gray/25"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Type game name to search..."
              />
              <button
                className="inline-flex items-center justify-center gap-2 px-4 font-sans font-semibold text-[11px] rounded-inner cursor-pointer transition-all duration-200 h-[38px] border border-tech-border bg-transparent text-purple select-none hover:bg-purple/8 hover:border-purple"
                type="submit"
                disabled={searching || !searchTerm.trim()}
              >
                {searching ? 'SEARCHING...' : 'SEARCH STORES'}
              </button>
            </form>

            {searchError && (
              <div className="bg-crimson/8 border border-crimson/20 text-crimson rounded-inner p-2.5 text-[11px] font-mono">
                {searchError}
              </div>
            )}

            <div className="flex flex-col gap-2.5 max-h-[300px] overflow-y-auto pr-1 scrollbar">
              {searchResults.map((res, index) => {
                const isSelected = coverUrl === res.cover_url;
                return (
                  <div
                    key={index}
                    className={`border rounded-inner p-2 flex items-center gap-3 cursor-pointer transition-all duration-200 h-[64px] ${isSelected ? 'border-cyan bg-cyan/4' : 'bg-bg-inner border-tech-border/50 hover:border-cyan'}`}
                    onClick={() => setCoverUrl(res.cover_url)}
                  >
                    <img
                      src={res.cover_url}
                      alt={res.title}
                      className="w-20 h-full object-cover rounded-inner border border-tech-border/30"
                    />
                    <div className="flex flex-col gap-0.5 grow overflow-hidden">
                      <span className="text-[11.5px] font-bold text-white truncate">
                        {res.title}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[7px] font-bold px-1 py-0.25 rounded-full uppercase bg-cyan/15 text-cyan border border-cyan/20">
                          {res.source}
                        </span>
                        {name !== res.title && (
                          <button
                            type="button"
                            className="font-sans font-semibold text-[7px] border border-tech-border/40 px-1 py-0.25 rounded-inner bg-transparent text-purple hover:text-white"
                            onClick={(e) => {
                              e.stopPropagation();
                              setName(res.title);
                            }}
                          >
                            AUTO-FILL TITLE
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ==========================================
   STEAM LIBRARY SCANNER MODAL WINDOW
   ========================================== */
interface SteamLibraryScannerProps {
  config: Config;
  onClose: () => void;
  onImport: (name: string, path: string, coverUrl: string | null, exePath: string | null) => void;
}

interface DetectedGame {
  name: string;
  exe_path: string;
  save_path_suggestion: string | null;
}

const SteamLibraryScanner: React.FC<SteamLibraryScannerProps> = ({ config, onClose, onImport }) => {
  const [games, setGames] = useState<DetectedGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [customPaths, setCustomPaths] = useState<Record<string, string>>({});

  const scanLibrary = async () => {
    setLoading(true);
    setError(null);
    try {
      const list: DetectedGame[] = await invoke('scan_steam_library');
      setGames(list);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    scanLibrary();
  }, []);

  const handleBrowseDirForGame = async (gameName: string) => {
    try {
      const selected: string | null = await invoke('select_directory');
      if (selected) {
        setCustomPaths((prev) => ({ ...prev, [gameName]: selected }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleImport = (game: DetectedGame) => {
    const savePath = customPaths[game.name] || game.save_path_suggestion;
    if (!savePath) return;
    onImport(game.name, savePath, null, game.exe_path);
  };

  const filteredGames = games.filter((g) => g.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="fixed inset-0 bg-[#030606]/80 backdrop-blur-[6px] flex justify-center items-center z-[1000] animate-[fadeIn_0.2s_ease-out]">
      <div className="w-[90%] max-w-[760px] flex flex-col max-h-[80vh] m-auto bg-bg-card backdrop-blur-md border border-tech-border rounded-card p-5 relative overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.7),0_0_30px_rgba(0,242,254,0.1)]">
        <span className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan to-purple opacity-85 z-5" />
        <header className="flex justify-between items-center mb-4 border-b border-tech-border/20 pb-3 shrink-0">
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-[0.8px] text-white uppercase flex items-center gap-2">
              <svg
                width="16"
                height="16"
                fill="currentColor"
                viewBox="0 0 16 16"
                className="text-cyan"
              >
                <path d="M14.285 4.887A8.04 8.04 0 0 0 16 0H0v16h8.868a8.04 8.04 0 0 0 5.417-3.113l-3.32-3.32a3.85 3.85 0 0 1-2.965.867 3.858 3.858 0 0 1-3.218-3.218 3.858 3.858 0 0 1 .867-2.965l3.32-3.32a3.85 3.85 0 0 1 2.965-.867 3.858 3.858 0 0 1 3.218 3.218 3.858 3.858 0 0 1-.867 2.965l3.32 3.32ZM7.785 8a.215.215 0 1 1-.43 0 .215.215 0 0 1 .43 0ZM13 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm-4 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" />
              </svg>
              STEAM LIBRARY SCANNER
            </span>
            <span className="text-[11px] text-gray mt-0.5">
              Scans your Steam library files to auto-detect game saves paths.
            </span>
          </div>
          <button
            className="inline-flex items-center justify-center gap-1.5 px-3 font-sans font-semibold text-[10px] rounded-inner cursor-pointer h-7 border border-tech-border bg-transparent text-crimson hover:bg-crimson/8 hover:border-crimson transition-all duration-200"
            onClick={onClose}
          >
            <CloseIcon className="w-3.5 h-3.5" />
            CLOSE
          </button>
        </header>

        {loading ? (
          <div className="flex flex-col justify-center items-center h-[220px] gap-3 text-gray grow shrink-0">
            <div className="w-6 h-6 border-2 border-cyan/15 border-t-cyan rounded-full animate-spin" />
            <span className="font-mono text-xs">SCANNING COMPUTER DRIVES...</span>
          </div>
        ) : error ? (
          <div className="bg-crimson/8 border border-crimson/20 text-crimson rounded-inner p-3 mb-4 text-xs font-mono grow shrink-0">
            Scan error: {error}
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2 mb-4 shrink-0">
              <input
                className="w-full bg-bg-inner border border-tech-border rounded-inner text-white py-2 px-3 font-sans text-[12.5px] outline-none h-[36px] transition-all focus:border-cyan placeholder:text-gray/25"
                placeholder="Type to filter scanned games by name..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>

            <div className="overflow-y-auto grow flex flex-col gap-3 pr-1 min-h-0 scrollbar">
              {filteredGames.length === 0 ? (
                <div className="text-center py-10 text-gray/50 font-mono text-xs">
                  No games found matching search filter.
                </div>
              ) : (
                filteredGames.map((game) => {
                  const isTracked = config.profiles.some(
                    (p) =>
                      p.exe_path === game.exe_path ||
                      p.name.toLowerCase() === game.name.toLowerCase()
                  );
                  const selectedPath = customPaths[game.name] || game.save_path_suggestion;

                  return (
                    <div
                      key={game.name}
                      className="flex flex-col bg-bg-inner/40 border border-tech-border/30 rounded-inner p-3 gap-2"
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex flex-col gap-0.5 overflow-hidden grow">
                          <span className="text-[12.5px] font-bold text-white truncate">
                            {game.name}
                          </span>
                          <span
                            className="text-[9.5px] text-gray font-mono truncate"
                            title={game.exe_path}
                          >
                            EXE: {game.exe_path}
                          </span>
                        </div>

                        {isTracked ? (
                          <span className="font-mono text-[9px] font-bold py-0.5 px-2.5 rounded-full bg-green/10 text-green border border-green/35">
                            ALREADY TRACKED
                          </span>
                        ) : (
                          <button
                            className="inline-flex items-center justify-center gap-1.5 px-3 font-sans font-bold text-[9.5px] rounded-inner cursor-pointer h-7 border border-transparent bg-cyan text-[#032021] hover:bg-[#33f5ff]"
                            disabled={!selectedPath}
                            onClick={() => handleImport(game)}
                          >
                            IMPORT GAME
                          </button>
                        )}
                      </div>

                      {!isTracked && (
                        <div className="flex items-center gap-3 mt-1.5 border-t border-tech-border/10 pt-2">
                          <div className="grow flex flex-col gap-0.5 overflow-hidden">
                            <span className="text-[8px] font-mono text-gray">
                              PROPOSED SAVE PATH:
                            </span>
                            <div className="flex items-center gap-2 bg-bg-inner/80 border border-tech-border/15 rounded-inner py-1 px-2.5">
                              {selectedPath ? (
                                <span
                                  className="font-mono text-[10.5px] text-cyan truncate"
                                  title={selectedPath}
                                >
                                  {selectedPath}
                                </span>
                              ) : (
                                <span className="font-mono text-[10.5px] text-crimson italic truncate">
                                  Save folder location not detected. Select directory manually.
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="inline-flex items-center justify-center gap-1.5 px-3.5 font-sans font-semibold text-[9.5px] rounded-inner cursor-pointer h-7 border border-tech-border bg-transparent text-purple hover:bg-purple/5 self-end shrink-0"
                            onClick={() => handleBrowseDirForGame(game.name)}
                          >
                            BROWSE
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
