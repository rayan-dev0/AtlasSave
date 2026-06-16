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
│   ├── App.css                     # Stitch Cyber-Minimalist Theme styles
│   ├── main.tsx                    # React app entry point
│   └── assets/                     # Frontend media assets
├── legacy-python/                  # Reference backup of the original Python code
└── AGENTS.md                       # This guidelines document
```

---

## 🧠 Coding Philosophy: Smart Code vs. Boring Code

We prioritize **Boring Code** over "Smart Code." In an AI-driven codebase, boring code compiles faster, is easier to modify, has fewer hidden side effects, and is highly readable.

| Concept | ❌ Smart Code (Avoid) | Key Reasons |
| :--- | :--- | :--- |
| **Rust Macros** | Writing custom procedural macros or complex declarative macros. | Hard for search indexes and compiler linters to parse; obfuscates execution flows. |
| **State Management** | Importing Redux, Zustand, or MobX for basic UI state routing. | Introduces package bloat and boilerplate. React `useState` and context are cleaner. |
| **File Dialogs** | Binding JavaScript-based OS wrappers or Tauri frontend permissions. | Adds frontend configuration layers and potential security vulnerabilities. |
| **Async Operations** | Spawning raw threads or nesting blocking calls inside commands. | Leads to window lockups, UI freezing, and memory leaks. |

### ✅ Recommended "Boring" Equivalents:
* **Standard Pattern Matching**: Use simple `match` blocks and native `Option`/`Result` handling.
* **Rust Native File Dialogs**: Use the **`rfd`** crate inside Rust commands rather than configuring frontend plugins.
* **Tokio Tasks**: Use `tokio::spawn` and unbounded channels (`mpsc`) to isolate long-running or blocking filesystem/Git subprocess actions from the main UI thread.
* **Vanilla CSS Variables**: Build custom UI theme styling using CSS Custom Properties instead of overcomplicating with tailwind configurations.

---

## 🟢 Do's

* **Keep It Asynchronous**: Always execute backup archiving, file copying, and git syncs inside background Tokio tasks. Ensure the UI never freezes.
* **Suppress Windows Shell Flashes**: When launching `git` or other shell commands on Windows, always configure `.creation_flags(0x08000000)` (`CREATE_NO_WINDOW`) to prevent command prompt screens from popping up in front of the user's games.
* **Push Logs via Events**: Communicate background sync status to the UI by emitting events (`app_handle.emit("log-event", ...)`). Do not block commands returning long processes.
* **Use Inline SVGs**: Keep the frontend lightweight and build-ready. Avoid importing icon packages; use raw SVG elements inside React components.
* **Type-Safe Serialization**: Derive `Serialize` and `Deserialize` on all config structs in Rust, and map them to matching TypeScript interfaces in `App.tsx`.
* **Sanitize Inputs**: Always sanitize folder names and profile names before writing them to the Windows file system.

---

## 🔴 Don'ts

* **Don't Block Webview**: Never run blocking filesystem or network operations directly inside a Tauri command thread without spawning a task.
* **Don't Add Unnecessary NPM Packages**: Keep build sizes minimal. Do not add component libraries (like Radix, shadcn, or Material UI) unless explicitly requested.
* **Don't hardcode system paths**: Always resolve system directories (such as `AppData` or `Saved Games`) using cross-platform crates like `dirs` or `directories`.
* **Don't bypass the Debouncer**: Filesystem events trigger rapidly during game saves. Never trigger a ZIP generation immediately without routing it through the debouncer.
