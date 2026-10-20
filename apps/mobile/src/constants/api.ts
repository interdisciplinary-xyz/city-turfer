/**
 * CityTurfer HTTP API (apps/api) used by Cloud Backup.
 *
 * PLACEHOLDER: the preview deployment of scope/v0.8.0. Set this to the deployed API URL before a
 * release (an OTA update is enough: it is plain JS). A phone can override it in Info › Cloud backup
 * for local testing. Never put a token here: the device token is pasted in the app and kept in
 * expo-secure-store.
 */
export const API_BASE_URL = 'https://city-turfer-api-git-scope-v080-micha-dopieralskis-projects.vercel.app';

/** Privacy policy version the backup consents refer to (PUT /v1/me/consents/{purpose}). */
export const CLOUD_BACKUP_POLICY_VERSION = '2026-10';

/** Request timeout; uploads of long tracks get the longer one. */
export const API_TIMEOUT_MS = 20_000;
export const API_UPLOAD_TIMEOUT_MS = 60_000;
