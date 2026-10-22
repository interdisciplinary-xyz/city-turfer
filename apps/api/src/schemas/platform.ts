import { z } from '@hono/zod-openapi';

import { API_VERSION } from '../spec';

/** Platform: liveness. */

export const Health = z
  .object({
    status: z.literal('ok'),
    version: z.string().openapi({ example: API_VERSION }),
    database: z.enum(['ok', 'unreachable', 'not-configured']).openapi({
      description:
        'Whether the database answers a trivial query (no details). Live data routes answer 503 unless `ok`.',
      example: 'ok',
    }),
  })
  .openapi('Health');
