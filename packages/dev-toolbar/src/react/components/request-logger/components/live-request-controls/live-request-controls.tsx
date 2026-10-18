import { ClipboardCopy, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { clearRequestLog } from '../../../../utils/request-log';
import { REQUEST_LOG_SCOPES, REQUEST_LOG_SOURCE_FILTERS } from '../../request-logger.constants';
import { formatBytes, formatDuration } from '../../request-logger.utils';
import type { LiveRequestControlsProps } from './live-request-controls.constants';

/** Toolbar-row controls for the live log: filters, totals, copy, clear. */
export const LiveRequestControls = ({
  scope,
  onScopeChange,
  source,
  onSourceChange,
  pathname,
  visible,
  summary,
}: LiveRequestControlsProps) => {
  const [copied, setCopied] = useState(false);

  const copyAsJson = () => {
    void navigator.clipboard?.writeText(JSON.stringify({ pathname, summary, requests: visible }, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <>
      {REQUEST_LOG_SCOPES.map((option) => (
        <button
          key={option.value}
          type='button'
          onClick={() => onScopeChange(option.value)}
          aria-pressed={scope === option.value}
          className={scope === option.value ? 'text-white underline underline-offset-4' : 'hover:text-white'}
        >
          {option.label}
        </button>
      ))}
      <span className='text-white/20'>|</span>
      {REQUEST_LOG_SOURCE_FILTERS.map((option) => (
        <button
          key={option.value}
          type='button'
          onClick={() => onSourceChange(option.value)}
          aria-pressed={source === option.value}
          className={source === option.value ? 'text-white underline underline-offset-4' : 'hover:text-white'}
        >
          {option.label}
        </button>
      ))}
      <span className='text-white/20'>|</span>
      <span className='text-white'>{summary.count} req</span>
      <span className={summary.duplicates ? 'text-amber-300' : ''}>{summary.duplicates} dup</span>
      <span title='Sum of known response sizes'>
        {formatBytes(summary.totalBytes)}
        {summary.unknownSize > 0 && ` (+${summary.unknownSize} ?)`}
      </span>
      {summary.slowestMs !== null && <span>max {formatDuration(summary.slowestMs)}</span>}
      {summary.errors > 0 && <span className='text-red-400'>{summary.errors} err</span>}
      <button
        type='button'
        onClick={copyAsJson}
        aria-label='Copy requests as JSON'
        title='Copy requests as JSON'
        className='flex items-center gap-[4px] hover:text-white'
      >
        <ClipboardCopy className='size-[12px]' />
        {copied && 'copied'}
      </button>
      <button
        type='button'
        onClick={clearRequestLog}
        aria-label='Clear request log'
        title='Clear request log'
        className='hover:text-white'
      >
        <Trash2 className='size-[12px]' />
      </button>
    </>
  );
};
