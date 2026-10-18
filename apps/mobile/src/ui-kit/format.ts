import { type ActivityType, usesPace } from '@/shared-kernel';

export function formatDistance(m: number): { value: string; unit: string } {
  if (m < 1000) {
    return { value: String(Math.round(m)), unit: 'm' };
  }
  return { value: (m / 1000).toFixed(m < 100_000 ? 2 : 1), unit: 'km' };
}
export const distanceText = (m: number) => {
  const d = formatDistance(m);
  return `${d.value} ${d.unit}`;
};

export function formatDuration(s: number): string {
  const sec = Math.max(0, Math.round(s));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const r = sec % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
    : `${m}:${String(r).padStart(2, '0')}`;
}

/** Pace (min/km) for walk/run, speed (km/h) for cycle. */
export function formatPaceOrSpeed(
  type: ActivityType,
  distanceM: number,
  seconds: number
): { value: string; unit: string } {
  if (usesPace(type)) {
    if (distanceM < 50 || seconds <= 0) {
      return { value: '—', unit: '/km' };
    }
    const pace = seconds / (distanceM / 1000);
    if (pace > 60 * 60) {
      return { value: '—', unit: '/km' };
    }
    return { value: formatDuration(pace), unit: '/km' };
  }
  if (seconds <= 0) {
    return { value: '—', unit: 'km/h' };
  }
  return { value: ((distanceM / seconds) * 3.6).toFixed(1), unit: 'km/h' };
}

export function formatSpeedNow(type: ActivityType, mps: number | null): { value: string; unit: string } {
  if (mps == null || mps <= 0.2) {
    return { value: '—', unit: usesPace(type) ? '/km' : 'km/h' };
  }
  return formatPaceOrSpeed(type, mps * 1000, 1000);
}

/** Locale-independent: thousands separators read as decimals in some locales (e.g. pl "37.495 m²"). */
export const formatArea = (km2: number) => (km2 >= 0.01 ? `${km2.toFixed(2)} km²` : `${Math.round(km2 * 1e6)} m²`);

export function formatDate(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
