//! Google Drive API v3 wrapper.
//!
//! Handles: creating folders, sharing files/folders, uploading JSON backups,
//! and listing files within a folder.

use reqwest::Client;
use serde::Deserialize;
use serde_json::json;
use crate::auth::AuthClient;

const DRIVE_BASE:   &str = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD: &str = "https://www.googleapis.com/upload/drive/v3/files";

// ─── Response types ────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct FileResource {
    id: String,
    name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct FileList {
    files: Vec<FileResource>,
}

// ─── DriveClient ──────────────────────────────────────────────────────────────

#[derive(Clone)]
pub struct DriveClient {
    auth: AuthClient,
    http: Client,
}

impl DriveClient {
    pub fn new(auth: AuthClient) -> Self {
        Self {
            auth,
            http: Client::new(),
        }
    }

    /// Retrieve a fresh Bearer token string.
    async fn bearer(&self) -> Result<String, String> {
        self.auth.access_token().await
    }

    // ─── CREATE FOLDER ───────────────────────────────────────────────────────

    /// Create a Drive folder with the given name, optionally inside a parent folder.
    /// Returns the new folder ID.
    pub async fn create_folder(
        &self,
        name: &str,
        parent_id: Option<&str>,
    ) -> Result<String, String> {
        let mut metadata = json!({
            "name": name,
            "mimeType": "application/vnd.google-apps.folder"
        });
        if let Some(pid) = parent_id {
            metadata["parents"] = json!([pid]);
        }

        let resp = self.http
            .post(DRIVE_BASE)
            .bearer_auth(&self.bearer().await?)
            .json(&metadata)
            .send()
            .await
            .map_err(|e| format!("create_folder request failed: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(format!("create_folder error {}: {}", status, text));
        }

        let file: FileResource = resp
            .json()
            .await
            .map_err(|e| format!("create_folder parse error: {}", e))?;

        Ok(file.id)
    }

    // ─── FIND OR CREATE FOLDER ───────────────────────────────────────────────

    /// Return the ID of an existing top-level folder with the given name,
    /// or create it if it does not exist.
    pub async fn find_or_create_folder(&self, name: &str) -> Result<String, String> {
        let q = format!(
            "name='{}' and mimeType='application/vnd.google-apps.folder' and trashed=false",
            name
        );
        let url = format!(
            "{}?q={}&fields=files(id,name)",
            DRIVE_BASE,
            urlencoding::encode(&q)
        );

        let resp = self.http
            .get(&url)
            .bearer_auth(&self.bearer().await?)
            .send()
            .await
            .map_err(|e| format!("find_folder request failed: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(format!("find_folder error {}: {}", status, text));
        }

        let list: FileList = resp
            .json()
            .await
            .map_err(|e| format!("find_folder parse error: {}", e))?;

        if let Some(folder) = list.files.into_iter().next() {
            return Ok(folder.id);
        }

        // Folder not found — create it at the root level.
        self.create_folder(name, None).await
    }

    // ─── SHARE FILE / FOLDER ─────────────────────────────────────────────────

    /// Share a Drive file or folder with a specific email address, granting writer access.
    pub async fn share_with_email(&self, file_id: &str, email: &str) -> Result<(), String> {
        let url = format!("{}/{}/permissions", DRIVE_BASE, file_id);
        let body = json!({
            "type": "user",
            "role": "writer",
            "emailAddress": email
        });

        let resp = self.http
            .post(&url)
            .bearer_auth(&self.bearer().await?)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("share_with_email request failed: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(format!("share_with_email error {}: {}", status, text));
        }
        Ok(())
    }

    // ─── UPLOAD JSON BACKUP ──────────────────────────────────────────────────

    /// Upload a JSON string as a new file inside the specified Drive folder.
    /// Uses multipart upload so metadata and content are sent in one request.
    /// Returns the new file ID.
    pub async fn upload_json(
        &self,
        folder_id: &str,
        filename: &str,
        json_content: &str,
    ) -> Result<String, String> {
        let metadata = json!({
            "name": filename,
            "parents": [folder_id],
            "mimeType": "application/json"
        });

        let form = reqwest::multipart::Form::new()
            .part(
                "metadata",
                reqwest::multipart::Part::text(metadata.to_string())
                    .mime_str("application/json; charset=UTF-8")
                    .map_err(|e| format!("mime error: {}", e))?,
            )
            .part(
                "file",
                reqwest::multipart::Part::text(json_content.to_string())
                    .mime_str("application/json")
                    .map_err(|e| format!("mime error: {}", e))?,
            );

        let url = format!("{}?uploadType=multipart", DRIVE_UPLOAD);

        let resp = self.http
            .post(&url)
            .bearer_auth(&self.bearer().await?)
            .multipart(form)
            .send()
            .await
            .map_err(|e| format!("upload_json request failed: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(format!("upload_json error {}: {}", status, text));
        }

        let file: FileResource = resp
            .json()
            .await
            .map_err(|e| format!("upload_json parse error: {}", e))?;

        Ok(file.id)
    }

    // ─── LIST FILES IN FOLDER ────────────────────────────────────────────────

    /// List all JSON files inside a folder, ordered by name descending.
    /// Returns a Vec of (file_id, filename) tuples.
    pub async fn list_files_in_folder(
        &self,
        folder_id: &str,
    ) -> Result<Vec<(String, String)>, String> {
        let q = format!(
            "'{}' in parents and trashed=false and mimeType='application/json'",
            folder_id
        );
        let url = format!(
            "{}?q={}&fields=files(id,name)&orderBy=name+desc",
            DRIVE_BASE,
            urlencoding::encode(&q)
        );

        let resp = self.http
            .get(&url)
            .bearer_auth(&self.bearer().await?)
            .send()
            .await
            .map_err(|e| format!("list_files request failed: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(format!("list_files error {}: {}", status, text));
        }

        let list: FileList = resp
            .json()
            .await
            .map_err(|e| format!("list_files parse error: {}", e))?;

        Ok(list
            .files
            .into_iter()
            .map(|f| (f.id, f.name.unwrap_or_default()))
            .collect())
    }
}
