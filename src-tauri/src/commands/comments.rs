use chrono::Utc;
use tauri::State;
use crate::{
    db,
    models::Comment,
    state::{with_db, AppState},
};

#[tauri::command]
pub fn get_comments(state: State<'_, AppState>) -> Result<Vec<Comment>, String> {
    with_db(&state, db::list_comments)
}

/// Create, update, or delete a comment for a (member_id, month) pair.
/// Empty text = delete. Non-empty = upsert.
#[tauri::command]
pub fn upsert_comment(
    state: State<'_, AppState>,
    member_id: String,
    month: String,
    text: String,
) -> Result<(), String> {
    let now = Utc::now().to_rfc3339();
    with_db(&state, |conn| db::upsert_comment(conn, &member_id, &month, &text, &now))?;
    state.mirror.mark_dirty();
    Ok(())
}
