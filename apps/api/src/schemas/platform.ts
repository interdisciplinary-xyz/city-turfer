import { z } from '@hono/zod-openapi';

import { API_VERSION } from '../spec';

/** Platform: liveness. */

export const Health = z
  .object({
    status: z.literal('ok'),
    version: z.string().openapi({ example: API_VERSION }),
  })
  .openapi('Health');
