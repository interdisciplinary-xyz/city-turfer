// The domain's React-free entry: constants, types and pure functions. Safe in server code, node
// tests and small client modules, where the barrel (index.ts) would bring every component.
// Other domains may import it as '@/domains/portal/logic' (docs/decisions/web-domains-2026-11-10.md).
export * from './components/error-message/error-message.constants';
export * from './components/notice/notice.constants';
export * from './components/portal-frame/portal-frame.constants';
export * from './components/portal-header/portal-header.constants';
export * from './components/portal-nav/portal-nav.constants';
export * from './components/session-gate/session-gate.constants';
export * from './components/sign-out-button/sign-out-button.constants';
export * from './components/unreachable/unreachable.constants';
export * from './utils/backup-state';
export * from './utils/format';
