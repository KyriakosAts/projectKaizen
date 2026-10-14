use serde::{Deserialize, Serialize};

// ─── App settings / setup ──────────────────────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub db_path: String,
    pub data_folder: String,
    pub backup_folder: String,
    pub last_backup: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetupResult {
    pub db_path: String,
    pub data_folder: String,
    pub backup_folder: String,
    pub created: bool,  // true = database newly created on this launch
    /// Non-fatal startup problems (unavailable data folder, failed auto-backup)
    pub warning: Option<String>,
}

// ─── BackupInfo ────────────────────────────────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupInfo {
    pub name: String,        // "dojo-backup-2026-07-15_14-30-00.json"
    pub date: String,        // "2026-07-15 14:30:00"
    pub local_path: Option<String>,
    pub size_bytes: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreResult {
    pub records: usize,
    pub safety_backup: String, // name of the pre-restore snapshot taken automatically
}
