// The domain's React-free entry: constants, types and pure functions. Safe in server code, node
// tests and small client modules, where the barrel (index.ts) would bring every component.
// Other domains may import it as '@/domains/waitlist/logic' (docs/decisions/web-domains-2026-11-10.md).
export * from './components/waitlist-form/waitlist-form.constants';
export * from './waitlist-config';
