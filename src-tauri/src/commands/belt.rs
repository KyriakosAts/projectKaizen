use chrono::Utc;
use tauri::State;
use uuid::Uuid;
use crate::{
    db,
    models::{BeltEntry, BeltInput},
    state::{with_db, AppState},
};

#[tauri::command]
pub fn get_belt_history(state: State<'_, AppState>) -> Result<Vec<BeltEntry>, String> {
    with_db(&state, db::list_belt_history)
}

#[tauri::command]
pub fn add_belt_promotion(
    state: State<'_, AppState>,
    member_id: String,
    data: BeltInput,
) -> Result<String, String> {
    let id = Uuid::new_v4().to_string();
    let entry = BeltEntry {
        id: id.clone(),
        member_id,
        category: data.category,
        from_belt: data.from_belt,
        to_belt: data.to_belt,
        promoted_at: data.promoted_at,
        notes: data.notes,
        created_at: Utc::now().to_rfc3339(),
    };
    with_db(&state, |conn| db::insert_belt_entry(conn, &entry))?;
    state.mirror.mark_dirty();
    Ok(id)
}
