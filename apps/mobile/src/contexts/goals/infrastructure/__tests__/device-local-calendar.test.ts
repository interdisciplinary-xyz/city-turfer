/**
 * The device calendar across DST changes. Jest cannot switch the time zone of its own process, so
 * the adapter runs in a child Node process with TZ set (Node ≥ 22.6 strips its type-only imports).
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';

import { goalDays } from '../../domain/daily-goal';
import type { LocalCalendar } from '../../domain/local-calendar';
import { deviceLocalCalendar } from '../device-local-calendar';

const ADAPTER = path.resolve(__dirname, '../device-local-calendar.ts');
const HOUR = 3_600_000;

interface Probe {
  dayOf: Record<string, string>;
  startOf: Record<string, number>;
  addDays: Record<string, string>;
}

/** Runs the adapter in `tz` for the given inputs and returns its answers. */
function inZone(tz: string, input: { instants: number[]; days: string[]; steps: [string, number][] }): Probe {
  const script = `
    const { deviceLocalCalendar: c } = await import(${JSON.stringify(ADAPTER)});
    const input = ${JSON.stringify(input)};
    const out = { dayOf: {}, startOf: {}, addDays: {} };
    for (const ms of input.instants) out.dayOf[ms] = c.dayOf(ms);
    for (const d of input.days) out.startOf[d] = c.startOf(d);
    for (const [d, n] of input.steps) out.addDays[d + '|' + n] = c.addDays(d, n);
    process.stdout.write(JSON.stringify(out));
  `;
  const stdout = execFileSync(
    process.execPath,
    ['--experimental-strip-types', '--no-warnings', '--input-type=module', '-e', script],
    { env: { ...process.env, TZ: tz }, encoding: 'utf8' }
  );
  return JSON.parse(stdout) as Probe;
}

/** A LocalCalendar answering from the child's results (fails on anything it was not asked). */
const recorded = (p: Probe): LocalCalendar => ({
  dayOf: (ms) => p.dayOf[ms] ?? fail(`dayOf ${ms}`),
  startOf: (d) => p.startOf[d] ?? fail(`startOf ${d}`),
  addDays: (d, n) => p.addDays[`${d}|${n}`] ?? fail(`addDays ${d} ${n}`),
});
const fail = (what: string): never => {
  throw new Error(`not probed: ${what}`);
};

describe('deviceLocalCalendar under DST (Europe/Warsaw)', () => {
  // Spring forward: Sunday 2026-03-29, 02:00 CET → 03:00 CEST (a 23-hour day).
  // Fall back: Sunday 2026-10-25, 03:00 CEST → 02:00 CET (a 25-hour day).
  const springWeek = ['2026-03-26', '2026-03-27', '2026-03-28', '2026-03-29', '2026-03-30', '2026-03-31', '2026-04-01'];
  const fallWeek = ['2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28'];
  const walkStart = Date.parse('2026-03-28T22:40:00Z'); // 23:40 CET on the Saturday before
  const afterJump = Date.parse('2026-03-29T22:30:00Z'); // 00:30 CEST on Monday 30th
  const probe = inZone('Europe/Warsaw', {
    instants: [walkStart, afterJump, Date.parse('2026-10-24T22:30:00Z'), Date.parse('2026-10-25T22:30:00Z')],
    days: [...springWeek, '2026-04-02', ...fallWeek, '2026-10-29'],
    steps: [
      ...springWeek.map((_, i) => ['2026-04-01', i - 6] as [string, number]),
      ['2026-04-01', 1],
      ...fallWeek.map((_, i) => ['2026-10-28', i - 6] as [string, number]),
      ['2026-10-28', 1],
      ['2026-12-31', 1],
      ['2026-03-01', -1],
    ],
  });

  it('starts days at local midnight, 23 h and 25 h long on the change days', () => {
    expect(probe.startOf['2026-03-29']).toBe(Date.parse('2026-03-28T23:00:00Z'));
    expect(probe.startOf['2026-03-30']).toBe(Date.parse('2026-03-29T22:00:00Z'));
    expect(probe.startOf['2026-03-30'] - probe.startOf['2026-03-29']).toBe(23 * HOUR);
    expect(probe.startOf['2026-10-26'] - probe.startOf['2026-10-25']).toBe(25 * HOUR);
  });

  it('steps whole calendar days across the change and month and year ends', () => {
    expect(springWeek.map((_, i) => probe.addDays[`2026-04-01|${i - 6}`])).toEqual(springWeek);
    expect(fallWeek.map((_, i) => probe.addDays[`2026-10-28|${i - 6}`])).toEqual(fallWeek);
    expect(probe.addDays['2026-12-31|1']).toBe('2027-01-01');
    expect(probe.addDays['2026-03-01|-1']).toBe('2026-02-28');
  });

  it('puts instants on their local day', () => {
    expect(probe.dayOf[walkStart]).toBe('2026-03-28');
    expect(probe.dayOf[afterJump]).toBe('2026-03-30');
    expect(probe.dayOf[Date.parse('2026-10-24T22:30:00Z')]).toBe('2026-10-25'); // 00:30 CEST
    expect(probe.dayOf[Date.parse('2026-10-25T22:30:00Z')]).toBe('2026-10-25'); // 23:30 CET
  });

  it('builds the DST week of the Daily goal: 7 days, a 23:40 walk on its start day', () => {
    const week = goalDays(
      [
        { startedAt: walkStart, movingS: 40 * 60 },
        { startedAt: afterJump, movingS: 600 },
      ],
      [{ effectiveFrom: '2026-03-01', minutes: 30, setAt: 0 }],
      recorded(probe),
      '2026-04-01'
    );
    expect(week.map((d) => d.day)).toEqual(springWeek);
    expect(week.map((d) => d.movingS)).toEqual([0, 0, 2400, 0, 600, 0, 0]);
    expect(week.map((d) => d.met)).toEqual([false, false, true, false, false, false, false]);
  });
});

describe('deviceLocalCalendar in this process', () => {
  it('round-trips a day through startOf and dayOf', () => {
    for (const day of ['2026-01-01', '2026-03-29', '2026-10-25', '2026-12-31']) {
      expect(deviceLocalCalendar.dayOf(deviceLocalCalendar.startOf(day))).toBe(day);
      expect(deviceLocalCalendar.dayOf(deviceLocalCalendar.startOf(day) - 1)).toBe(
        deviceLocalCalendar.addDays(day, -1)
      );
    }
  });
});
