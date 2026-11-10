import { fixed } from '@/ui-kit/format';

/**
 * A district's share of turf as a whole percent for the row's bar: "0%" with none, "<1%" for a
 * sliver (so some turf never reads as none), at most "100%". Digits come from `fixed`, not
 * Intl's percent style (Hermes' Intl is partial).
 */
export function shareText(share: number, locale?: string): string {
  if (!(share > 0)) {
    return '0%';
  }
  const pct = Math.min(100, share * 100);
  return pct < 1 ? '<1%' : `${fixed(Math.round(pct), 0, locale)}%`;
}

/** The bar's filled width in percent: some turf always shows a sliver (at least `min`). */
export function shareBarWidth(share: number, min: number): `${number}%` {
  if (!(share > 0)) {
    return '0%';
  }
  return `${Math.max(min, Math.min(100, share * 100))}%`;
}
