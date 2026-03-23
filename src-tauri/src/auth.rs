//! Google Service Account authentication.
//!
//! Generates RS256-signed JWTs from a service account JSON file,
//! exchanges them for OAuth2 access tokens, and caches tokens
//! for their 1-hour validity window.

use std::sync::Arc;
use tokio::sync::Mutex;
use chrono::Utc;
use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
use reqwest::Client;
use serde::{Deserialize, Serialize};

const GOOGLE_TOKEN_URL: &str = "https://oauth2.googleapis.com/token";
const GOOGLE_SCOPES: &str =
    "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive";

// ─── Service Account JSON structure ────────────────────────────────────────────
#[derive(Debug, Clone, Deserialize)]
pub struct ServiceAccountKey {
    pub client_email: String,
    pub private_key:  String,
    pub token_uri:    Option<String>,
}

// ─── JWT Claims ────────────────────────────────────────────────────────────────
#[derive(Debug, Serialize)]
struct JwtClaims {
    iss:   String,
    scope: String,
    aud:   String,
    exp:   i64,
    iat:   i64,
}

// ─── Token response ────────────────────────────────────────────────────────────
#[derive(Debug, Deserialize)]
struct TokenResponse {
    access_token: String,
    expires_in:   i64,
    #[allow(dead_code)]
    token_type:   String,
}

// ─── Cached token ──────────────────────────────────────────────────────────────
#[derive(Debug, Clone)]
struct CachedToken {
    access_token: String,
    expires_at:   i64,  // unix timestamp
}

// ─── Auth client ───────────────────────────────────────────────────────────────
#[derive(Debug, Clone)]
pub struct AuthClient {
    key:   ServiceAccountKey,
    cache: Arc<Mutex<Option<CachedToken>>>,
    http:  Client,
}

impl AuthClient {
    /// Load a service account key from a JSON file path.
    pub fn from_file(path: &str) -> Result<Self, String> {
        let raw = std::fs::read_to_string(path)
            .map_err(|e| format!("Cannot read service account file '{}': {}", path, e))?;
        Self::from_json_str(&raw)
    }

    /// Load a service account key from a JSON string (used for compile-time embedded credentials).
    pub fn from_json_str(json: &str) -> Result<Self, String> {
        let key: ServiceAccountKey = serde_json::from_str(json)
            .map_err(|e| format!("Invalid service account JSON: {}", e))?;
        Ok(Self {
            key,
            cache: Arc::new(Mutex::new(None)),
            http: Client::new(),
        })
    }

    /// Get a valid access token, using the cache if possible.
    pub async fn access_token(&self) -> Result<String, String> {
        let mut cache = self.cache.lock().await;
        let now = Utc::now().timestamp();

        // Return cached token if it has more than 60 seconds left
        if let Some(ref token) = *cache {
            if token.expires_at - now > 60 {
                return Ok(token.access_token.clone());
            }
        }

        // Generate a new JWT and exchange it
        let token = self.fetch_token().await?;
        *cache = Some(CachedToken {
            access_token: token.access_token.clone(),
            expires_at:   now + token.expires_in,
        });
        Ok(token.access_token)
    }

    async fn fetch_token(&self) -> Result<TokenResponse, String> {
        let now = Utc::now().timestamp();
        let claims = JwtClaims {
            iss:   self.key.client_email.clone(),
            scope: GOOGLE_SCOPES.to_string(),
            aud:   GOOGLE_TOKEN_URL.to_string(),
            iat:   now,
            exp:   now + 3600,
        };

        let header = Header::new(Algorithm::RS256);
        let encoding_key = EncodingKey::from_rsa_pem(self.key.private_key.as_bytes())
            .map_err(|e| format!("Invalid private key: {}", e))?;
        let jwt = encode(&header, &claims, &encoding_key)
            .map_err(|e| format!("JWT signing failed: {}", e))?;

        let params = [
            ("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer"),
            ("assertion",  &jwt),
        ];
        let resp = self.http
            .post(GOOGLE_TOKEN_URL)
            .form(&params)
            .send()
            .await
            .map_err(|e| format!("Token request failed: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("Token exchange error {}: {}", status, body));
        }

        resp.json::<TokenResponse>()
            .await
            .map_err(|e| format!("Token response parse error: {}", e))
    }
}
