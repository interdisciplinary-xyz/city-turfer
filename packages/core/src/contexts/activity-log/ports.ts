// Activity Log's adapter SPI (@cityturfer/core/activity-log/ports): the repository port and the
// aggregate its adapters rehydrate. Only this context's adapters, test doubles and composition
// roots import it; everything else uses the public API (@cityturfer/core/activity-log).
export { Activity, type ActivityState } from './domain/activity';
export type { ActivityRepository, ActivityTimeRange } from './domain/activity-repository';
export { estimatedTotals, type GapRoute } from './domain/gap-route';
