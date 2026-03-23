use tokio::sync::Mutex;
use crate::{auth::AuthClient, sheets::SheetsClient, drive::DriveClient, models::AppConfig};

pub struct AppState {
    pub auth:   Mutex<Option<AuthClient>>,
    pub sheets: Mutex<Option<SheetsClient>>,
    pub drive:  Mutex<Option<DriveClient>>,
    pub config: Mutex<AppConfig>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            auth:   Mutex::new(None),
            sheets: Mutex::new(None),
            drive:  Mutex::new(None),
            config: Mutex::new(AppConfig::default()),
        }
    }
}

/// Helper: get initialized SheetsClient or error.
pub async fn get_sheets(state: &AppState) -> Result<SheetsClient, String> {
    let guard = state.sheets.lock().await;
    guard.clone().ok_or_else(|| "Google Sheets not initialized. Run setup first.".to_string())
}

/// Helper: get initialized DriveClient or error.
pub async fn get_drive(state: &AppState) -> Result<DriveClient, String> {
    let guard = state.drive.lock().await;
    guard.clone().ok_or_else(|| "Google Drive not initialized. Run setup first.".to_string())
}
