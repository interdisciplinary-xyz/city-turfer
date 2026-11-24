import { distanceM } from '@/shared-kernel';

import { legLengthM, PlannedRoute } from '../planned-route';
import { MAX_WAYPOINTS, PLANNING_SPEED_MPS } from '../planned-route.constants';

// Synthetic points in Gdańsk (no real user data).
const A = { lat: 54.35, lon: 18.65 };
const B = { lat: 54.352, lon: 18.65 };
const C = { lat: 54.352, lon: 18.654 };
const D = { lat: 54.35, lon: 18.654 };

function route(...points: { lat: number; lon: number }[]) {
  const r = PlannedRoute.draft('walk', 0);
  points.forEach((p, i) => r.addWaypoint(p, i + 1));
  return r;
}

describe('PlannedRoute', () => {
  it('starts empty: no leg, no distance, not on Record', () => {
    const r = PlannedRoute.draft('run', 5);
    expect(r.toState()).toEqual({
      type: 'run',
      waypoints: [],
      legs: [],
      showOnRecord: false,
      createdAt: 5,
      updatedAt: 5,
    });
    expect(r.distanceM).toBe(0);
    expect(r.durationS).toBe(0);
    expect(r.line()).toEqual([]);
  });

  it('adds a straight leg from the second Waypoint on and returns its index to snap', () => {
    const r = PlannedRoute.draft('walk', 0);
    expect(r.addWaypoint(A, 1)).toEqual({ added: true, leg: null });
    expect(r.addWaypoint(B, 2)).toEqual({ added: true, leg: 0 });
    expect(r.addWaypoint(C, 3)).toEqual({ added: true, leg: 1 });
    expect(r.legs).toEqual([
      { path: [A, B], snapped: false },
      { path: [B, C], snapped: false },
    ]);
    expect(r.straightLegs()).toEqual([0, 1]);
    expect(r.updatedAt).toBe(3);
  });

  it('ignores a tap on the last Waypoint', () => {
    const r = route(A, B);
    expect(r.addWaypoint({ ...B }, 9)).toEqual({ added: false, leg: null });
    expect(r.waypoints).toHaveLength(2);
    expect(r.updatedAt).toBe(2);
  });

  it('rejects an invalid point and more than the maximum of Waypoints', () => {
    const r = PlannedRoute.draft('walk', 0);
    expect(() => r.addWaypoint({ lat: 91, lon: 0 }, 1)).toThrow('geo.invalid-latitude');
    for (let i = 0; i < MAX_WAYPOINTS; i++) {
      r.addWaypoint({ lat: 54.35 + i / 1000, lon: 18.65 }, i);
    }
    expect(() => r.addWaypoint(D, 99)).toThrow('planned-route.too-many-waypoints');
    expect(r.waypoints).toHaveLength(MAX_WAYPOINTS);
  });

  it('measures every leg as drawn (shared-kernel haversine) and times it at the type speed', () => {
    const r = route(A, B, C);
    const expected = distanceM(A, B) + distanceM(B, C);
    expect(r.distanceM).toBeCloseTo(expected, 9);
    expect(r.durationS).toBe(Math.round(expected / PLANNING_SPEED_MPS.walk));
    // A snapped leg counts along its path, not between its Waypoints.
    const via = { lat: 54.351, lon: 18.649 };
    expect(r.snapLeg(0, A, B, [A, via, B], 4)).toBe(true);
    expect(legLengthM(r.legs[0])).toBeCloseTo(distanceM(A, via) + distanceM(via, B), 9);
    expect(r.distanceM).toBeCloseTo(distanceM(A, via) + distanceM(via, B) + distanceM(B, C), 9);
  });

  it('undo removes the last Waypoint and its leg; below two it leaves the Record map', () => {
    const r = route(A, B, C);
    r.setShowOnRecord(true, 4);
    expect(r.removeLastWaypoint(5)).toBe(true);
    expect(r.legs).toHaveLength(1);
    expect(r.showOnRecord).toBe(true);
    expect(r.removeLastWaypoint(6)).toBe(true);
    expect(r.legs).toEqual([]);
    expect(r.showOnRecord).toBe(false);
    expect(r.removeLastWaypoint(7)).toBe(true);
    expect(r.removeLastWaypoint(8)).toBe(false);
  });

  it('clear removes every Waypoint but keeps the type', () => {
    const r = route(A, B);
    r.changeType('cycle', 3);
    r.setShowOnRecord(true, 4);
    expect(r.clear(5)).toBe(true);
    expect(r.toState()).toMatchObject({ type: 'cycle', waypoints: [], legs: [], showOnRecord: false, updatedAt: 5 });
    expect(r.clear(6)).toBe(false);
  });

  it('closes the loop with the first Waypoint once; needs two Waypoints', () => {
    expect(() => route(A).closeLoop(1)).toThrow('planned-route.loop-too-short');
    const r = route(A, B, C);
    expect(r.isLoop).toBe(false);
    expect(r.closeLoop(4)).toEqual({ added: true, leg: 2 });
    expect(r.waypoints).toEqual([A, B, C, A]);
    expect(r.isLoop).toBe(true);
    expect(r.closeLoop(5)).toEqual({ added: false, leg: null });
    expect(r.waypoints).toHaveLength(4);
  });

  it('out and back with two Waypoints is a loop too', () => {
    const r = route(A, B);
    expect(r.closeLoop(3)).toEqual({ added: true, leg: 1 });
    expect(r.isLoop).toBe(true);
  });

  it('keeps the legs between walk and run, draws them straight again for cycle', () => {
    const r = route(A, B, C);
    r.snapLeg(0, A, B, [A, D, B], 4);
    expect(r.changeType('run', 5)).toEqual([]);
    expect(r.legs[0].snapped).toBe(true);
    expect(r.changeType('cycle', 6)).toEqual([0, 1]);
    expect(r.legs).toEqual([
      { path: [A, B], snapped: false },
      { path: [B, C], snapped: false },
    ]);
    expect(r.durationS).toBe(Math.round(r.distanceM / PLANNING_SPEED_MPS.cycle));
    expect(r.changeType('cycle', 7)).toEqual([]);
    expect(r.updatedAt).toBe(6);
  });

  it('applies a snapped path only to the leg it was asked for', () => {
    const r = route(A, B, C);
    expect(r.snapLeg(1, A, B, [A, B], 4)).toBe(false); // leg 1 joins B and C
    expect(r.snapLeg(5, A, B, [A, B], 4)).toBe(false);
    expect(r.snapLeg(0, A, B, [A], 4)).toBe(false);
    r.removeLastWaypoint(5);
    expect(r.snapLeg(1, B, C, [B, C], 6)).toBe(false); // undone meanwhile
    expect(r.legs).toEqual([{ path: [A, B], snapped: false }]);
  });

  it('shows on Record only as a route (2+ Waypoints)', () => {
    expect(() => route(A).setShowOnRecord(true, 1)).toThrow('planned-route.too-short');
    const r = route(A, B);
    expect(r.setShowOnRecord(true, 3)).toBe(true);
    expect(r.setShowOnRecord(true, 4)).toBe(false);
    expect(r.setShowOnRecord(false, 5)).toBe(true);
  });

  it('scores every leg end to end', () => {
    const r = route(A, B, C);
    expect(r.line()).toEqual([A, B, B, C]);
  });

  it('rehydrates a stored state and refuses one whose legs do not join its Waypoints', () => {
    const state = route(A, B).toState();
    expect(PlannedRoute.rehydrate(state).toState()).toEqual(state);
    expect(() => PlannedRoute.rehydrate({ ...state, legs: [] })).toThrow('planned-route.corrupt');
    expect(() => PlannedRoute.rehydrate({ ...state, legs: [{ path: [A], snapped: true }] })).toThrow(
      'planned-route.corrupt'
    );
    expect(() => PlannedRoute.rehydrate({ ...state, waypoints: [A], legs: [], showOnRecord: true })).toThrow(
      'planned-route.corrupt'
    );
  });
});
