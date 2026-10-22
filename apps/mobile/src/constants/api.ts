/**
 * CityTurfer HTTP API (apps/api) used by Cloud Backup and email sign-in.
 *
 * Default: the API project's production domain on Vercel. A build can point elsewhere with
 * `EXPO_PUBLIC_API_URL` (empty counts as unset; read directly, so Expo inlines it at bundle time; changing it is an OTA
 * update, it is plain JS). A phone can override the backup server in Info › Developer tools for
 * local testing. Never put a token here: tokens live in expo-secure-store (the signed-in account's,
 * or a device token pasted in Developer tools).
 */
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://city-turfer-api.vercel.app';

/** Privacy policy version the backup consents refer to (PUT /v1/me/consents/{purpose}). */
export const CLOUD_BACKUP_POLICY_VERSION = '2026-10';

/** Request timeout; uploads of long tracks get the longer one. */
export const API_TIMEOUT_MS = 20_000;
export const API_UPLOAD_TIMEOUT_MS = 60_000;
