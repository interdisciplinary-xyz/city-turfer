/**
 * WCAG 2.2 contrast between two colours (`brand-system` skill, Accessibility). Pure maths so the
 * brand tests, the brand-designer agent and any tool can check a colour pair the same way.
 */

/** Minimum ratios: body text, and large text (≥ 24 px, or ≥ 18.5 px bold) / icons / UI boundaries. */
export const MIN_CONTRAST = { text: 4.5, ui: 3 } as const;

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance of a `#RRGGBB` colour (0 = black, 1 = white). */
export function luminance(hex: string): number {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) {
    throw new Error(`Expected a #RRGGBB colour, got ${hex}`);
  }
  const [r, g, b] = [match[1], match[2], match[3]].map((part) => channel(parseInt(part, 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio between two colours, from 1 (identical) to 21 (black on white). */
export function contrastRatio(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}
