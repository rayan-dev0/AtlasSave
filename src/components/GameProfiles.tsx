import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
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
}

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
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [showSteamScanner, setShowSteamScanner] = useState(false);

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

  return (
    <>
      <header className="mb-7 shrink-0 flex justify-between items-center flex-wrap gap-4">
        <div className="flex flex-col">
          <h1 className="text-[22px] font-bold tracking-[1.5px] text-white uppercase font-sans">
            Game Profiles
          </h1>
          <p className="text-gray text-xs mt-1.25">
            Track directories for auto save scans and trigger rotations.
          </p>
        </div>
        <button
          className="inline-flex items-center justify-center gap-2 px-4 font-sans font-semibold text-[11.5px] rounded-inner cursor-pointer transition-all duration-200 h-[34px] border border-tech-border bg-transparent text-purple select-none hover:not-disabled:bg-purple/8 hover:not-disabled:border-purple hover:not-disabled:shadow-[0_0_10px_rgba(208,188,255,0.2)] hover:not-disabled:-translate-y-0.5 active:not-disabled:translate-y-0"
          onClick={() => setShowSteamScanner(true)}
        >
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16">
            <path d="M14.285 4.887A8.04 8.04 0 0 0 16 0H0v16h8.868a8.04 8.04 0 0 0 5.417-3.113l-3.32-3.32a3.85 3.85 0 0 1-2.965.867 3.858 3.858 0 0 1-3.218-3.218 3.858 3.858 0 0 1 .867-2.965l3.32-3.32a3.85 3.85 0 0 1 2.965-.867 3.858 3.858 0 0 1 3.218 3.218 3.858 3.858 0 0 1-.867 2.965l3.32 3.32ZM7.785 8a.215.215 0 1 1-.43 0 .215.215 0 0 1 .43 0ZM13 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm-4 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" />
          </svg>
          SCAN STEAM LIBRARY
        </button>
      </header>

      {/* Grid of tracked profiles */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-5 mb-6.25">
        {config.profiles.length === 0 ? (
          <div className="col-span-full bg-bg-card backdrop-blur-md border border-tech-border rounded-card p-10 text-center relative overflow-hidden shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]">
            <span className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan to-purple opacity-85 z-5" />
            <p className="text-gray text-xs mt-1.25" style={{ fontSize: '13px' }}>
              No game profiles found. Configure game details below to start tracking.
            </p>
          </div>
        ) : (
          config.profiles.map((profile) => {
            const cardStyle: React.CSSProperties = profile.cover_url
              ? {
                  backgroundImage: `linear-gradient(rgba(22, 31, 32, 0.85), rgba(22, 31, 32, 0.95)), url(${profile.cover_url})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }
              : {};
            return (
              <div
                key={profile.id}
                className="bg-bg-card backdrop-blur-md border border-tech-border rounded-card p-5 flex flex-col justify-between gap-4 transition-all duration-250 hover:border-purple/45 hover:shadow-[0_6px_20px_rgba(208,188,255,0.05)]"
                style={cardStyle}
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="flex flex-col gap-1 w-[70%]">
                    <div className="flex items-center gap-2">
                      <svg
                        className="w-4 h-4 text-cyan"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth="2"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5.25 5.25a3 3 0 00-3 3v7.5a3 3 0 003 3h13.5a3 3 0 003-3v-7.5a3 3 0 00-3-3H5.25z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 9v6M6 12h6m6-1.5a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm-2.25 3a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"
                        />
                      </svg>
                      <span className="font-semibold text-sm text-white truncate">
                        {profile.name}
                      </span>
                    </div>
                    <span className="text-gray text-xs mt-0.5" style={{ fontSize: '10.5px' }}>
                      ID: {profile.id.substring(0, 8)}...
                    </span>
                  </div>

                  <div
                    className="flex items-center gap-2.5 cursor-pointer select-none group"
                    onClick={() => handleToggleProfileEnabled(profile)}
                  >
                    <div
                      className={`w-10 h-[22px] rounded-[11px] border relative transition-all duration-200 group-hover:border-cyan ${profile.enabled ? 'bg-green/15 border-green' : 'bg-[#111a1b] border-tech-border'}`}
                    >
                      <div
                        className={`w-3.5 h-3.5 rounded-full absolute top-[3px] transition-all duration-200 ${profile.enabled ? 'bg-green left-[20px] shadow-[0_0_8px_var(--color-green)]' : 'bg-gray left-[4px]'}`}
                      ></div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="font-mono text-[9px] font-bold text-gray uppercase tracking-[0.8px]">
                    WATCH ROUTE
                  </span>
                  <div className="flex items-center gap-2 bg-bg-inner border border-tech-border/25 rounded-inner py-2 px-3">
                    <svg
                      className="w-3.5 h-3.5 text-purple shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth="2"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15a2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
                      />
                    </svg>
                    <span
                      className="font-mono text-[10px] text-gray truncate"
                      title={profile.source_path}
                    >
                      {profile.source_path}
                    </span>
                  </div>
                </div>

                <div className="flex justify-end items-center gap-2.5 border-t border-tech-border/15 pt-3">
                  {confirmDeleteId === profile.id ? (
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] font-bold text-crimson uppercase tracking-[0.8px]">
                        DELETE?
                      </span>
                      <button
                        className="inline-flex items-center justify-center gap-2 px-2.5 font-sans font-semibold text-[10px] rounded-inner cursor-pointer transition-all duration-200 h-6.5 border border-tech-border bg-transparent text-crimson select-none hover:bg-crimson/8 hover:border-crimson hover:shadow-[0_0_10px_rgba(255,125,138,0.25)] hover:-translate-y-0.5 active:translate-y-0"
                        onClick={() => handleRemoveProfile(profile.id)}
                      >
                        YES
                      </button>
                      <button
                        className="inline-flex items-center justify-center gap-2 px-2.5 font-sans font-semibold text-[10px] rounded-inner cursor-pointer transition-all duration-200 h-6.5 border border-tech-border bg-transparent text-purple select-none hover:bg-purple/8 hover:border-purple hover:shadow-[0_0_10px_rgba(208,188,255,0.2)] hover:-translate-y-0.5 active:translate-y-0"
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        NO
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        className="inline-flex items-center justify-center gap-2 px-3 font-sans font-semibold text-[10px] rounded-inner cursor-pointer transition-all duration-200 h-7 border border-tech-border bg-transparent text-purple select-none hover:not-disabled:bg-purple/8 hover:not-disabled:border-purple hover:not-disabled:shadow-[0_0_10px_rgba(208,188,255,0.2)] hover:not-disabled:-translate-y-0.5 active:not-disabled:translate-y-0"
                        onClick={() => setEditingProfileId(profile.id)}
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
                            d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                          />
                        </svg>
                        EDIT
                      </button>
                      <button
                        className="inline-flex items-center justify-center gap-2 px-3 font-sans font-semibold text-[10px] rounded-inner cursor-pointer transition-all duration-200 h-7 border border-tech-border bg-transparent text-crimson select-none hover:bg-crimson/8 hover:border-crimson hover:shadow-[0_0_10px_rgba(255,125,138,0.25)] hover:-translate-y-0.5 active:translate-y-0"
                        onClick={() => setConfirmDeleteId(profile.id)}
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
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                        REMOVE
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Card: Add Game Profile - Collapsible */}
      {!isAdding ? (
        <div
          className="bg-bg-card/30 backdrop-blur-md border border-dashed border-cyan/45 rounded-card p-5 flex justify-center items-center cursor-pointer transition-all duration-200 hover:border-cyan/80 hover:bg-bg-card/50"
          onClick={() => setIsAdding(true)}
        >
          <div className="flex items-center gap-2.5 font-semibold text-cyan">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            ADD NEW GAME PROFILE
          </div>
        </div>
      ) : (
        <div className="bg-bg-card backdrop-blur-md border border-tech-border rounded-card p-6 relative overflow-hidden shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] animate-[fade-slide-in_0.25s_ease]">
          <span className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan to-purple opacity-85 z-5" />
          <header className="flex justify-between items-center mb-5 border-b border-tech-border/20 pb-3">
            <span className="text-[13.5px] font-bold tracking-[0.8px] text-white uppercase">
              ADD GAME DIRECTORY TRACKING
            </span>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 px-2.5 font-sans font-semibold text-[10px] rounded-inner cursor-pointer h-6.5 border border-tech-border bg-transparent text-crimson hover:bg-crimson/8 hover:border-crimson hover:shadow-[0_0_10px_rgba(255,125,138,0.25)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
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
              <svg
                style={{ width: 10, height: 10 }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
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
              {/* Left Column: Game Profile Details */}
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2 mb-5">
                  <label className="font-mono text-[10px] font-bold text-gray uppercase tracking-[0.8px] flex justify-between items-center">
                    GAME PROFILE NAME
                  </label>
                  <input
                    className="grow bg-bg-inner border border-tech-border rounded-inner text-white py-2.5 px-3.5 font-sans text-[12.5px] outline-none h-[38px] transition-all duration-200 focus:border-cyan focus:shadow-[0_0_8px_rgba(0,242,254,0.2)] placeholder:text-gray/35"
                    type="text"
                    placeholder="e.g. Elden Ring, The Witcher 3"
                    value={newProfileName}
                    onChange={(e) => setNewProfileName(e.target.value)}
                    required
                  />
                </div>

                <div className="flex flex-col gap-2 mb-5">
                  <label className="font-mono text-[10px] font-bold text-gray uppercase tracking-[0.8px] flex justify-between items-center">
                    SCAN GAME EXECUTABLE (AUTO-DETECT DIRECTORY)
                  </label>
                  <div className="flex gap-3">
                    <input
                      className="grow bg-bg-inner border border-tech-border rounded-inner text-white py-2.5 px-3.5 font-sans text-[12.5px] outline-none h-[38px] transition-all duration-200 focus:border-cyan focus:shadow-[0_0_8px_rgba(0,242,254,0.2)] placeholder:text-gray/35"
                      type="text"
                      placeholder="Select executable (e.g. game.exe) to search its saves..."
                      value={gameExePath}
                      onChange={(e) => setGameExePath(e.target.value)}
                    />
                    <button
                      type="button"
                      className="inline-flex items-center justify-center gap-2 px-4 font-sans font-semibold text-[11.5px] rounded-inner cursor-pointer transition-all duration-200 h-[38px] border border-tech-border bg-transparent text-purple select-none disabled:bg-[#465e60]/15 disabled:border-[#465e60]/20 disabled:text-[#a8bcbd]/40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none hover:not-disabled:bg-purple/8 hover:not-disabled:border-purple hover:not-disabled:shadow-[0_0_10px_rgba(208,188,255,0.2)] hover:not-disabled:-translate-y-0.5 active:not-disabled:translate-y-0"
                      onClick={handleBrowseFileAndDetect}
                      disabled={detecting}
                    >
                      {detecting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-cyan/10 border-t-cyan rounded-full animate-spin"></div>
                          SCANNING...
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
                              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z"
                            />
                          </svg>
                          BROWSE EXE
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {detectionMessage && (
                  <div
                    className={`flex items-center gap-2.5 border rounded-inner py-2.5 px-3.5 text-[11.5px] ${detectionMessage.isError ? 'bg-crimson/8 border-crimson/30 text-crimson' : 'bg-green/8 border-green/30 text-green'}`}
                  >
                    {!detectionMessage.isError ? (
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
                          d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.75 3.75 0 0121 12z"
                        />
                      </svg>
                    ) : (
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
                          d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                        />
                      </svg>
                    )}
                    <span>{detectionMessage.text}</span>
                  </div>
                )}

                <div className="flex flex-col gap-2 mb-5">
                  <label className="font-mono text-[10px] font-bold text-gray uppercase tracking-[0.8px] flex justify-between items-center">
                    MANUAL DIRECTORY PATH
                  </label>
                  <div className="flex gap-3">
                    <input
                      className="grow bg-bg-inner border border-tech-border rounded-inner text-white py-2.5 px-3.5 font-sans text-[12.5px] outline-none h-[38px] transition-all duration-200 focus:border-cyan focus:shadow-[0_0_8px_rgba(0,242,254,0.2)] placeholder:text-gray/35"
                      type="text"
                      placeholder="Paste save games folder path or browse manually..."
                      value={newProfilePath}
                      onChange={(e) => setNewProfilePath(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="inline-flex items-center justify-center gap-2 px-4 font-sans font-semibold text-[11.5px] rounded-inner cursor-pointer transition-all duration-200 h-[38px] border border-tech-border bg-transparent text-purple select-none hover:not-disabled:bg-purple/8 hover:not-disabled:border-purple hover:not-disabled:shadow-[0_0_10px_rgba(208,188,255,0.2)] hover:not-disabled:-translate-y-0.5 active:not-disabled:translate-y-0"
                      onClick={() => handleBrowseDir(setNewProfilePath)}
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
                      BROWSE FOLDER
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-2 mb-5">
                  <label className="font-mono text-[10px] font-bold text-gray uppercase tracking-[0.8px] flex justify-between items-center">
                    ACTIVE COVER BACKDROP PREVIEW
                  </label>
                  <div
                    className="h-[100px] rounded-inner border border-tech-border overflow-hidden relative flex items-center justify-center"
                    style={{
                      background: selectedCoverUrl
                        ? `linear-gradient(rgba(22, 31, 32, 0.5), rgba(22, 31, 32, 0.8)), url(${selectedCoverUrl})`
                        : '#030606',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  >
                    {!selectedCoverUrl && (
                      <span className="text-[11px] text-gray/60 font-mono">
                        NO COVER ART SELECTED
                      </span>
                    )}
                    {selectedCoverUrl && (
                      <button
                        type="button"
                        className="inline-flex items-center justify-center gap-2 px-2.5 font-sans font-semibold text-[10px] rounded-inner cursor-pointer h-6.5 border border-tech-border bg-transparent text-crimson hover:bg-crimson/8 hover:border-crimson hover:shadow-[0_0_10px_rgba(255,125,138,0.25)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
                        style={{ position: 'absolute', top: '8px', right: '8px' }}
                        onClick={() => setSelectedCoverUrl(null)}
                      >
                        REMOVE ART
                      </button>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-2 px-4 font-sans font-semibold text-[11.5px] rounded-inner cursor-pointer transition-all duration-200 h-[34px] border border-transparent bg-cyan text-[#032021] select-none mt-2.5 shadow-[0_2px_8px_rgba(0,242,254,0.15)] disabled:bg-[#465e60]/15 disabled:border-[#465e60]/20 disabled:text-[#a8bcbd]/40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none hover:not-disabled:bg-[#33f5ff] hover:not-disabled:shadow-[0_0_12px_rgba(0,242,254,0.45)] hover:not-disabled:-translate-y-0.5 active:not-disabled:translate-y-0"
                  disabled={!newProfileName.trim() || !newProfilePath.trim()}
                >
                  <svg
                    style={{ width: 14, height: 14 }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  SAVE GAME PROFILE
                </button>
              </div>

              {/* Right Column: Resolve Cover Art */}
              <div className="flex flex-col gap-4 border-l border-tech-border pl-6 max-md:border-l-0 max-md:pl-0 max-md:border-t max-md:pt-5">
                <span className="text-[10.5px] font-bold tracking-[0.8px] text-white uppercase">
                  RESOLVE COVER ART FROM STORES
                </span>

                <div className="flex gap-3 mb-2">
                  <input
                    className="grow bg-bg-inner border border-tech-border rounded-inner text-white py-2.5 px-3.5 font-sans text-[12.5px] outline-none h-[38px] transition-all duration-200 focus:border-cyan focus:shadow-[0_0_8px_rgba(0,242,254,0.2)] placeholder:text-gray/35"
                    value={coverSearchTerm}
                    onChange={(e) => setCoverSearchTerm(e.target.value)}
                    placeholder="Search query for storefronts..."
                  />
                  <button
                    className="inline-flex items-center justify-center gap-2 px-4 font-sans font-semibold text-[11.5px] rounded-inner cursor-pointer transition-all duration-200 h-[38px] border border-tech-border bg-transparent text-purple select-none disabled:bg-[#465e60]/15 disabled:border-[#465e60]/20 disabled:text-[#a8bcbd]/40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none hover:not-disabled:bg-purple/8 hover:not-disabled:border-purple hover:not-disabled:shadow-[0_0_10px_rgba(208,188,255,0.2)] hover:not-disabled:-translate-y-0.5 active:not-disabled:translate-y-0"
                    type="button"
                    onClick={() => handleSearchAddCovers()}
                    disabled={searching || !coverSearchTerm.trim()}
                  >
                    {searching ? (
                      <>
                        <div className="w-4 h-4 border-2 border-cyan/10 border-t-cyan rounded-full animate-spin"></div>
                        SEARCHING...
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
                            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z"
                          />
                        </svg>
                        SEARCH
                      </>
                    )}
                  </button>
                </div>

                {searchError && (
                  <div className="flex items-center gap-2.5 bg-crimson/8 border border-crimson/30 text-crimson rounded-inner py-2.5 px-3.5 mb-4 text-[11.5px]">
                    <span className="font-mono text-xs">{searchError}</span>
                  </div>
                )}

                <div className="flex flex-col gap-3 max-h-[240px] overflow-y-auto pr-1 scrollbar">
                  {searchResults.map((res, index) => {
                    const isSelected = selectedCoverUrl === res.cover_url;
                    return (
                      <div
                        key={index}
                        className={`border rounded-inner p-2.5 flex items-center gap-2.5 cursor-pointer transition-all duration-200 h-[60px] ${isSelected ? 'border-cyan bg-cyan/4' : 'bg-bg-inner border-tech-border hover:border-cyan'}`}
                        onClick={() => setSelectedCoverUrl(res.cover_url)}
                      >
                        <img
                          src={res.cover_url}
                          alt="Cover preview"
                          className="w-16 h-9 object-cover rounded-inner border border-tech-border"
                        />
                        <div className="flex flex-col gap-0.5 grow overflow-hidden">
                          <span
                            className="text-[11px] font-semibold text-white truncate"
                            title={res.title}
                          >
                            {res.title}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[7px] font-bold px-1 rounded-[20px] uppercase tracking-[0.5px] bg-cyan/10 text-cyan border border-cyan/20">
                              {res.source.toUpperCase()}
                            </span>
                            {newProfileName !== res.title && (
                              <button
                                type="button"
                                className="inline-flex items-center justify-center gap-1.5 px-1 font-sans font-semibold text-[7px] rounded-inner cursor-pointer transition-all duration-200 h-4 border border-tech-border bg-transparent text-purple select-none hover:bg-purple/8 hover:text-white"
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
                  {!searching && searchResults.length === 0 && !searchError && (
                    <div className="text-center py-5 px-2.5 text-gray/50 font-mono text-[10px]">
                      Cover options will search automatically when name is entered.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </form>
        </div>
      )}
      {showSteamScanner && (
        <SteamLibraryScanner
          config={config}
          onClose={() => setShowSteamScanner(false)}
          onImport={(name, path, coverUrl, exePath) => {
            handleAddProfile(name, path, coverUrl, exePath);
          }}
        />
      )}
    </>
  );
};

// Subpage component for editing Profile in details
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

interface CoverSearchResult {
  title: string;
  cover_url: string;
  source: string;
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
    <>
      <header className="mb-7 shrink-0 flex justify-between items-center flex-wrap gap-4">
        <div className="flex flex-col">
          <h1 className="text-[22px] font-bold tracking-[1.5px] text-white uppercase font-sans">
            Edit Profile
          </h1>
          <p className="text-gray text-xs mt-1.25">
            Adjust folder settings and select custom cover artwork.
          </p>
        </div>
        <button
          className="inline-flex items-center justify-center gap-2 px-4 font-sans font-semibold text-[11.5px] rounded-inner cursor-pointer transition-all duration-200 h-[34px] border border-tech-border bg-transparent text-purple select-none hover:not-disabled:bg-purple/8 hover:not-disabled:border-purple hover:not-disabled:shadow-[0_0_10px_rgba(208,188,255,0.2)] hover:not-disabled:-translate-y-0.5 active:not-disabled:translate-y-0"
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

      <div className="grid grid-cols-2 gap-6 max-md:grid-cols-1 max-md:gap-5">
        {/* Left Column: Details form & actions */}
        <div className="bg-bg-card backdrop-blur-md border border-tech-border rounded-card p-6 relative overflow-hidden shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] flex flex-col gap-5">
          <span className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan to-purple opacity-85 z-5" />
          <span className="text-[13.5px] font-bold tracking-[0.8px] text-white uppercase">
            PROFILE PROPERTIES
          </span>

          <div className="flex flex-col gap-2 mb-5">
            <label className="font-mono text-[10px] font-bold text-gray uppercase tracking-[0.8px] flex justify-between items-center">
              GAME PROFILE NAME
            </label>
            <input
              className="grow bg-bg-inner border border-tech-border rounded-inner text-white py-2.5 px-3.5 font-sans text-[12.5px] outline-none h-[38px] transition-all duration-200 focus:border-cyan focus:shadow-[0_0_8px_rgba(0,242,254,0.2)] placeholder:text-gray/35"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Game profile identifier"
            />
          </div>

          <div className="flex flex-col gap-2 mb-5">
            <label className="font-mono text-[10px] font-bold text-gray uppercase tracking-[0.8px] flex justify-between items-center">
              WATCH SAVE DIRECTORY
            </label>
            <div className="flex gap-3">
              <input
                className="grow bg-bg-inner border border-tech-border rounded-inner text-white py-2.5 px-3.5 font-sans text-[12.5px] outline-none h-[38px] transition-all duration-200 focus:border-cyan focus:shadow-[0_0_8px_rgba(0,242,254,0.2)] placeholder:text-gray/35"
                value={path}
                onChange={(e) => setPath(e.target.value)}
              />
              <button
                className="inline-flex items-center justify-center gap-2 px-4 font-sans font-semibold text-[11.5px] rounded-inner cursor-pointer transition-all duration-200 h-[38px] border border-tech-border bg-transparent text-purple select-none hover:not-disabled:bg-purple/8 hover:not-disabled:border-purple hover:not-disabled:shadow-[0_0_10px_rgba(208,188,255,0.2)] hover:not-disabled:-translate-y-0.5 active:not-disabled:translate-y-0"
                type="button"
                onClick={() => onBrowseDir(setPath)}
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

          <div className="flex flex-col gap-2 mb-5">
            <label className="font-mono text-[10px] font-bold text-gray uppercase tracking-[0.8px] flex justify-between items-center">
              LINK GAME EXECUTABLE (LAUNCH & AUTO-BACKUP)
            </label>
            <div className="flex gap-3">
              <input
                className="grow bg-bg-inner border border-tech-border rounded-inner text-white py-2.5 px-3.5 font-sans text-[12.5px] outline-none h-[38px] transition-all duration-200 focus:border-cyan focus:shadow-[0_0_8px_rgba(0,242,254,0.2)] placeholder:text-gray/35"
                value={exePath}
                onChange={(e) => setExePath(e.target.value)}
                placeholder="Optional link to game executable (e.g. eldenring.exe)..."
              />
              <button
                className="inline-flex items-center justify-center gap-2 px-4 font-sans font-semibold text-[11.5px] rounded-inner cursor-pointer transition-all duration-200 h-[38px] border border-tech-border bg-transparent text-purple select-none hover:not-disabled:bg-purple/8 hover:not-disabled:border-purple hover:not-disabled:shadow-[0_0_10px_rgba(208,188,255,0.2)] hover:not-disabled:-translate-y-0.5 active:not-disabled:translate-y-0"
                type="button"
                onClick={handleBrowseExe}
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
                    d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z"
                  />
                </svg>
                BROWSE EXE
              </button>
            </div>
          </div>

          {/* Large cover art background preview inside the edit card */}
          <div className="flex flex-col gap-2 mb-5">
            <label className="font-mono text-[10px] font-bold text-gray uppercase tracking-[0.8px] flex justify-between items-center">
              ACTIVE COVER BACKDROP PREVIEW
            </label>
            <div
              className="h-[140px] rounded-inner border border-tech-border overflow-hidden relative flex items-center justify-center"
              style={{
                background: coverUrl
                  ? `linear-gradient(rgba(22, 31, 32, 0.5), rgba(22, 31, 32, 0.8)), url(${coverUrl})`
                  : '#030606',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              {!coverUrl && (
                <span className="text-[11px] text-gray/60 font-mono">NO COVER ART SELECTED</span>
              )}
              {coverUrl && (
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 px-2.5 font-sans font-semibold text-[10px] rounded-inner cursor-pointer h-6.5 border border-tech-border bg-transparent text-crimson hover:bg-crimson/8 hover:border-crimson hover:shadow-[0_0_10px_rgba(255,125,138,0.25)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
                  style={{ position: 'absolute', top: '8px', right: '8px' }}
                  onClick={() => setCoverUrl(null)}
                >
                  REMOVE ART
                </button>
              )}
            </div>
          </div>

          <div className="flex gap-3 mt-3">
            <button
              className="grow inline-flex items-center justify-center gap-2 px-4 font-sans font-semibold text-[11.5px] rounded-inner cursor-pointer transition-all duration-200 h-[34px] border border-transparent bg-cyan text-[#032021] select-none shadow-[0_2px_8px_rgba(0,242,254,0.15)] disabled:bg-[#465e60]/15 disabled:border-[#465e60]/20 disabled:text-[#a8bcbd]/40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none hover:not-disabled:bg-[#33f5ff] hover:not-disabled:shadow-[0_0_12px_rgba(0,242,254,0.45)] hover:not-disabled:-translate-y-0.5 active:not-disabled:translate-y-0"
              onClick={() =>
                onSave(profile.id, name, path, profile.enabled, coverUrl, exePath || null)
              }
              disabled={!name.trim() || !path.trim()}
            >
              <svg
                style={{ width: 14, height: 14 }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              SAVE PROFILE CHANGES
            </button>
          </div>
        </div>

        {/* Right Column: Cover Art Selection database */}
        <div className="bg-bg-card backdrop-blur-md border border-tech-border rounded-card p-6 relative overflow-hidden shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] flex flex-col gap-4">
          <span className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan to-purple opacity-85 z-5" />
          <span className="text-[13.5px] font-bold tracking-[0.8px] text-white uppercase">
            RESOLVE COVER ART FROM STORES
          </span>

          <form onSubmit={handleSearchCovers} className="flex gap-3 mb-2">
            <input
              className="grow bg-bg-inner border border-tech-border rounded-inner text-white py-2.5 px-3.5 font-sans text-[12.5px] outline-none h-[38px] transition-all duration-200 focus:border-cyan focus:shadow-[0_0_8px_rgba(0,242,254,0.2)] placeholder:text-gray/35"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Type game name to search..."
            />
            <button
              className="inline-flex items-center justify-center gap-2 px-4 font-sans font-semibold text-[11.5px] rounded-inner cursor-pointer transition-all duration-200 h-[38px] border border-tech-border bg-transparent text-purple select-none disabled:bg-[#465e60]/15 disabled:border-[#465e60]/20 disabled:text-[#a8bcbd]/40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none hover:not-disabled:bg-purple/8 hover:not-disabled:border-purple hover:not-disabled:shadow-[0_0_10px_rgba(208,188,255,0.2)] hover:not-disabled:-translate-y-0.5 active:not-disabled:translate-y-0"
              type="submit"
              disabled={searching || !searchTerm.trim()}
            >
              {searching ? (
                <>
                  <div className="w-4 h-4 border-2 border-cyan/10 border-t-cyan rounded-full animate-spin"></div>
                  SEARCHING...
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
                      d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z"
                    />
                  </svg>
                  SEARCH STORES
                </>
              )}
            </button>
          </form>

          {searchError && (
            <div className="flex items-center gap-2.5 bg-crimson/8 border border-crimson/30 text-crimson rounded-inner py-2.5 px-3.5 mb-4 text-[11.5px]">
              <span className="font-mono text-xs">{searchError}</span>
            </div>
          )}

          {/* Results list */}
          <div className="flex flex-col gap-3 max-h-[320px] overflow-y-auto pr-1 scrollbar">
            {searchResults.map((res, index) => {
              const isSelected = coverUrl === res.cover_url;
              return (
                <div
                  key={index}
                  className={`border rounded-inner p-3 flex items-center gap-3 cursor-pointer transition-all duration-200 h-20 relative ${isSelected ? 'border-cyan bg-cyan/4' : 'bg-bg-inner border-tech-border hover:border-cyan'}`}
                  onClick={() => setCoverUrl(res.cover_url)}
                >
                  <img
                    src={res.cover_url}
                    alt="Cover preview"
                    className="w-20 h-[45px] object-cover rounded-inner border border-tech-border"
                  />
                  <div className="flex flex-col gap-0.5 grow overflow-hidden">
                    <span className="text-xs font-semibold text-white truncate" title={res.title}>
                      {res.title}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[8px] font-bold px-1.5 py-0.25 rounded-[20px] uppercase tracking-[0.5px] bg-cyan/10 text-cyan border border-cyan/20">
                        {res.source.toUpperCase()}
                      </span>
                      {name !== res.title && (
                        <button
                          type="button"
                          className="inline-flex items-center justify-center gap-1.5 px-1.5 font-sans font-semibold text-[8px] rounded-inner cursor-pointer transition-all duration-200 h-5 border border-tech-border bg-transparent text-purple select-none hover:bg-purple/8 hover:text-white"
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
            {!searching && searchResults.length === 0 && !searchError && (
              <div className="text-center py-10 px-2.5 text-gray/50 font-mono text-xs">
                Enter search query above to browse cover art from Steam, GOG, & Epic Games Store
                databases.
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

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
    <div className="fixed inset-0 bg-[#030606]/75 backdrop-blur-[8px] flex justify-center items-center z-[1000] animate-[fadeIn_0.2s_ease-out]">
      <div className="w-[90%] max-w-[800px] flex flex-col max-h-[85vh] m-auto bg-bg-card backdrop-blur-md border border-tech-border rounded-card p-6 relative overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.7),0_0_30px_rgba(0,242,254,0.1)]">
        <span className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan to-purple opacity-85 z-5" />
        <header className="flex justify-between items-center mb-4 border-b border-tech-border/20 pb-3">
          <div className="flex flex-col">
            <span className="text-base font-bold tracking-[0.8px] text-white uppercase flex items-center gap-2">
              <svg
                width="18"
                height="18"
                fill="currentColor"
                viewBox="0 0 16 16"
                className="text-cyan"
              >
                <path d="M14.285 4.887A8.04 8.04 0 0 0 16 0H0v16h8.868a8.04 8.04 0 0 0 5.417-3.113l-3.32-3.32a3.85 3.85 0 0 1-2.965.867 3.858 3.858 0 0 1-3.218-3.218 3.858 3.858 0 0 1 .867-2.965l3.32-3.32a3.85 3.85 0 0 1 2.965-.867 3.858 3.858 0 0 1 3.218 3.218 3.858 3.858 0 0 1-.867 2.965l3.32 3.32ZM7.785 8a.215.215 0 1 1-.43 0 .215.215 0 0 1 .43 0ZM13 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm-4 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" />
              </svg>
              STEAM LIBRARY GAME SCANNER
            </span>
            <span className="text-[11px] text-gray mt-0.5">
              Heuristically auto-detects save folders for installed games in your Steam library
              directories.
            </span>
          </div>
          <button
            className="inline-flex items-center justify-center gap-2 px-2.5 font-sans font-semibold text-[10px] rounded-inner cursor-pointer h-6.5 border border-tech-border bg-transparent text-crimson hover:bg-crimson/8 hover:border-crimson hover:shadow-[0_0_10px_rgba(255,125,138,0.25)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
            onClick={onClose}
          >
            CLOSE SCANNER
          </button>
        </header>

        {loading ? (
          <div className="flex flex-col justify-center items-center h-[240px] gap-3 text-gray">
            <div className="w-6 h-6 border-2 border-cyan/10 border-t-cyan rounded-full animate-spin"></div>
            <span className="font-mono text-xs">SCANNING SYSTEM LIBRARY...</span>
          </div>
        ) : error ? (
          <div className="flex items-center gap-2.5 bg-crimson/8 border border-crimson/30 text-crimson rounded-inner py-2.5 px-3.5 mb-4 text-[11.5px]">
            <span>Scan failed: {error}</span>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2 mb-4">
              <input
                className="grow bg-bg-inner border border-tech-border rounded-inner text-white py-2.5 px-3.5 font-sans text-[12.5px] outline-none h-[38px] transition-all duration-200 focus:border-cyan focus:shadow-[0_0_8px_rgba(0,242,254,0.2)] placeholder:text-gray/35"
                placeholder="Filter detected games by name..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>

            <div className="overflow-y-auto grow flex flex-col gap-2.5 pr-1 min-h-[200px] scrollbar">
              {filteredGames.length === 0 ? (
                <div
                  style={{
                    padding: '40px 10px',
                    textAlign: 'center',
                    color: 'var(--color-gray)',
                    fontStyle: 'italic',
                  }}
                >
                  No games found matching search filters.
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
                      className="flex flex-col bg-bg-card/40 border border-tech-border rounded-inner p-3.5 px-4 gap-2"
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex flex-col gap-0.5 overflow-hidden grow">
                          <span className="text-[13px] font-bold text-white truncate">
                            {game.name}
                          </span>
                          <span
                            className="text-[10px] text-gray font-mono truncate"
                            title={game.exe_path}
                          >
                            EXE: {game.exe_path}
                          </span>
                        </div>

                        {isTracked ? (
                          <span className="font-mono text-[9px] font-bold py-0.75 px-2.5 rounded-[20px] uppercase tracking-[0.5px] bg-green/10 text-green border border-green/35 shadow-[0_0_6px_rgba(89,248,180,0.1)] shrink-0">
                            ALREADY TRACKED
                          </span>
                        ) : (
                          <button
                            className="inline-flex items-center justify-center gap-2 px-4 font-sans font-semibold text-[10px] rounded-inner cursor-pointer transition-all duration-200 h-7 border border-transparent bg-cyan text-[#032021] select-none hover:bg-[#33f5ff] flex-shrink-0"
                            disabled={!selectedPath}
                            onClick={() => handleImport(game)}
                          >
                            IMPORT GAME
                          </button>
                        )}
                      </div>

                      {!isTracked && (
                        <div className="flex items-center gap-2.5 mt-1">
                          <div className="grow flex flex-col gap-0.5 overflow-hidden">
                            <span className="text-[9px] text-gray">TARGET SAVE PATH</span>
                            <div className="flex items-center gap-2 bg-bg-inner border border-tech-border/20 rounded-inner py-1 px-2">
                              {selectedPath ? (
                                <span
                                  className="font-mono text-[11px] text-cyan truncate"
                                  title={selectedPath}
                                >
                                  {selectedPath}
                                </span>
                              ) : (
                                <span className="font-mono text-[11px] text-crimson italic truncate">
                                  Could not detect save directory automatically.
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="inline-flex items-center justify-center gap-2 px-3 font-sans font-semibold text-[9px] rounded-inner cursor-pointer transition-all duration-200 h-7 border border-tech-border bg-transparent text-purple select-none hover:not-disabled:bg-purple/8 hover:not-disabled:border-purple hover:not-disabled:shadow-[0_0_10px_rgba(208,188,255,0.2)] hover:not-disabled:-translate-y-0.5 active:not-disabled:translate-y-0 self-end"
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
