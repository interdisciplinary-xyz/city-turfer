import './marketing-icon.css';

import { ICON_GRID, ICON_PATHS, ICON_STROKE, type IconProps } from './marketing-icon.constants';

/**
 * One outline icon from the marketing set, inline SVG in `currentColor`. Decorative by default
 * (`aria-hidden`); give it a `title` when it carries meaning on its own (`role='img'` + `aria-label`,
 * no `<title>` element, so screen readers announce it once). Colour comes from the
 * caller: `.icon-disc` (+ `-walk` / `-run` / `-ride`) or any `color` set through a token.
 */
export function Icon({ name, size = 24, title, className }: IconProps) {
  const label = title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true as const };
  return (
    <svg
      className={className ? `icon ${className}` : 'icon'}
      width={size}
      height={size}
      viewBox={`0 0 ${ICON_GRID} ${ICON_GRID}`}
      fill='none'
      stroke='currentColor'
      strokeWidth={ICON_STROKE}
      strokeLinecap='round'
      strokeLinejoin='round'
      focusable='false'
      {...label}
    >
      {ICON_PATHS[name].map((shape) => (
        <path
          key={shape.d}
          d={shape.d}
          fill={shape.filled ? 'currentColor' : undefined}
          stroke={shape.filled ? 'none' : undefined}
        />
      ))}
    </svg>
  );
}
