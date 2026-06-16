import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Config, Profile } from "../types";

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
  handleAddProfile: (name: string, path: string, coverUrl: string | null) => void;
  handleSaveProfileEdit: (id: string, name: string, path: string, enabled: boolean, coverUrl?: string | null) => void;
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
  
  // Separate states for cover art search and selection in the Add form
  const [coverSearchTerm, setCoverSearchTerm] = useState("");
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
      const results: CoverSearchResult[] = await invoke("search_game_covers", { searchTerm: coverSearchTerm.trim() });
      setSearchResults(results);
      if (results.length === 0) {
        setSearchError("No cover art matches found.");
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
          const results: CoverSearchResult[] = await invoke("search_game_covers", { searchTerm: newProfileName.trim() });
          setSearchResults(results);
          if (results.length > 0) {
            setSelectedCoverUrl(results[0].cover_url);
          }
        } catch (err) {
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
    const profileToEdit = config.profiles.find(p => p.id === editingProfileId);
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
      <header className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Game Profiles</h1>
          <p className="page-subtitle">Track directories for auto save scans and trigger rotations.</p>
        </div>
      </header>

      {/* Grid of tracked profiles */}
      <div className="profile-grid-list">
        {config.profiles.length === 0 ? (
          <div className="tech-card" style={{ gridColumn: "1 / -1", textAlign: "center", padding: "40px 20px" }}>
            <p className="page-subtitle" style={{ fontSize: "13px" }}>No game profiles found. Configure game details below to start tracking.</p>
          </div>
        ) : (
          config.profiles.map((profile) => {
            const cardStyle: React.CSSProperties = profile.cover_url
              ? {
                  backgroundImage: `linear-gradient(rgba(22, 31, 32, 0.85), rgba(22, 31, 32, 0.95)), url(${profile.cover_url})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : {};
            return (
              <div key={profile.id} className="profile-card-item" style={cardStyle}>
                <div className="profile-card-top">
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "70%" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <svg style={{ width: 16, height: 16, color: "var(--color-cyan)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.25a3 3 0 00-3 3v7.5a3 3 0 003 3h13.5a3 3 0 003-3v-7.5a3 3 0 00-3-3H5.25z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 9v6M6 12h6m6-1.5a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm-2.25 3a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                      </svg>
                      <span className="profile-name" style={{ fontSize: "14px" }}>{profile.name}</span>
                    </div>
                    <span className="page-subtitle" style={{ fontSize: "10.5px" }}>ID: {profile.id.substring(0, 8)}...</span>
                  </div>

                  <div className={`switch-container ${profile.enabled ? "active" : ""}`} onClick={() => handleToggleProfileEnabled(profile)}>
                    <div className="switch-track">
                      <div className="switch-thumb"></div>
                    </div>
                  </div>
                </div>

                <div className="profile-card-body">
                  <span className="form-label" style={{ fontSize: "9px" }}>WATCH ROUTE</span>
                  <div className="profile-card-path-container">
                    <svg className="profile-card-path-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                    </svg>
                    <span className="profile-card-path" title={profile.source_path}>{profile.source_path}</span>
                  </div>
                </div>

                <div className="profile-card-actions">
                  {confirmDeleteId === profile.id ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span className="form-label" style={{ color: "var(--color-crimson)", fontSize: "10px" }}>DELETE?</span>
                      <button
                        className="btn btn-danger"
                        style={{ height: "26px", fontSize: "10px", padding: "0 10px" }}
                        onClick={() => handleRemoveProfile(profile.id)}
                      >
                        YES
                      </button>
                      <button
                        className="btn btn-outline"
                        style={{ height: "26px", fontSize: "10px", padding: "0 10px" }}
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        NO
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        className="btn btn-outline"
                        style={{ height: "28px", padding: "0 10px", fontSize: "10px" }}
                        onClick={() => setEditingProfileId(profile.id)}
                      >
                        <svg style={{ width: 12, height: 12 }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                        </svg>
                        EDIT
                      </button>
                      <button
                        className="btn btn-danger"
                        style={{ height: "28px", padding: "0 10px", fontSize: "10px" }}
                        onClick={() => setConfirmDeleteId(profile.id)}
                      >
                        <svg style={{ width: 12, height: 12 }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
          className="tech-card" 
          style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "20px", cursor: "pointer", borderStyle: "dashed", borderColor: "rgba(0, 242, 254, 0.45)", background: "rgba(22, 31, 32, 0.3)" }}
          onClick={() => setIsAdding(true)}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", fontWeight: "600", color: "var(--color-cyan)" }}>
            <svg style={{ width: 16, height: 16 }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            ADD NEW GAME PROFILE
          </div>
        </div>
      ) : (
        <div className="tech-card" style={{ animation: "fade-slide-in 0.25s ease" }}>
          <header className="tech-card-header">
            <span className="tech-card-title">ADD GAME DIRECTORY TRACKING</span>
            <button 
              type="button" 
              className="btn btn-danger" 
              style={{ height: "26px", padding: "0 10px", fontSize: "10px" }}
              onClick={() => {
                setIsAdding(false);
                setNewProfileName("");
                setNewProfilePath("");
                setGameExePath("");
                setDetectionMessage(null);
                setCoverSearchTerm("");
                setSelectedCoverUrl(null);
                setSearchResults([]);
                setSearchError(null);
              }}
            >
              <svg style={{ width: 10, height: 10 }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              CANCEL
            </button>
          </header>

          <form onSubmit={(e) => {
            e.preventDefault();
            handleAddProfile(newProfileName, newProfilePath, selectedCoverUrl);
            setIsAdding(false);
          }}>
            <div className="profile-form-grid">
              {/* Left Column: Game Profile Details */}
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div className="form-group">
                  <label className="form-label">GAME PROFILE NAME</label>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="e.g. Elden Ring, The Witcher 3"
                    value={newProfileName}
                    onChange={(e) => setNewProfileName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">SCAN GAME EXECUTABLE (AUTO-DETECT DIRECTORY)</label>
                  <div className="form-input-row">
                    <input
                      className="form-input"
                      type="text"
                      placeholder="Select executable (e.g. game.exe) to search its saves..."
                      value={gameExePath}
                      onChange={(e) => setGameExePath(e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={handleBrowseFileAndDetect}
                      disabled={detecting}
                    >
                      {detecting ? (
                        <>
                          <div className="loader-spinner"></div>
                          SCANNING...
                        </>
                      ) : (
                        <>
                          <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
                          </svg>
                          BROWSE EXE
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {detectionMessage && (
                  <div className={`detection-banner ${detectionMessage.isError ? "detection-banner-error" : ""}`} style={{ marginBottom: 0 }}>
                    {!detectionMessage.isError ? (
                      <svg style={{ width: 14, height: 14, color: "var(--color-green)", flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.75 3.75 0 0121 12z" />
                      </svg>
                    ) : (
                      <svg style={{ width: 14, height: 14, color: "var(--color-crimson)", flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                      </svg>
                    )}
                    <span>{detectionMessage.text}</span>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">MANUAL DIRECTORY PATH</label>
                  <div className="form-input-row">
                    <input
                      className="form-input"
                      type="text"
                      placeholder="Paste save games folder path or browse manually..."
                      value={newProfilePath}
                      onChange={(e) => setNewProfilePath(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => handleBrowseDir(setNewProfilePath)}
                    >
                      <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                      </svg>
                      BROWSE FOLDER
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">ACTIVE COVER BACKDROP PREVIEW</label>
                  <div style={{
                    height: "100px",
                    borderRadius: "var(--radius-inner)",
                    border: "1px solid var(--border-color-tech)",
                    overflow: "hidden",
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: selectedCoverUrl ? `linear-gradient(rgba(22, 31, 32, 0.5), rgba(22, 31, 32, 0.8)), url(${selectedCoverUrl})` : "#030606",
                    backgroundSize: "cover",
                    backgroundPosition: "center"
                  }}>
                    {!selectedCoverUrl && (
                      <span style={{ fontSize: "11px", color: "var(--color-gray)", opacity: 0.6, fontFamily: "var(--font-mono)" }}>NO COVER ART SELECTED</span>
                    )}
                    {selectedCoverUrl && (
                      <button
                        type="button"
                        className="btn btn-danger"
                        style={{ position: "absolute", top: "8px", right: "8px", height: "24px", padding: "0 8px", fontSize: "10px" }}
                        onClick={() => setSelectedCoverUrl(null)}
                      >
                        REMOVE ART
                      </button>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: "100%", marginTop: "10px" }}
                  disabled={!newProfileName.trim() || !newProfilePath.trim()}
                >
                  <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  SAVE GAME PROFILE
                </button>
              </div>

              {/* Right Column: Resolve Cover Art */}
              <div className="profile-form-right-col">
                <span className="tech-card-title" style={{ fontSize: "10.5px" }}>RESOLVE COVER ART FROM STORES</span>
                
                <div className="form-input-row" style={{ marginBottom: "8px" }}>
                  <input
                    className="form-input"
                    value={coverSearchTerm}
                    onChange={(e) => setCoverSearchTerm(e.target.value)}
                    placeholder="Search query for storefronts..."
                  />
                  <button className="btn btn-outline" type="button" onClick={() => handleSearchAddCovers()} disabled={searching || !coverSearchTerm.trim()}>
                    {searching ? (
                      <>
                        <div className="loader-spinner"></div>
                        SEARCHING...
                      </>
                    ) : (
                      <>
                        <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
                        </svg>
                        SEARCH
                      </>
                    )}
                  </button>
                </div>

                {searchError && (
                  <div className="detection-banner detection-banner-error" style={{ margin: 0 }}>
                    <span style={{ fontSize: "11px", fontFamily: "var(--font-mono)" }}>{searchError}</span>
                  </div>
                )}

                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  maxHeight: "240px",
                  overflowY: "auto",
                  paddingRight: "4px"
                }}>
                  {searchResults.map((res, index) => {
                    const isSelected = selectedCoverUrl === res.cover_url;
                    return (
                      <div 
                        key={index}
                        className={`provider-option-box ${isSelected ? "active" : ""}`}
                        style={{ margin: 0, padding: "10px", gap: "10px", minHeight: "60px" }}
                        onClick={() => setSelectedCoverUrl(res.cover_url)}
                      >
                        <img 
                          src={res.cover_url} 
                          alt="Cover preview" 
                          style={{ width: "64px", height: "36px", objectFit: "cover", borderRadius: "var(--radius-inner)", border: "1px solid var(--border-color-tech)" }} 
                        />
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px", flexGrow: 1, overflow: "hidden" }}>
                          <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--color-white)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={res.title}>
                            {res.title}
                          </span>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span className="badge" style={{ padding: "0px 4px", fontSize: "7px", background: "rgba(0, 242, 254, 0.1)", color: "var(--color-cyan)", border: "1px solid rgba(0, 242, 254, 0.2)" }}>
                              {res.source.toUpperCase()}
                            </span>
                            {newProfileName !== res.title && (
                              <button
                                type="button"
                                className="btn btn-outline"
                                style={{ height: "16px", padding: "0 4px", fontSize: "7px" }}
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
                    <div style={{ textAlign: "center", padding: "20px 10px", color: "var(--color-gray)", opacity: 0.5, fontFamily: "var(--font-mono)", fontSize: "10px" }}>
                      Cover options will search automatically when name is entered.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </form>
        </div>
      )}
    </>
  );
};

// Subpage component for editing Profile in details
interface EditProfileViewProps {
  profile: Profile;
  onSave: (id: string, name: string, path: string, enabled: boolean, coverUrl?: string | null) => void;
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
  
  // Separate search state
  const [searchTerm, setSearchTerm] = useState(profile.name);
  const [searchResults, setSearchResults] = useState<CoverSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleSearchCovers = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchTerm.trim()) return;

    setSearching(true);
    setSearchError(null);
    try {
      const results: CoverSearchResult[] = await invoke("search_game_covers", { searchTerm: searchTerm.trim() });
      setSearchResults(results);
      if (results.length === 0) {
        setSearchError("No cover art matches found.");
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
      <header className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Edit Profile</h1>
          <p className="page-subtitle">Adjust folder settings and select custom cover artwork.</p>
        </div>
        <button className="btn btn-outline" onClick={onCancel}>
          <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          BACK TO PROFILES
        </button>
      </header>

      <div className="profile-form-grid">
        {/* Left Column: Details form & actions */}
        <div className="tech-card" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <span className="tech-card-title">PROFILE PROPERTIES</span>
          
          <div className="form-group">
            <label className="form-label">GAME PROFILE NAME</label>
            <input
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Game profile identifier"
            />
          </div>

          <div className="form-group">
            <label className="form-label">WATCH SAVE DIRECTORY</label>
            <div className="form-input-row">
              <input
                className="form-input"
                value={path}
                onChange={(e) => setPath(e.target.value)}
              />
              <button className="btn btn-outline" type="button" onClick={() => onBrowseDir(setPath)}>
                <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                </svg>
                BROWSE
              </button>
            </div>
          </div>

          {/* Large cover art background preview inside the edit card */}
          <div className="form-group">
            <label className="form-label">ACTIVE COVER BACKDROP PREVIEW</label>
            <div style={{
              height: "140px",
              borderRadius: "var(--radius-inner)",
              border: "1px solid var(--border-color-tech)",
              overflow: "hidden",
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: coverUrl ? `linear-gradient(rgba(22, 31, 32, 0.5), rgba(22, 31, 32, 0.8)), url(${coverUrl})` : "#030606",
              backgroundSize: "cover",
              backgroundPosition: "center"
            }}>
              {!coverUrl && (
                <span style={{ fontSize: "11px", color: "var(--color-gray)", opacity: 0.6, fontFamily: "var(--font-mono)" }}>NO COVER ART SELECTED</span>
              )}
              {coverUrl && (
                <button
                  type="button"
                  className="btn btn-danger"
                  style={{ position: "absolute", top: "8px", right: "8px", height: "24px", padding: "0 8px", fontSize: "10px" }}
                  onClick={() => setCoverUrl(null)}
                >
                  REMOVE ART
                </button>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
            <button
              className="btn btn-primary"
              style={{ flexGrow: 1 }}
              onClick={() => onSave(profile.id, name, path, profile.enabled, coverUrl)}
              disabled={!name.trim() || !path.trim()}
            >
              <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              SAVE PROFILE CHANGES
            </button>
          </div>
        </div>

        {/* Right Column: Cover Art Selection database */}
        <div className="tech-card" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <span className="tech-card-title">RESOLVE COVER ART FROM STORES</span>
          
          <form onSubmit={handleSearchCovers} className="form-input-row" style={{ marginBottom: "8px" }}>
            <input
              className="form-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Type game name to search..."
            />
            <button className="btn btn-outline" type="submit" disabled={searching || !searchTerm.trim()}>
              {searching ? (
                <>
                  <div className="loader-spinner"></div>
                  SEARCHING...
                </>
              ) : (
                <>
                  <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
                  </svg>
                  SEARCH STORES
                </>
              )}
            </button>
          </form>

          {searchError && (
            <div className="detection-banner detection-banner-error" style={{ margin: 0 }}>
              <span style={{ fontSize: "11px", fontFamily: "var(--font-mono)" }}>{searchError}</span>
            </div>
          )}

          {/* Results list */}
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            maxHeight: "320px",
            overflowY: "auto",
            paddingRight: "4px"
          }}>
            {searchResults.map((res, index) => {
              const isSelected = coverUrl === res.cover_url;
              return (
                <div 
                  key={index}
                  className={`provider-option-box ${isSelected ? "active" : ""}`}
                  style={{ margin: 0, padding: "12px", gap: "12px", minHeight: "80px", position: "relative" }}
                  onClick={() => setCoverUrl(res.cover_url)}
                >
                  <img 
                    src={res.cover_url} 
                    alt="Cover preview" 
                    style={{ width: "80px", height: "45px", objectFit: "cover", borderRadius: "var(--radius-inner)", border: "1px solid var(--border-color-tech)" }} 
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px", flexGrow: 1, overflow: "hidden" }}>
                    <span style={{ fontSize: "12px", fontWeight: "600", color: "var(--color-white)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={res.title}>
                      {res.title}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span className="badge" style={{ padding: "1px 6px", fontSize: "8px", background: "rgba(0, 242, 254, 0.1)", color: "var(--color-cyan)", border: "1px solid rgba(0, 242, 254, 0.2)" }}>
                        {res.source.toUpperCase()}
                      </span>
                      {name !== res.title && (
                        <button
                          type="button"
                          className="btn btn-outline"
                          style={{ height: "20px", padding: "0 6px", fontSize: "8px" }}
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
              <div style={{ textAlign: "center", padding: "40px 10px", color: "var(--color-gray)", opacity: 0.5, fontFamily: "var(--font-mono)", fontSize: "11px" }}>
                Enter search query above to browse cover art from Steam, GOG, & Epic Games Store databases.
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
