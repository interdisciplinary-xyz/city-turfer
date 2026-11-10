// The domain's React-free entry: constants, types and pure functions. Safe in server code, node
// tests and small client modules, where the barrel (index.ts) would bring every component.
// Other domains may import it as '@/domains/ui/logic' (docs/decisions/web-domains-2026-11-10.md).
export * from './components/language-switcher/language-switcher.constants';
export * from './components/motion-boot/motion-boot.constants';
export * from './components/page-loader/page-loader.constants';
