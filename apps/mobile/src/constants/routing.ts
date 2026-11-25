import type { ActivityTypeName } from './activity';

/**
 * FOSSGIS OpenStreetMap routing (OSRM), shared by Activity Log's gap estimates and Route Planning's
 * street snapping. A public service with a usage policy: identify the app, keep requests few, send
 * coordinates rounded to OSM_ROUTING_DECIMALS. Fine for the PoC; production needs its own router.
 */
export const OSM_ROUTING_BASE_URL = 'https://routing.openstreetmap.de';

/** The server's profile per activity type: walk and run share the footways. */
export const OSM_ROUTING_PROFILE: Record<ActivityTypeName, string> = {
  walk: 'routed-foot',
  run: 'routed-foot',
  cycle: 'routed-bike',
};

/** Where the usage policy can reach the project (User-Agent and Referer). */
export const OSM_ROUTING_PROJECT_URL = 'https://github.com/interdisciplinary-xyz/city-turfer';

/** 4 decimals of a degree: about 11 m of latitude. Enough to route, too coarse to pinpoint a door. */
export const OSM_ROUTING_DECIMALS = 4;

export const OSM_ROUTING_TIMEOUT_MS = 10_000;

/** The request headers the usage policy asks for: the app and its version, no personal data. */
export const osmRoutingHeaders = (appVersion: string): Record<string, string> => ({
  'User-Agent': `CityTurfer/${appVersion} (+${OSM_ROUTING_PROJECT_URL})`,
  Referer: OSM_ROUTING_PROJECT_URL,
  Accept: 'application/json',
});
