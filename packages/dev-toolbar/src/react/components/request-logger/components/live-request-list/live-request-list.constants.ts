import type { RequestLogEntry } from '../../../../utils/request-log';
import type { RequestLogScope } from '../../request-logger.constants';

export type LiveRequestListProps = {
  visible: readonly RequestLogEntry[];
  duplicates: ReadonlyMap<string, number>;
  scope: RequestLogScope;
};
