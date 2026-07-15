use chrono::Utc;
use tauri::State;
use uuid::Uuid;
use crate::{
    db,
    models::{Attendance, AttendanceInput},
    state::{with_db, AppState},
};

#[tauri::command]
pub fn get_attendance(state: State<'_, AppState>) -> Result<Vec<Attendance>, String> {
    with_db(&state, db::list_attendance)
}

#[tauri::command]
pub fn log_attendance(state: State<'_, AppState>, data: AttendanceInput) -> Result<String, String> {
    let id = Uuid::new_v4().to_string();
    let record = Attendance {
        id: id.clone(),
        member_id: data.member_id,
        date: data.date,
        session_type: data.session_type,
        note: data.note,
        class_id: data.class_id,
        created_at: Utc::now().to_rfc3339(),
    };
    with_db(&state, |conn| db::insert_attendance(conn, &record))?;
    state.mirror.mark_dirty();
    Ok(id)
}

#[tauri::command]
pub fn remove_attendance(state: State<'_, AppState>, id: String) -> Result<(), String> {
    with_db(&state, |conn| db::delete_attendance(conn, &id))?;
    state.mirror.mark_dirty();
    Ok(())
}
