use chrono::Utc;
use tauri::State;
use uuid::Uuid;
use crate::{
    db,
    models::{Member, MemberInput},
    state::{with_db, AppState},
};

#[tauri::command]
pub fn get_members(state: State<'_, AppState>) -> Result<Vec<Member>, String> {
    with_db(&state, db::list_members)
}

#[tauri::command]
pub fn add_member(state: State<'_, AppState>, data: MemberInput) -> Result<String, String> {
    let now = Utc::now().to_rfc3339();
    let id = Uuid::new_v4().to_string();
    let member = Member {
        id: id.clone(),
        name: data.name,
        phone: data.phone,
        email: data.email,
        categories: data.categories,
        belts: data.belts,
        service_dates: data.service_dates,
        join_date: data.join_date,
        status: data.status,
        custom_fee: data.custom_fee,
        notes: data.notes,
        created_at: now.clone(),
        updated_at: now,
    };
    with_db(&state, |conn| {
        db::insert_member(conn, &member)?;
        db::log_action(conn, "ADD", "members", &id, &member.name);
        Ok(())
    })?;
    state.mirror.mark_dirty();
    Ok(id)
}

#[tauri::command]
pub fn update_member(
    state: State<'_, AppState>,
    id: String,
    data: MemberInput,
) -> Result<(), String> {
    let now = Utc::now().to_rfc3339();
    with_db(&state, |conn| {
        db::update_member(conn, &id, &data, &now)?;
        db::log_action(conn, "UPDATE", "members", &id, &data.name);
        Ok(())
    })?;
    state.mirror.mark_dirty();
    Ok(())
}

#[tauri::command]
pub fn delete_member_cascade(state: State<'_, AppState>, id: String) -> Result<(), String> {
    with_db(&state, |conn| {
        db::delete_member_cascade(conn, &id)?;
        db::log_action(conn, "DELETE_CASCADE", "members", &id, "cascade delete");
        Ok(())
    })?;
    state.mirror.mark_dirty();
    Ok(())
}
