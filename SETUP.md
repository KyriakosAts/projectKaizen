# Dojo Patras — Setup Guide

## Architecture

The app runs as a **Tauri v2 application** (Android tablet and Windows). All data lives in a **local SQLite database** on the device — no cloud account, no API keys, no internet required.

```
React UI (src/app) → business rules (src/data/model.js) → Tauri commands (Rust) → SQLite (dojo.db)
                                                                                 └─→ JSON snapshots (backups/)
```

- **SQLite** is a small document store: every record is a JSON document in `docs` (collection + id).
  The data model lives entirely in the frontend (`src/data`), so changing it never needs Rust changes.
- **Business rules** (payment coverage, member status, statistics, filters) live only in
  `src/data/model.js` and are covered by `npm test`.
- **Configuration** (groups, plans, prices, belts, warning/pause days, PIN, reminder text) is stored
  in the database and edited in the app — no rebuild needed.
- **Backups**: a timestamped JSON snapshot is written automatically on the first launch of each day
  (30 kept), plus on demand in *Ρυθμίσεις → Δεδομένα & αντίγραφα*. Any snapshot can be restored
  in-app; a safety snapshot of the current data is always taken first.
- **Excel**: exported on demand (whole gym or the current filtered list) and, optionally, every month
  on a chosen day, into the `exports/` folder.

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

npm test             # business-rule tests (no native toolchain needed)
npm run dev          # UI in a browser, data in localStorage (no Rust needed)
npm run tauri:dev    # full app with hot reload
npm run tauri:build  # production build
```

On first launch the app creates the database at `{AppData}/com.dojopatras.app/dojo.db` and the visible
data folder `{Documents}/Dojo Patras` with `backups/` and `exports/`.

**Upgrading from v2**: the old tables are migrated automatically on the first v3 launch. A full copy of
the old database is kept first as `backups/pre-v3-dojo.db`; the old tables themselves are not modified.
Backups made by v2 cannot be restored into v3.

---

## Keeping backups off the device (recommended)

- **Windows**: in *Ρυθμίσεις → Δεδομένα & αντίγραφα* point the data folder at a OneDrive / Google Drive
  desktop folder (or a USB stick).
- **Android**: share the newest `backups/*.json` via the Files app (long-press → Share → Gmail/Drive) —
  the app reminds you weekly.

---

## Build Output

```
src-tauri/target/release/bundle/msi/Dojo Patras_3.0.0_x64_en-US.msi   (Windows)
src-tauri/gen/android/app/build/outputs/apk/**/app-universal-*.apk    (Android)
```

GitHub Actions builds both on every push to `main` (and to `redesign` while v3 is being finished):
- `.github/workflows/build.yml` — Windows installer
- `.github/workflows/android.yml` — Android APK (aarch64), release-signed with the
  `ANDROID_KEYSTORE_B64` / `ANDROID_KEYSTORE_PASSWORD` / `ANDROID_KEY_ALIAS` secrets so every build
  installs over the previous one.

## Android (Lenovo TB-X304L and similar, API 24+)

- **Install**: enable "install unknown apps", update **Android System WebView** from the Play Store
  (the app needs Chromium 84+ and shows an update prompt otherwise), then open the APK.
- **Storage**: grant the Storage permission when asked, so backups and exports go to the public
  `Documents/Dojo Patras/` folder and **survive an uninstall**.
- **Keyboard**: the activity uses `adjustResize` (no edge-to-edge), so the page shrinks when the
  keyboard opens; forms keep their save button at the top.

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| "Database not initialized" | Restart the app; check `{AppData}/com.dojopatras.app` is writable |
| Restore fails | Make sure the `.json` file is inside the backup folder shown in Settings and was made by v3 |
| Reminder button does nothing | The member needs a phone number; WhatsApp/Viber must be installed |
