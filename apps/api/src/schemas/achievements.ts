import { z } from '@hono/zod-openapi';

/** Achievements: evaluated from activity and turf facts, nothing stored. */

export const Achievement = z
  .object({
    id: z.string().openapi({ example: 'five-k' }),
    title: z.string().openapi({ example: '5K' }),
    description: z.string().openapi({ example: 'Run 5 km in one go.' }),
    unlocked: z.boolean().openapi({ example: true }),
    current: z.number().openapi({ example: 5.02 }),
    target: z.number().openapi({ example: 5 }),
  })
  .openapi('Achievement');

export const AchievementList = z.object({ items: z.array(Achievement) }).openapi('AchievementList');
