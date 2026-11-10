// The domain's React-free entry: constants, types and pure functions. Safe in server code, node
// tests and small client modules, where the barrel (index.ts) would bring every component.
// Other domains may import it as '@/domains/activities/logic' (docs/decisions/web-domains-2026-11-10.md).
export * from './components/activities-empty/activities-empty.constants';
export * from './components/activities-page/activities-page.constants';
export * from './components/activity-detail/activity-detail.constants';
export * from './components/activity-filter/activity-filter.constants';
export * from './components/activity-list/activity-list.constants';
export * from './components/activity-page/activity-page.constants';
export * from './components/activity-state/activity-state.constants';
export * from './components/activity-totals/activity-totals.constants';
export * from './components/route-svg/route-svg.constants';
export * from './utils/activity-numbers';
export * from './utils/activity-time';
export * from './utils/route-shape';
