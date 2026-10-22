import { z } from '@hono/zod-openapi';

import { API_VERSION } from '../spec';

/** Platform: liveness. */

export const Health = z
  .object({
    status: z.literal('ok'),
    version: z.string().openapi({ description: 'Version of the API contract.', example: API_VERSION }),
    coreVersion: z.string().openapi({
      description: 'Version of `@cityturfer/core` the server computes summaries with.',
      example: '0.9.0',
    }),
    database: z.enum(['ok', 'unreachable', 'not-configured']).openapi({
      description:
        'Whether the database answers a trivial query (no details). Live data routes answer 503 unless `ok`.',
      example: 'ok',
    }),
  })
  .openapi('Health');
