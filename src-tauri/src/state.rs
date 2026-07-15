use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Mutex;

use crate::mirror::MirrorHandle;

pub struct AppState {
    pub db: Mutex<Option<Connection>>,
    pub db_path: Mutex<Option<PathBuf>>,
    pub mirror: MirrorHandle,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            db: Mutex::new(None),
            db_path: Mutex::new(None),
            mirror: MirrorHandle::new(),
        }
    }
}

/// Run a closure against the open database connection.
pub fn with_db<T>(
    state: &AppState,
    f: impl FnOnce(&Connection) -> Result<T, String>,
) -> Result<T, String> {
    let guard = state.db.lock().map_err(|_| "Database lock poisoned".to_string())?;
    let conn = guard
        .as_ref()
        .ok_or_else(|| "Database not initialized. Restart the app.".to_string())?;
    f(conn)
}

/// Same as `with_db` but with a mutable connection (needed for transactions).
pub fn with_db_mut<T>(
    state: &AppState,
    f: impl FnOnce(&mut Connection) -> Result<T, String>,
) -> Result<T, String> {
    let mut guard = state.db.lock().map_err(|_| "Database lock poisoned".to_string())?;
    let conn = guard
        .as_mut()
        .ok_or_else(|| "Database not initialized. Restart the app.".to_string())?;
    f(conn)
}
