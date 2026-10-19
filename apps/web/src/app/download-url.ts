/**
 * Public URL of the Android APK (Vercel Blob, uploaded by `pnpm -C apps/mobile run android:publish`).
 * Set NEXT_PUBLIC_ANDROID_APK_URL on Vercel (and in apps/web/.env.local to preview locally). While it
 * is unset, the page shows no download button.
 */
export const ANDROID_APK_URL = process.env.NEXT_PUBLIC_ANDROID_APK_URL || null;
