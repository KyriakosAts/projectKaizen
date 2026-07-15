# Dojo Patras — Setup Guide

## Architecture

The app runs as a **Tauri v2 desktop application**. All data lives in a **local SQLite database** on the PC — no cloud account, no API keys, no internet required.

```
React UI → Tauri commands (Rust) → SQLite (dojo.db)
                                      ├─→ Excel mirror (dojo-patras-database.xlsx, auto-updated)
                                      └─→ JSON snapshots (backups/, daily + manual, restorable in-app)
```

- **SQLite** is the single source of truth. Writes are transactional; deleting a member removes all their payments/attendance/history atomically.
- **Excel mirror**: a human-readable `.xlsx` copy of the whole database, rewritten automatically a couple of seconds after any change. Open it anytime — it's read-only from the app's point of view, so editing it never touches the real data.
- **Backups**: a timestamped JSON snapshot is written automatically on the first launch of each day (30 kept), plus on demand via *Export → Backups → Backup Now*. Any snapshot can be restored in-app; a safety snapshot of the current data is always taken first.

---

## Prerequisites

- **Node.js** 18+ — https://nodejs.org
- **Rust** toolchain — https://rustup.rs/
- **Microsoft C++ Build Tools** (Windows) — required by Tauri
  (`winget install Microsoft.VisualStudio.2022.BuildTools` from an **elevated** terminal, with the *Desktop development with C++* workload)

---

## Install & Run

```bash
npm install

# Development (with hot reload)
npm run tauri:dev

# Production build
npm run tauri:build
```

No configuration files or environment variables are needed. On first launch the app automatically:

1. Creates the database at `{AppData}/com.dojopatras.app/dojo.db`
2. Creates the visible data folder `{Documents}/Dojo Patras` with:
   - `dojo-patras-database.xlsx` — the live Excel mirror
   - `backups/` — daily + manual JSON snapshots

---

## Keeping backups off the PC (recommended)

In **Settings → Database & Backups** you can move the data folder anywhere — point it at a
**OneDrive / Google Drive desktop folder** (or a USB stick) and every mirror update and backup
automatically leaves the machine. If the PC dies, the data survives.

---

## Migrating data from the old Google Sheets version

Use **Settings → Import Data**. Either paste AI-transformed JSON (prompts are provided in the UI),
or export the old spreadsheet and run it through the *Import All* flow. Imports are fast — everything
is written locally.

---

## Restore from a backup

**Export button (top bar) → Backups tab** — pick any snapshot and click *Restore*.
The current data is snapshotted first (`pre-restore-…json`), so a restore can itself be undone.

---

## Build Output

```
src-tauri/target/release/bundle/msi/Dojo Patras_1.0.0_x64_en-US.msi
```

GitHub Actions (`.github/workflows/build.yml`) builds the installer on every push to `main` —
no secrets required anymore.

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| "Database not initialized" | Restart the app; check `{AppData}/com.dojopatras.app` is writable |
| Excel mirror not updating | Close the file in Excel — the app retries automatically every few seconds |
| "Cannot replace Excel mirror" | Same as above: the file is locked while open in Excel |
| Restore fails | Make sure the `.json` file is inside the backup folder shown in Settings |
