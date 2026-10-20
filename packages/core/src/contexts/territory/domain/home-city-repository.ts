import type { DomainEvent } from '../../../shared-kernel';

/** Stores which catalogue city is the user's Home City (per user: one database per user). */
export interface HomeCityRepository {
  /** The chosen city's catalogue id, or null if none was chosen. */
  homeCityId(): Promise<string | null>;
  /** Atomic: saves the choice (null clears it) and appends the event to the outbox. */
  saveHomeCity(cityId: string | null, event: DomainEvent, now: number): Promise<void>;
}
