import type { RequestLogEntry } from '../../../../utils/request-log';
import type { RequestLogScope, RequestLogSourceFilter, RequestLogSummary } from '../../request-logger.constants';

export type LiveRequestControlsProps = {
  scope: RequestLogScope;
  onScopeChange: (scope: RequestLogScope) => void;
  source: RequestLogSourceFilter;
  onSourceChange: (source: RequestLogSourceFilter) => void;
  pathname: string;
  visible: readonly RequestLogEntry[];
  summary: RequestLogSummary;
};
