/** `live` = this document's request log; `routes` = the persisted route map. */
export type RequestLoggerView = 'live' | 'routes';

export const REQUEST_LOGGER_VIEWS: ReadonlyArray<{
  value: RequestLoggerView;
  label: string;
}> = [
  { value: 'live', label: 'Live requests' },
  { value: 'routes', label: 'Route map' },
];

/** `page` = only requests caused by the current pathname; `all` = session-wide. */
export type RequestLogScope = 'page' | 'all';

export type RequestLogSourceFilter = 'all' | 'browser' | 'server';

export type RequestLogSummary = {
  count: number;
  errors: number;
  /** Requests beyond the first for each identical method + URL + source. */
  duplicates: number;
  /** Sum of known response sizes. */
  totalBytes: number;
  /** Requests whose size could not be determined (not counted in `totalBytes`). */
  unknownSize: number;
  slowestMs: number | null;
};

export const REQUEST_LOG_SCOPES: ReadonlyArray<{
  value: RequestLogScope;
  label: string;
}> = [
  { value: 'page', label: 'This page' },
  { value: 'all', label: 'All pages' },
];

export const REQUEST_LOG_SOURCE_FILTERS: ReadonlyArray<{
  value: RequestLogSourceFilter;
  label: string;
}> = [
  { value: 'all', label: 'All' },
  { value: 'browser', label: 'Browser' },
  { value: 'server', label: 'Server' },
];

/** Remembered across reloads (route-map testing is full-reload heavy). */
export type RequestLoggerPrefs = {
  view: RequestLoggerView;
  listOpen: boolean;
};

export const DEFAULT_REQUEST_LOGGER_PREFS: RequestLoggerPrefs = {
  view: 'live',
  listOpen: false,
};

/** Height of each toolbar row; the list panel sits above both. */
export const DEV_TOOLBAR_ROW_HEIGHT_PX = 36;
