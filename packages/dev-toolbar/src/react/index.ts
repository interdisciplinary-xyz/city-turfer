/**
 * `@interdisciplinary/dev-toolbar/react` — the local-development toolbar with its API
 * logger (live requests + route map).
 *
 * Render it only from a development-only branch that the production build
 * eliminates (see the host app's layout), gated by `shouldRenderDevToolbar()`
 * from `@interdisciplinary/dev-toolbar/next`: a development build AND a request the
 * dev server marked as coming from this machine (`./node/local-client.js`).
 * Nothing here reaches production users.
 *
 * Everything app-specific — the user, brand label, locales, links, storage
 * prefix, language switcher, host-app switches — is a prop; see `DevToolbarProps`.
 */
export { DevToolbar } from './components/dev-toolbar';
export type {
  DevToolbarLink,
  DevToolbarProps,
  DevToolbarSwitch,
  DevToolbarUser,
} from './components/dev-toolbar/dev-toolbar.constants';
