import {
  duplicateKey,
  formatBytes,
  formatClock,
  formatDuration,
  formatStatus,
  sizeClassName,
  statusClassName,
} from '../../request-logger.utils';
import type { LiveRequestListProps } from './live-request-list.constants';

/** The live log's request table, newest first. */
export const LiveRequestList = ({ visible, duplicates, scope }: LiveRequestListProps) => {
  if (visible.length === 0) {
    return (
      <p className='px-[12px] py-[16px] text-white/40'>
        No requests recorded{scope === 'page' ? ' for this page' : ''} yet.
      </p>
    );
  }

  return (
    <table className='w-full border-collapse'>
      <tbody>
        {[...visible].reverse().map((entry) => {
          const repeats = duplicates.get(duplicateKey(entry)) ?? 1;
          return (
            <tr key={entry.id} className='border-b border-white/5 hover:bg-white/5'>
              <td className='whitespace-nowrap px-[12px] py-[4px] text-white/40'>{formatClock(entry.startedAt)}</td>
              <td
                className={`px-[4px] py-[4px] text-[10px] uppercase ${entry.source === 'server' ? 'text-sky-300' : 'text-white/40'}`}
              >
                {entry.source === 'server' ? 'srv' : 'web'}
              </td>
              <td className='px-[8px] py-[4px] font-semibold text-white'>{entry.method}</td>
              <td className={`px-[8px] py-[4px] ${statusClassName(entry.status)}`}>{formatStatus(entry.status)}</td>
              <td className='w-full max-w-0 truncate px-[8px] py-[4px]'>
                {repeats > 1 && (
                  <span
                    className='mr-[6px] rounded bg-amber-400/20 px-[4px] text-amber-300'
                    title='Same request made more than once'
                  >
                    ×{repeats}
                  </span>
                )}
                <span title={entry.url}>{entry.url}</span>
                {entry.via && entry.via !== entry.page && (
                  <span className='ml-[8px] text-white/30'>via {entry.via}</span>
                )}
                {scope === 'all' && <span className='ml-[8px] text-white/30'>← {entry.page ?? 'background'}</span>}
              </td>
              <td className={`whitespace-nowrap px-[8px] py-[4px] text-right ${sizeClassName(entry.sizeBytes)}`}>
                {formatBytes(entry.sizeBytes)}
              </td>
              <td className='whitespace-nowrap px-[12px] py-[4px] text-right text-white/40'>
                {formatDuration(entry.durationMs)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};
