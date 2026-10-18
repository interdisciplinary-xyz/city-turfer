import { ArrowRight, Download, Play, RotateCcw, Square } from 'lucide-react';

import { useRouteAutoplayState } from '../../../../hooks/use-route-autoplay-state';
import { startRouteAutoplay, stopRouteAutoplay } from '../../../../utils/route-autoplay';
import { buildRouteMapExport, downloadJson, ROUTE_COVERAGE_FILTERS } from '../../../../utils/route-coverage';
import { getRouteMapStorageError, resetRouteMap, setPendingRouteNavigation } from '../../../../utils/route-map';
import type { RouteMapControlsProps } from './route-map-controls.constants';

/**
 * Toolbar-row controls for the route map: X/Y coverage, "Next unvisited",
 * filter, export, and "Clear output" (restarts the test run).
 */
export const RouteMapControls = ({ model, filter, onFilterChange }: RouteMapControlsProps) => {
  const { inventory, map, coverage, percent, nextUnvisited } = model;
  const autoplay = useRouteAutoplayState();

  const clearOutput = () => {
    if (window.confirm('Clear the route map and restart the test run?')) {
      resetRouteMap();
    }
  };

  const exportJson = () => {
    if (!map) {
      return;
    }
    const now = Date.now();
    const stamp = new Date(now).toISOString().slice(0, 19).replace(/:/g, '');
    downloadJson(`route-map-${stamp}.json`, buildRouteMapExport(map, coverage, now));
  };

  return (
    <>
      {inventory.status === 'ready' ? (
        <>
          <span className='text-white'>
            Routes{' '}
            <span className='font-semibold'>
              {coverage.visited}/{coverage.total}
            </span>{' '}
            <span className='text-white/40'>({percent}%)</span>
          </span>
          <span className='h-[4px] w-[80px] shrink-0 overflow-hidden rounded bg-white/10' aria-hidden>
            <span className='block h-full bg-emerald-400' style={{ width: `${percent}%` }} />
          </span>
          {autoplay.playing ? (
            <button
              type='button'
              onClick={stopRouteAutoplay}
              title='Stop after this page'
              className='flex items-center gap-[4px] rounded bg-red-500/20 px-[6px] py-[1px] text-red-300 hover:bg-red-500/30'
            >
              <Square className='size-[10px] fill-current' />
              Stop · {autoplay.attempted.length} opened
            </button>
          ) : (
            nextUnvisited && (
              <button
                type='button'
                onClick={startRouteAutoplay}
                title='Open every unvisited page in turn, waiting on each until its requests settle'
                className='flex items-center gap-[4px] rounded bg-emerald-500/20 px-[6px] py-[1px] text-emerald-300 hover:bg-emerald-500/30'
              >
                <Play className='size-[10px] fill-current' />
                Play
              </button>
            )
          )}
          {autoplay.playing ? (
            <span className='text-white/50'>waiting for the page to settle…</span>
          ) : nextUnvisited ? (
            <a
              href={nextUnvisited}
              onClick={() => setPendingRouteNavigation(nextUnvisited)}
              title={nextUnvisited}
              className='flex items-center gap-[4px] rounded bg-emerald-500/20 px-[6px] py-[1px] text-emerald-300 hover:bg-emerald-500/30'
            >
              Next unvisited
              <ArrowRight className='size-[12px]' />
            </a>
          ) : (
            <span className='text-emerald-300'>
              All pages visited
              {autoplay.finishedAt && ' (autoplay finished)'}
            </span>
          )}
          <span className='text-white/20'>|</span>
          {ROUTE_COVERAGE_FILTERS.map((option) => (
            <button
              key={option.value}
              type='button'
              onClick={() => onFilterChange(option.value)}
              aria-pressed={filter === option.value}
              className={filter === option.value ? 'text-white underline underline-offset-4' : 'hover:text-white'}
            >
              {option.label}
            </button>
          ))}
        </>
      ) : inventory.status === 'loading' ? (
        <span className='text-white/40'>Loading route inventory…</span>
      ) : (
        <span className='text-red-300' title={inventory.reason}>
          Route inventory unavailable: {inventory.reason}
        </span>
      )}
      <span className='text-white/20'>|</span>
      {map && (
        <span className='text-white/40' title={new Date(map.startedAt).toLocaleString([], { hour12: false })}>
          since {new Date(map.startedAt).toLocaleTimeString([], { hour12: false })}
        </span>
      )}
      {getRouteMapStorageError() && <span className='text-red-400'>localStorage full — not saving</span>}
      <button type='button' onClick={exportJson} className='flex items-center gap-[4px] hover:text-white'>
        <Download className='size-[12px]' />
        Export JSON
      </button>
      <button
        type='button'
        onClick={clearOutput}
        className='flex items-center gap-[4px] text-red-300 hover:text-red-200'
      >
        <RotateCcw className='size-[12px]' />
        Clear output
      </button>
    </>
  );
};
