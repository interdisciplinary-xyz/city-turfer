import type { HomeCityRepository } from '@cityturfer/core/territory/ports';

import type { Database } from '@/platform/database';
import { appendToOutbox } from '@/platform/outbox';
import type { DomainEvent } from '@/shared-kernel';

import type { HomeCityChoice } from '../contract';

/** Table ter_home_city (migration 7): one row, the chosen catalogue id. */
export class SqliteHomeCityRepository implements HomeCityRepository {
  constructor(private readonly db: Database) {}

  async homeCityId(): Promise<string | null> {
    const r = await this.db.first<{ city_id: string | null }>('SELECT city_id FROM ter_home_city WHERE id = 1');
    return r?.city_id ?? null;
  }

  async homeCityChoice(): Promise<HomeCityChoice | null> {
    const r = await this.db.first<{ city_id: string | null; chosen_at: number }>(
      'SELECT city_id, chosen_at FROM ter_home_city WHERE id = 1'
    );
    return r ? { cityId: r.city_id, chosenAt: r.chosen_at } : null;
  }

  async saveHomeCity(cityId: string | null, event: DomainEvent, now: number): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.run(
        `INSERT INTO ter_home_city (id, city_id, chosen_at) VALUES (1, ?, ?)
         ON CONFLICT(id) DO UPDATE SET city_id = excluded.city_id, chosen_at = excluded.chosen_at`,
        [cityId, now]
      );
      await appendToOutbox(tx, [event], now);
    });
  }
}
