# 🤖 Agent Guidelines: AtlasSave (Tauri + React + Rust)

Welcome! If you are an AI agent or a developer working on **AtlasSave**, this document outlines the architecture, coding standards, and best practices required to maintain this project.

---

## 📂 Project Directory Structure

```
AtlasSave/
├── src-tauri/                      # Rust Backend Root
│   ├── Cargo.toml                  # Rust dependencies
│   ├── tauri.conf.json             # Tauri configuration (window sizes, tray settings)
│   ├── src/
│   │   ├── main.rs                 # Binary entry point
│   │   ├── lib.rs                  # Core Tauri setup, system tray, close-to-tray logic
│   │   ├── config.rs               # Serialized config manager (config.json loading/saving)
│   │   ├── commands.rs             # IPC command handlers exposed to React
│   │   ├── core/
│   │   │   ├── watcher.rs          # Directory change listener (notify crate)
│   │   │   ├── debouncer.rs        # Per-profile change debouncer (tokio timers)
│   │   │   ├── archiver.rs         # Recursive ZIP generation and backup rotation
│   │   │   └── uploader.rs         # Async queue for NAS copies and Git syncing
│   │   └── utils/
│   │       └── detector.rs         # Save folder auto-detection heuristics
├── src/                            # React Frontend Root
│   ├── App.tsx                     # Main application frame, views router, state
│   ├── App.css                     # Cyber-Minimalist Theme styles
│   ├── main.tsx                    # React app entry point
│   ├── types.ts                    # TypeScript shared interfaces
│   ├── libs/                       # Helper libraries (theme, styles)
│   │   ├── colors.ts
│   │   └── theme.ts
│   ├── components/                 # View panels & UI components
│   │   ├── Dashboard.tsx           # Dashboard view & logs panel
│   │   ├── GameProfiles.tsx        # Profile configs & Steam scans
│   │   ├── Providers.tsx           # Git & NAS targets config
│   │   ├── SaveTree.tsx            # Playthrough branching viewer
│   │   ├── Settings.tsx            # General preferences & API keys
│   │   ├── Onboarding.tsx          # First-run setup wizard
│   │   └── Icons.tsx               # Reusable tech SVG icons dictionary
│   └── assets/                     # Frontend media assets
├── legacy-python/                  # Reference backup of the original Python code
└── AGENTS.md                       # This guidelines document
```

---

## 🧠 Coding Philosophy: Smart Code vs. Boring Code

We prioritize **Boring Code** over "Smart Code." In an AI-driven codebase, boring code compiles faster, is easier to modify, has fewer hidden side effects, and is highly readable.

| Concept              | ❌ Smart Code (Avoid)                                               | Key Reasons                                                                         |
| :------------------- | :------------------------------------------------------------------ | :---------------------------------------------------------------------------------- |
| **Rust Macros**      | Writing custom procedural macros or complex declarative macros.     | Hard for search indexes and compiler linters to parse; obfuscates execution flows.  |
| **State Management** | Importing Redux, Zustand, or MobX for basic UI state routing.       | Introduces package bloat and boilerplate. React `useState` and context are cleaner. |
| **File Dialogs**     | Binding JavaScript-based OS wrappers or Tauri frontend permissions. | Adds frontend configuration layers and potential security vulnerabilities.          |
| **Async Operations** | Spawning raw threads or nesting blocking calls inside commands.     | Leads to window lockups, UI freezing, and memory leaks.                             |

### ✅ Recommended "Boring" Equivalents:

- **Standard Pattern Matching**: Use simple `match` blocks and native `Option`/`Result` handling.
- **Rust Native File Dialogs**: Use the **`rfd`** crate inside Rust commands rather than configuring frontend plugins.
- **Tokio Tasks**: Use `tokio::spawn` and unbounded channels (`mpsc`) to isolate long-running or blocking filesystem/Git subprocess actions from the main UI thread.
- **Tailwind CSS v4 & Theme Variables**: Build custom UI theme styling using Tailwind CSS v4, custom `@theme` properties, and utility classes instead of writing custom vanilla CSS rules.

---

## 🟢 Do's

- **Keep It Asynchronous**: Always execute backup archiving, file copying, and git syncs inside background Tokio tasks. Ensure the UI never freezes.
- **Suppress Windows Shell Flashes**: When launching `git` or other shell commands on Windows, always configure `.creation_flags(0x08000000)` (`CREATE_NO_WINDOW`) to prevent command prompt screens from popping up in front of the user's games.
- **Push Logs via Events**: Communicate background sync status to the UI by emitting events (`app_handle.emit("log-event", ...)`). Do not block commands returning long processes.
- **Use Inline SVGs**: Keep the frontend lightweight and build-ready. Avoid importing icon packages; use raw SVG elements inside React components.
- **Type-Safe Serialization**: Derive `Serialize` and `Deserialize` on all config structs in Rust, and map them to matching TypeScript interfaces in `App.tsx`.
- **Sanitize Inputs**: Always sanitize folder names and profile names before writing them to the Windows file system.

