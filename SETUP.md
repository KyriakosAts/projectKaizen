# Dojo Patras — Setup Guide

## Architecture

The app runs as a **Tauri v2 desktop application**. The React frontend communicates exclusively with the Rust backend via Tauri commands. The Rust backend handles all Google API authentication — no credentials are ever exposed to the browser.

```
React UI → Tauri commands (Rust) → Google Sheets API + Google Drive API
```

---

## Prerequisites

- **Node.js** 18+ — https://nodejs.org
- **Rust** toolchain — https://rustup.rs/
- **Microsoft C++ Build Tools** (Windows) — required by Tauri

```bash
# Install Rust on Windows: download rustup-init.exe from https://rustup.rs/ and run it
```

---

## Step 1 — Google Cloud Setup (one-time)

### 1.1 Create a Google Cloud Project
1. Go to https://console.cloud.google.com
2. Click **Select a project → New Project**, name it "Dojo Patras"

### 1.2 Enable Required APIs
Go to **APIs & Services → Library** and enable:
- ✅ **Google Sheets API**
- ✅ **Google Drive API**

### 1.3 Create a Service Account
1. Go to **IAM & Admin → Service Accounts**
2. Click **+ Create Service Account** → name it `dojo-patras-sa`
3. Skip project-level roles (click Continue, then Done)

### 1.4 Download the JSON Key
1. Click the service account → **Keys** tab → **Add Key → Create new key → JSON**
2. Save the downloaded file as **`service-account.json`** in the project root

---

## Step 2 — Configure the App

```bash
cp .env.example .env
```

Edit `.env`:
```
SERVICE_ACCOUNT_JSON=./service-account.json
PERSONAL_GMAIL=your.email@gmail.com
```

> ⚠️ `service-account.json` is in `.gitignore`. It is only read by the Rust backend — never exposed to the browser.

---

## Step 3 — Install & Run

```bash
npm install

# Development (with hot reload)
npm run tauri:dev

# Production build
npm run tauri:build
```

---

## First Launch — Auto-Setup

On the first run the app automatically:
1. Creates a Google Spreadsheet **"Dojo Patras"** with 10 tabs and headers
2. Creates a **"Dojo Patras Backups"** folder in Drive
3. Shares both with your `PERSONAL_GMAIL` as Editor
4. Saves the IDs to `{AppData}/dojo_config.json` — all subsequent launches skip setup

---

## Google Sheets Tab Reference

| Tab | Contents |
|-----|----------|
| Members | Member roster |
| Payments | Payment records |
| Attendance | Session logs |
| BeltHistory | Belt promotions |
| MemberNotes | Free-text notes |
| Comments | Month-level comments |
| Config_Services | JSON blob — service config |
| Config_Schedule | JSON blob — schedule + events |
| Config_Instructors | JSON blob — instructors |
| Logs | Audit trail |

---

## Backup Strategy

| Layer | When | Where |
|-------|------|-------|
| Google Sheets (live) | Real-time writes | Always current in Drive |
| Daily local snapshot | Each app startup | localStorage (3-day rolling) |
| Manual JSON export | On demand | Drive "Dojo Patras Backups" + `{AppData}/backups/` |

Trigger a backup: **Export button → JSON tab → Download .json**

---

## Build Output

```
src-tauri/target/release/bundle/msi/Dojo Patras_1.0.0_x64_en-US.msi
```

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| "Google Sheets not initialized" | Check `.env` path is correct and file exists |
| "Cannot read service account file" | Use absolute path in `SERVICE_ACCOUNT_JSON` |
| "Token exchange error 401" | Re-download key; verify Sheets + Drive APIs are enabled |
| Data not appearing in Sheets | Writes are batched — wait ~2 seconds |
