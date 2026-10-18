import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

export interface OracleStats {
  type: 'walk' | 'run' | 'cycle';
  points: number;
  rejected: number;
  rawDistanceM: number;
  distanceM: number;
  elapsedS: number;
  movingS: number;
  elevGainM: number;
  elevLossM: number;
  splits: { km: number; seconds: number }[];
}

const root = join(__dirname, '../..');

/** Reference stats from the independent oracle (tools/route-stats.mjs --json), never from app code. */
export function oracleStats(fixture: string): OracleStats {
  const out = execFileSync(
    'node',
    [join(root, 'tools/route-stats.mjs'), join(root, 'tools/fixtures', fixture), '--json'],
    { encoding: 'utf8' }
  );
  return JSON.parse(out) as OracleStats;
}
