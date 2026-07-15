use serde::{Deserialize, Serialize};

// ─── Member ────────────────────────────────────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Member {
    pub id: String,
    pub name: String,
    pub phone: Option<String>,
    pub email: Option<String>,
    /// JSON string of Vec<String> (service IDs like ["judo", "bjj"])
    pub categories: String,
    /// JSON string of HashMap<String, String> ({judo: "blue", bjj: "purple"})
    pub belts: String,
    /// JSON string of HashMap<String, String> ({judo: "2024-01-15", bjj: "2024-06-01"})
    pub service_dates: String,
    pub join_date: String,
    pub status: String,       // "active" | "inactive"
    pub custom_fee: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

// ─── Payment ───────────────────────────────────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Payment {
    pub id: String,
    pub member_id: String,
    pub month: String,         // "2026-03"
    pub amount: String,
    pub status: String,        // "paid" | "unpaid"
    pub paid_at: Option<String>,
    pub note: Option<String>,
    pub created_at: String,
}

// ─── Attendance ────────────────────────────────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Attendance {
    pub id: String,
    pub member_id: String,
    pub date: String,          // "2026-03-15"
    pub session_type: String,  // service ID
    pub note: Option<String>,
    pub class_id: Option<String>,
    pub created_at: String,
}

// ─── BeltEntry ─────────────────────────────────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BeltEntry {
    pub id: String,
    pub member_id: String,
    pub category: String,
    pub from_belt: Option<String>,
    pub to_belt: String,
    pub promoted_at: String,
    pub notes: Option<String>,
    pub created_at: String,
}

// ─── MemberNote ────────────────────────────────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemberNote {
    pub id: String,
    pub member_id: String,
    pub text: String,
    pub created_at: String,
}

// ─── Comment ───────────────────────────────────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Comment {
    pub id: String,
    pub member_id: String,
    pub month: String,
    pub text: String,
    pub updated_at: String,
}

// ─── Input types (for adding new records) ──────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemberInput {
    pub name: String,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub categories: String,
    pub belts: String,
    pub service_dates: String,
    pub join_date: String,
    pub status: String,
    pub custom_fee: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PaymentInput {
    pub member_id: String,
    pub month: String,
    pub amount: String,
    pub status: String,
    pub paid_at: Option<String>,
    pub note: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AttendanceInput {
    pub member_id: String,
    pub date: String,
    pub session_type: String,
    pub note: Option<String>,
    pub class_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BeltInput {
    pub category: String,
    pub from_belt: Option<String>,
    pub to_belt: String,
    pub promoted_at: String,
    pub notes: Option<String>,
}

// ─── App settings / setup ──────────────────────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub db_path: String,
    pub mirror_path: String,
    pub backup_folder: String,
    pub last_backup: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetupResult {
    pub db_path: String,
    pub mirror_path: String,
    pub backup_folder: String,
    pub created: bool,  // true = database newly created on this launch
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
    pub members: usize,
    pub payments: usize,
    pub attendance: usize,
    pub belt_history: usize,
    pub member_notes: usize,
    pub comments: usize,
    pub safety_backup: String, // name of the pre-restore snapshot taken automatically
}

// ─── Excel mirror sheet names + headers ────────────────────────────────────────
pub const SHEET_MEMBERS:      &str = "Members";
pub const SHEET_PAYMENTS:     &str = "Payments";
pub const SHEET_ATTENDANCE:   &str = "Attendance";
pub const SHEET_BELT_HISTORY: &str = "BeltHistory";
pub const SHEET_MEMBER_NOTES: &str = "MemberNotes";
pub const SHEET_COMMENTS:     &str = "Comments";
pub const SHEET_CONFIG:       &str = "Config";

pub fn headers_for(sheet: &str) -> Vec<&'static str> {
    match sheet {
        SHEET_MEMBERS      => vec!["id","name","phone","email","categories","belts","serviceDates","joinDate","status","customFee","notes","createdAt","updatedAt"],
        SHEET_PAYMENTS     => vec!["id","memberId","month","amount","status","paidAt","note","createdAt"],
        SHEET_ATTENDANCE   => vec!["id","memberId","date","sessionType","note","classId","createdAt"],
        SHEET_BELT_HISTORY => vec!["id","memberId","category","fromBelt","toBelt","promotedAt","notes","createdAt"],
        SHEET_MEMBER_NOTES => vec!["id","memberId","text","createdAt"],
        SHEET_COMMENTS     => vec!["id","memberId","month","text","updatedAt"],
        SHEET_CONFIG       => vec!["key","json"],
        _                  => vec!["value"],
    }
}
