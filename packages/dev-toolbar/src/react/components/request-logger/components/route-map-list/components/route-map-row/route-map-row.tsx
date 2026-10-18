import { ChevronDown, ChevronRight } from 'lucide-react';

import { getDevToolbarConfig } from '../../../../../../utils/dev-toolbar-config';
import { isLocaleCookieRedirect, routeHref } from '../../../../../../utils/route-coverage';
import { setPendingRouteNavigation } from '../../../../../../utils/route-map';
import { formatBytes, formatStatus, sizeClassName, statusClassName } from '../../../../request-logger.utils';
import type { RouteMapRowProps } from './route-map-row.constants';

/**
 * One route in the route map: visited marker, a link to open it (a full
 * page load, so its SSR requests are measured from scratch), totals, and —
 * expanded — every distinct request made for each concrete path under it.
 */
export const RouteMapRow = ({ row, current, expanded, onToggle, inventoryReady }: RouteMapRowProps) => {
  const href = routeHref(row);
  const localeRedirect = isLocaleCookieRedirect(row, getDevToolbarConfig().localePrefixes);
  const redirectOnly = row.redirectsTo !== null && row.visits === 0;
  const marker = redirectOnly ? '↪' : row.visited ? '●' : row.paths.length ? '◐' : '○';
  const markerTitle = redirectOnly
    ? `Redirected to ${row.redirectsTo}`
    : row.visited
      ? 'Visited'
      : row.paths.length
        ? 'Only prefetched from another page'
        : 'Not visited yet';
  const expandable = row.paths.length > 0;

  return (
    <li className='border-b border-white/5'>
      <div
        className={`flex w-full items-center gap-[8px] px-[12px] py-[4px] hover:bg-white/5 ${current ? 'bg-white/10' : ''}`}
      >
        <button
          type='button'
          onClick={onToggle}
          disabled={!expandable}
          aria-expanded={expandable ? expanded : undefined}
          aria-label={`Requests for ${row.key}`}
          className='w-[12px] text-white/40 hover:text-white disabled:cursor-default'
        >
          {expandable &&
            (expanded ? <ChevronDown className='size-[12px]' /> : <ChevronRight className='size-[12px]' />)}
        </button>
        <span
          title={markerTitle}
          className={redirectOnly ? 'text-amber-300' : row.visited ? 'text-emerald-400' : 'text-white/30'}
        >
          {marker}
        </span>
        <span className={`min-w-0 flex-1 truncate ${row.visited ? 'text-white' : 'text-white/50'}`}>
          {href ? (
            <a
              href={href}
              onClick={() => setPendingRouteNavigation(href)}
              title={row.kind === 'pattern' ? `Open ${href}` : `Open ${row.key}`}
              className='hover:text-emerald-300 hover:underline'
            >
              {row.key}
            </a>
          ) : (
            <span title='Pattern route — open one real URL under it first (e.g. from the app) to get a link'>
              {row.key}
            </span>
          )}
          {row.kind === 'pattern' && <span className='ml-[6px] text-[10px] text-white/30'>pattern</span>}
          {row.redirectsTo && (
            <span className='ml-[6px] text-[10px] text-amber-300'>
              ↪ redirects to {row.redirectsTo}
              {localeRedirect && (
                <span
                  className='text-white/40'
                  title='The NEXT_LOCALE cookie sends default-locale URLs to the remembered locale. Switch the language to EN to visit this route.'
                >
                  {' '}
                  (locale cookie — switch to EN to test)
                </span>
              )}
            </span>
          )}
          {row.aliases.length > 0 && (
            <span className='ml-[6px] text-[10px] text-white/40' title='Same page, recorded under this route'>
              = {row.aliases.join(', ')}
            </span>
          )}
          {row.kind === 'unlisted' && inventoryReady && (
            <span className='ml-[6px] text-[10px] text-amber-300'>not in inventory</span>
          )}
          {current && <span className='ml-[6px] text-[10px] text-sky-300'>you are here</span>}
        </span>
        {row.paths.length > 0 && (
          <button
            type='button'
            onClick={onToggle}
            className='shrink-0 whitespace-nowrap text-white/50 hover:text-white'
          >
            {row.visits} visits · {row.uniqueRequests} req
            {row.totalCalls > row.uniqueRequests && (
              <span className='text-amber-300'> ({row.totalCalls} calls)</span>
            )} · <span className={sizeClassName(row.totalBytes || null)}>{formatBytes(row.totalBytes)}</span>
          </button>
        )}
      </div>

      {expanded && (
        <div className='bg-white/[0.02] pb-[6px] pl-[44px] pr-[12px]'>
          {row.paths.map((recorded) => (
            <div key={recorded.path} className='pt-[4px]'>
              {row.paths.length > 1 || recorded.path !== row.key ? (
                <div className='text-white/60'>
                  <a
                    href={recorded.path}
                    onClick={() => setPendingRouteNavigation(recorded.path)}
                    className='hover:text-emerald-300 hover:underline'
                  >
                    {recorded.path}
                  </a>{' '}
                  <span className='text-white/30'>({recorded.visits} visits)</span>
                </div>
              ) : null}
              {Object.values(recorded.requests).length === 0 ? (
                <div className='text-white/30'>No requests recorded.</div>
              ) : (
                <table className='w-full border-collapse'>
                  <tbody>
                    {Object.values(recorded.requests)
                      .sort((a, b) => a.key.localeCompare(b.key))
                      .map((request) => (
                        <tr key={request.key}>
                          <td
                            className={`w-[32px] py-[2px] text-[10px] uppercase ${request.source === 'server' ? 'text-sky-300' : 'text-white/40'}`}
                          >
                            {request.source === 'server' ? 'srv' : 'web'}
                          </td>
                          <td className='w-[48px] py-[2px] font-semibold text-white'>{request.method}</td>
                          <td className={`w-[40px] py-[2px] ${statusClassName(request.lastStatus)}`}>
                            {formatStatus(request.lastStatus)}
                          </td>
                          <td className='max-w-0 truncate py-[2px]'>
                            {request.count > 1 && (
                              <span className='mr-[6px] text-amber-300' title='Calls across all visits'>
                                ×{request.count}
                              </span>
                            )}
                            <span title={request.url}>{request.url}</span>
                            {request.via && request.via !== recorded.path && (
                              <span className='ml-[8px] text-white/30'>via {request.via}</span>
                            )}
                          </td>
                          <td
                            className={`w-[72px] whitespace-nowrap py-[2px] text-right ${sizeClassName(request.sizeBytes)}`}
                          >
                            {formatBytes(request.sizeBytes)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}
    </li>
  );
};
