import { type RouteSvgProps, TYPE_TOKEN } from './route-svg.constants';

/**
 * A route's shape as inline SVG (H1: no basemap, no tiles): recorded segments solid in the type's
 * brand colour, the parts between them dashed, a dot at the start and a ring at the finish. Strokes
 * keep their width at any size. Nothing moves (no animation).
 */
export function RouteSvg({ shape, type, dot, label, className }: RouteSvgProps) {
  if (!shape) {
    return null;
  }
  return (
    <svg
      className={['portal-route', `portal-type-${TYPE_TOKEN[type]}`, className].filter(Boolean).join(' ')}
      viewBox={`0 0 ${shape.width} ${shape.height}`}
      preserveAspectRatio='xMidYMid meet'
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable='false'
    >
      {shape.gaps ? <path className='portal-route-gap' d={shape.gaps} /> : null}
      {shape.track ? <path className='portal-route-track' d={shape.track} /> : null}
      {shape.end ? <circle className='portal-route-end' cx={shape.end.x} cy={shape.end.y} r={dot} /> : null}
      {shape.start ? <circle className='portal-route-start' cx={shape.start.x} cy={shape.start.y} r={dot} /> : null}
    </svg>
  );
}