---

## 🔴 Don'ts

- **Don't Block Webview**: Never run blocking filesystem or network operations directly inside a Tauri command thread without spawning a task.
- **Don't Add Unnecessary NPM Packages**: Keep build sizes minimal. Do not add component libraries (like Radix, shadcn, or Material UI) unless explicitly requested.
- **Don't hardcode system paths**: Always resolve system directories (such as `AppData` or `Saved Games`) using cross-platform crates like `dirs` or `directories`.
- **Don't bypass the Debouncer**: Filesystem events trigger rapidly during game saves. Never trigger a ZIP generation immediately without routing it through the debouncer.

---

## 🟦 React Frontend Guidelines (Code Splitting, Quality, & Best Practices)

To ensure the frontend stays lightweight, type-safe, and highly performant, all React work must adhere to the following rules:

### 1. Code Splitting & View Organization

- **Split View Components**: Each main tab/view should be isolated in its own file under `src/components/` (e.g. `Dashboard.tsx`, `GameProfiles.tsx`, `Providers.tsx`, `SaveTree.tsx`, `Settings.tsx`).
- **De-bloat App.tsx**: `App.tsx` should only act as the routing shell and the provider of global configuration state. Do not put view-specific sub-states, modal forms, or localized event handlers directly in `App.tsx`. Co-locate view-specific logic inside the respective component file.
- **Component Sub-Splitting**: If a view component file exceeds **1,000 lines**, it must be split. Create a sub-folder under `src/components/` (e.g. `src/components/dashboard/`) and split it into smaller, co-located UI blocks (e.g. `LogsConsole.tsx`, `MetricsGrid.tsx`).

### 2. TypeScript & Code Quality Standards

- **Strict Typing**: Always declare TypeScript interfaces for component props and state variables. Avoid using `any` or loose, unsafely typed objects (`Record<string, any>`).
- **IPC Interface Mapping**: Every data structure returned by or sent to the Rust backend (e.g. `Config`, `Profile`, `CoverSearchResult`, `BackupInfo`) must have a corresponding TypeScript interface defined in `src/types.ts` that strictly mirrors the Rust struct model.
- **Prettier & ESLint Cleanliness**: Run standard syntax formatters (`bun run prettier` or equivalent editor tools) before committing code. Address compile warnings and lint errors immediately.

### 3. React State & Hook Best Practices

- **Stale State Protection**: When logging, buffering, or updating state based on previous values (especially inside event listener callbacks), always use the functional state update pattern to prevent capturing stale closure scopes:

  ```typescript
  // Good: Uses the latest state value
  setLogs((prev) => [...prev.slice(-150), nextLog]);

  // Bad: Captures a stale snapshot of logs
  setLogs([...logs, nextLog]);
  ```

- **Proper Hook Dependency Arrays**: Never leave dependency arrays empty or omit referenced state variables inside `useEffect` or `useCallback`. If a function or variable is referenced, it must be declared in the dependencies, or properly wrapped in `useMemo`/`useCallback`.
- **Custom IPC Hooks (Future Direction)**: Move raw Tauri `invoke` calls and side-effects out of components and encapsulate them in custom hooks or query wrappers (e.g. a custom hook for managing save profile operations) to decouple UI rendering from IPC communications.
- **Safe Event Listeners**: Always clean up event listeners returned by Tauri `listen` inside the cleanup return function of `useEffect`:
  ```typescript
  useEffect(() => {
    const unlisten = listen('log-event', (e) => { ... });
    return () => {
      unlisten.then((f) => f());
    };
  }, []);
  ```

### 4. IPC Call & UI Error Handling

- **Try-Catch Encapsulation**: Always wrap `invoke` calls inside `try-catch` blocks. Backend failures must be caught and handled gracefully:
  ```typescript
  try {
    await invoke('save_config', { newConfig });
  } catch (err) {
    appendLocalLog(`[ERROR] Save config failed: ${err}`);
    // Show user-friendly toast or banner warning
  }
  ```
- **Never crash the UI**: Never assume an IPC call will succeed. Always provide fallback UI states and write descriptive log warnings if a background communication fails.
