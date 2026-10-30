import { fixed } from '@/ui-kit/format';

/**
 * An area for a screen reader: the number and its unit for a catalogue message that spells the
 * unit out ("3.5 square kilometres", "3,5 kilometra kwadratowego"). Same switch as `formatArea`
 * (square metres below 0.01 km²). `count` is the number the text shows, for the plural: whole
 * numbers stay whole ("2 square kilometres"), fractions take the fraction form.
 */
export function spokenArea(km2: number, locale?: string): { unit: 'km2' | 'm2'; count: number; text: string } {
  if (km2 < 0.01) {
    const m2 = Math.round(km2 * 1e6);
    return { unit: 'm2', count: m2, text: fixed(m2, 0, locale) };
  }
  const count = Math.round(km2 * 100) / 100;
  const two = count.toFixed(2);
  const digits = two.endsWith('00') ? 0 : two.endsWith('0') ? 1 : 2;
  return { unit: 'km2', count, text: fixed(count, digits, locale) };
}
