import { z } from '@hono/zod-openapi';

import { ActivityDetail, Track } from './activities';
import { User } from './identity';
import { City } from './territory';

/** GDPR: everything the server holds about the user, and its erasure. */

export const DataExport = z
  .object({
    exportedAt: z.string().datetime(),
    user: User,
    homeCity: City.nullable(),
    activities: z.array(ActivityDetail.extend({ track: Track })),
  })
  .openapi('DataExport');
