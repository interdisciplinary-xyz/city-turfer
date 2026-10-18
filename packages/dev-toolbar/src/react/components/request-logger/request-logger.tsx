'use client';

import { Activity, ChevronDown, ChevronUp } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useRouteCoverage } from '../../hooks/use-route-coverage';
import type { RouteCoverageFilter } from '../../utils/route-coverage';
import { LiveRequestControls } from './components/live-request-controls';
import { LiveRequestList } from './components/live-request-list';
import { RouteMapControls } from './components/route-map-controls';
import { RouteMapList } from './components/route-map-list';
import { useLiveRequests } from './hooks/use-live-requests';
import {
  DEV_TOOLBAR_ROW_HEIGHT_PX,
  REQUEST_LOGGER_VIEWS,
  type RequestLoggerPrefs,
  type RequestLogScope,
  type RequestLogSourceFilter,
} from './request-logger.constants';
import { readRequestLoggerPrefs, writeRequestLoggerPrefs } from './request-logger.utils';

/**
 * The dev toolbar's second row: the API logger. Two views —
 *
 *   - **Live requests**: this document's browser `fetch`/XHR merged with the
 *     Node server's own outgoing requests (SSR fetches, API routes calling
 *     OpenAI/Stripe/…, via `@interdisciplinary/dev-toolbar/node`'s `request-log.js`), with per-page
 *     totals and ×n flags on repeated calls.
 *   - **Route map**: every visit and request folded into a run persisted in
 *     localStorage — X/Y routes visited and what each one requested.
 *
 * The row carries the view's filters, totals and actions; the chevron opens
 * its detailed list above the toolbar. Payload's local API and Mongo
 * queries are not HTTP and don't appear.
 *
 * Mounted only client-side (DevToolbar renders nothing until it has checked
 * the hostname), so reading localStorage in the initializer is SSR-safe.
 */
export const RequestLogger = () => {
  const [prefs, setPrefs] = useState<RequestLoggerPrefs>(readRequestLoggerPrefs);
  const [scope, setScope] = useState<RequestLogScope>('page');
  const [source, setSource] = useState<RequestLogSourceFilter>('all');
  const [routeFilter, setRouteFilter] = useState<RouteCoverageFilter>('all');

  const live = useLiveRequests(scope, source);
  const routes = useRouteCoverage(routeFilter);

  useEffect(() => {
    writeRequestLoggerPrefs(prefs);
  }, [prefs]);

  const { view, listOpen } = prefs;

  return (
    <>
      <div
        role='group'
        aria-label='API logger'
        style={{ height: DEV_TOOLBAR_ROW_HEIGHT_PX }}
        className='flex items-center gap-[12px] whitespace-nowrap border-t border-white/10 px-[12px]'
      >
        <span className='flex shrink-0 items-center gap-[6px] font-semibold text-white'>
          <Activity className='size-[12px]' />
          API
        </span>
        {REQUEST_LOGGER_VIEWS.map((option) => (
          <button
            key={option.value}
            type='button'
            onClick={() =>
              // The route map IS its list — open it with the tab.
              setPrefs((p) => ({
                view: option.value,
                listOpen: option.value === 'routes' ? true : p.listOpen,
              }))
            }
            aria-pressed={view === option.value}
            className={`shrink-0 ${
              view === option.value
                ? 'rounded bg-white/15 px-[6px] py-[1px] font-semibold text-white'
                : 'px-[6px] py-[1px] hover:text-white'
            }`}
          >
            {option.label}
          </button>
        ))}
        <span className='text-white/20'>|</span>

        <div className='flex min-w-0 flex-1 items-center gap-[12px] overflow-x-auto'>
          {view === 'routes' ? (
            <RouteMapControls model={routes} filter={routeFilter} onFilterChange={setRouteFilter} />
          ) : (
            <LiveRequestControls
              scope={scope}
              onScopeChange={setScope}
              source={source}
              onSourceChange={setSource}
              pathname={live.pathname}
              visible={live.visible}
              summary={live.summary}
            />
          )}
        </div>

        <button
          type='button'
          onClick={() => setPrefs((p) => ({ ...p, listOpen: !p.listOpen }))}
          aria-expanded={listOpen}
          aria-controls='dev-request-log'
          className='flex shrink-0 items-center gap-[4px] hover:text-white'
        >
          {listOpen ? <ChevronDown className='size-[14px]' /> : <ChevronUp className='size-[14px]' />}
          {listOpen ? 'Hide list' : 'Show list'}
        </button>
      </div>

      {listOpen && (
        <div
          id='dev-request-log'
          role='region'
          aria-label={view === 'routes' ? 'Route map' : 'Request log'}
          style={{ bottom: DEV_TOOLBAR_ROW_HEIGHT_PX * 2 }}
          className='fixed inset-x-0 max-h-[55vh] overflow-auto border-t border-white/10 bg-neutral-950/95 font-mono text-[11px] text-white/70 shadow-[0_-8px_24px_rgba(0,0,0,0.3)] backdrop-blur'
        >
          {view === 'routes' ? (
            <RouteMapList model={routes} />
          ) : (
            <LiveRequestList visible={live.visible} duplicates={live.duplicates} scope={scope} />
          )}
        </div>
      )}
    </>
  );
};
