use chrono::Utc;
use tauri::State;
use uuid::Uuid;
use crate::{
    db,
    models::MemberNote,
    state::{with_db, AppState},
};

#[tauri::command]
pub fn get_member_notes(state: State<'_, AppState>) -> Result<Vec<MemberNote>, String> {
    with_db(&state, db::list_member_notes)
}

#[tauri::command]
pub fn add_member_note(
    state: State<'_, AppState>,
    member_id: String,
    text: String,
) -> Result<String, String> {
    let id = Uuid::new_v4().to_string();
    let note = MemberNote {
        id: id.clone(),
        member_id,
        text,
        created_at: Utc::now().to_rfc3339(),
    };
    with_db(&state, |conn| db::insert_member_note(conn, &note))?;
    state.mirror.mark_dirty();
    Ok(id)
}

#[tauri::command]
pub fn delete_member_note(state: State<'_, AppState>, note_id: String) -> Result<(), String> {
    with_db(&state, |conn| db::delete_member_note(conn, &note_id))?;
    state.mirror.mark_dirty();
    Ok(())
}
