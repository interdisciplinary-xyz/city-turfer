import { useState } from 'react';

import { RouteMapRow } from './components/route-map-row';
import type { RouteMapListProps } from './route-map-list.constants';

/**
 * Every route to test — linked, so the list doubles as the test's
 * navigation — with what each one requested. Rows expand to their requests.
 */
export const RouteMapList = ({ model }: RouteMapListProps) => {
  const [expanded, setExpanded] = useState<string | null>(null);
  const inventoryReady = model.inventory.status === 'ready';

  if (model.rows.length === 0) {
    const { inventory } = model;
    return (
      <p className='px-[12px] py-[16px] text-white/40'>
        {inventory.status === 'ready'
          ? 'No routes match this filter.'
          : inventory.status === 'loading'
            ? 'Loading route inventory…'
            : `Route inventory unavailable (${inventory.reason}). Visited pages will still be listed here.`}
      </p>
    );
  }

  return (
    <ul>
      {model.rows.map((row) => (
        <RouteMapRow
          key={`${row.kind}:${row.key}`}
          row={row}
          current={row.key === model.currentKey}
          expanded={expanded === row.key}
          onToggle={() => setExpanded((prev) => (prev === row.key ? null : row.key))}
          inventoryReady={inventoryReady}
        />
      ))}
    </ul>
  );
};
