import type { DomainEvent } from '../../../shared-kernel';
import type { HomeCityChoice } from '../contract';

/** Stores which catalogue city is the user's Home City (per user: one database per user). */
export interface HomeCityRepository {
  /** The chosen city's catalogue id, or null if none was chosen. */
  homeCityId(): Promise<string | null>;
  /** The last choice (a cleared one has `cityId: null`) and when it was made; null if never chosen. */
  homeCityChoice(): Promise<HomeCityChoice | null>;
  /** Atomic: saves the choice (null clears it) made at `chosenAt` and appends the event to the outbox. */
  saveHomeCity(cityId: string | null, event: DomainEvent, chosenAt: number): Promise<void>;
}
