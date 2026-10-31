---
name: ddd-architecture
description: >-
  Use before writing or reviewing code in apps/mobile/src/ or packages/core/: where code belongs
  (core vs app, which context and layer), aggregates, use cases, ports, adapters, events, outbox,
  composition root, ubiquitous language, or when a dependency-cruiser rule fails.
---

# DDD architecture for CityTurfer

DDD is a **hard requirement** for this project. The design lives in `docs/poc-plan.md`, sections
2–5. This skill covers how to apply it in code.

## Where does this code go?

Contexts: Identity, Recording, Activity Log, Territory, Health Sync, Cloud Backup, Achievements,
plus the Shared Kernel (`CLAUDE.md` has the layout).

First, which package. **`packages/core` (`@cityturfer/core`)** holds what the phone and the server
both run: the shared kernel, the core constants (activity types, tracking thresholds, Earth radius,
`DETAIL_ZOOM`) and the `domain/` + `application/` + `contract.ts` + public `index.ts` of
**Territory, Activity Log, Achievements and Identity**, plus the H3 adapter
(`packages/core/src/h3/`, entry `@cityturfer/core/h3`) and the bundled District boundaries
(`packages/core/src/districts/`, entry `@cityturfer/core/districts`, the adapter of Territory's
`DistrictCatalog` port; OSM data, ODbL; app-only: the API and the website never load it, see the
`turf-territory` skill). **`apps/mobile`** keeps everything device-bound: Recording, Health Sync and
Cloud Backup (all layers), every adapter (SQLite repositories, Expo, OSM router, secure store),
`platform/` (SQLite, migrations, outbox), UI and wiring. Core is TS source with no React, Expo,
native module, UI package or `@/` import; its contexts use relative imports.

- **is a business rule or invariant ("can't resume a finished session", "drop fixes faster than 8
  m/s for a run")**: the context's `domain/`, **inside the aggregate** or a domain policy
  (`packages/core/src/contexts/<ctx>/domain/` for the four core contexts)
- **is pure maths on tracks or measures used by both contexts**: `packages/core/src/shared-kernel/`
  (the app's `@/shared-kernel` is a re-export shim)
- **orchestrates: load aggregate → call method → save → publish**: the context's `application/` (in
  core for the four core contexts). One class per use case; most contexts keep them together in
  `application/use-cases.ts`, larger ones split per file (e.g. Cloud Backup's `run-backup.ts`,
  `queue-changes.ts`)
- **talks to Expo, SQLite, the filesystem or the OS**: the context's `infrastructure/` (an adapter
  implementing a port)
- **is cross-cutting plumbing (db connection, migrations, outbox, dispatcher, jobs, diagnostics)**:
  `apps/mobile/src/platform/`
- **renders or holds UI state**: the context's `ui/` (hooks, components) and `apps/mobile/src/app/`
  (thin screens)
- **wires implementations to ports**: `apps/mobile/src/composition-root.ts` only

If a rule shows up as an `if` in a use case, a repository or a component, move it into the domain.

## Dependency rule (enforced)

Two configs, each run by its workspace's `arch` script (`pnpm test` runs `turbo run arch` for both).
Read the live file; don't copy rules into docs.

- **`apps/mobile/.dependency-cruiser.cjs`** (its patterns are relative to `apps/mobile`, so
  `^src/…`; tests under `__tests__/` and `test-support/` are exempt from the layer rules):
  - `domain-is-pure`: `apps/mobile/src/shared-kernel/` and each context's `domain/` import no React,
    React Native, `expo-*`, h3-js (nor core's H3 adapter), MapLibre, better-sqlite3,
    `@cityturfer/ui`, and nothing from `platform`, `composition-root`, `wiring`, `app`, `ui-kit` or
    another layer.
  - `application-no-infra-or-ui`: `application/` imports no React/Expo/h3/MapLibre/UI package (nor
    core's H3 adapter) and no `infrastructure`, `ui`, `composition-root`, `wiring`, `app` or
    `ui-kit`.
  - `contexts-only-via-public-api`: a context reaches another only through its `index.ts` /
    `contract.ts`.
  - `screens-use-ui-layer`: `apps/mobile/src/app/` never imports a context's domain, application,
    infrastructure, or `platform`.
  - `constants-are-leaf`: `apps/mobile/src/constants/` imports only other constants and
    `@cityturfer/brand`.
  - `core-via-entry-points`, `core-ports-for-own-adapters`, `core-ports-only-of-own-context`: see
    below.
  - `no-circular`.
- **`packages/core/.dependency-cruiser.cjs`** repeats the layer rules for core and adds
  `core-is-platform-free` (no React, Expo, native, UI packages or apps anywhere in core) and
  `h3-only-in-h3`. The app's config adds `core-via-entry-points` (only `@cityturfer/core/<entry>`,
  never files under `packages/core/src/` directly), `core-ports-for-own-adapters` and
  `core-ports-only-of-own-context` (`@cityturfer/core/<ctx>/ports` is for that context's
  `infrastructure/`, test doubles and the wiring).

Exceptions: the root `index.ts` imports the background task module (it sits outside
`apps/mobile/src/`, so depcruise doesn't cruise it), and `apps/mobile/src/composition-root.ts` /
`apps/mobile/src/wiring.ts` may import anything (no rule has them as a `from`). Don't relax the
rules. When you add a rule, prove it with a deliberately violating file, check that `arch` fails,
then delete the file.

## Patterns

### Value object: immutable, validated, compared by value

```ts
export class Distance {
  private constructor(readonly metres: number) {}
  static of(metres: number): Distance {
    if (!Number.isFinite(metres) || metres < 0)
      throw new DomainError('distance.invalid', `${metres}`);
    return new Distance(metres);
  }
  plus(o: Distance) {
    return Distance.of(this.metres + o.metres);
  }
  equals(o: Distance) {
    return this.metres === o.metres;
  }
}
```

### Aggregate: state stays private, commands enforce invariants and record events

Shape of `RecordingSession` (`apps/mobile/src/contexts/recording/domain/recording-session.ts`),
trimmed:

```ts
export class RecordingSession {
  private events: RecordingEvent[] = [];
  private constructor(private state: RecordingSessionState) {}

  static start(id: string, type: ActivityType, now: number): RecordingSession {
    const s = new RecordingSession({
      id,
      type,
      status: 'recording',
      startedAt: now,
      segment: 0,
      tail: null /* … */,
    });
    s.record({ type: 'SessionStarted', v: 1, at: now /* … */ });
    return s;
  }

  get profile() {
    return trackingProfileFor(this.state.type);
  }

  resume(now: number): void {
    if (this.state.status !== 'paused') throw new DomainError('session.not-paused');
    // A manual resume starts a new segment: never measure or draw across the pause.
    this.state = {
      ...this.state,
      status: 'recording',
      segment: this.state.segment + 1,
      tail: null,
    };
    this.record({
      type: 'SessionResumed',
      v: 1,
      at: now,
      sessionId: this.id,
      auto: false,
      segment: this.state.segment,
    });
  }

  ingestWithReport(fixes: readonly Fix[]): IngestReport {
    /* Fix Filter + gaps + auto-pause */
  }

  pullEvents(): RecordingEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }
  static rehydrate(state: RecordingSessionState) {
    return new RecordingSession(state);
  } // repository only
  toState(): Readonly<RecordingSessionState> {
    return this.state;
  } // repository only
  private record(e: RecordingEvent) {
    this.events.push(e);
  }
}
```

- Use no setters. Expose behaviour named in the ubiquitous language.
- Use the `DomainError(code, detail?)` type for rule violations. The UI maps `code` to user-facing
  copy.
- Aggregates reference other aggregates by id only.

### Repository port (domain) and use case (application)

```ts
// domain/recording-session-repository.ts
export interface RecordingSessionRepository {
  getActive(): Promise<RecordingSession | null>;
  /** Atomic: session state + new track points + domain events (outbox) in ONE transaction. */
  save(session: RecordingSession, newPoints: readonly TrackPoint[]): Promise<void>;
}

// application/use-cases.ts (trimmed)
export class IngestFixes {
  constructor(private readonly d: RecordingDeps) {}
  execute(fixes: readonly Fix[]): Promise<IngestResult> {
    return this.d.commands.run(() => this.run(fixes)); // Recording commands are serialised
  }
  private async run(fixes: readonly Fix[]): Promise<IngestResult> {
    const session = await this.d.sessions.getActive();
    if (!session) {
      await this.d.tracker.stop(); // orphaned tracker
      return { kind: 'no-active-session' };
    }
    const { points, ...report } = session.ingestWithReport(fixes);
    await this.d.sessions.save(session, points); // also writes pullEvents() to the outbox
    const snapshot = session.snapshot(this.d.clock.now());
    this.d.notifier.publish(snapshot);
    return {
      kind: 'ingested',
      accepted: points.length,
      report,
      status: session.status,
      snapshot /* … */,
    };
  }
}
```

Use cases return result objects instead of throwing for expected outcomes. They throw only for
programming errors. A use case never contains an `if` that encodes a business rule.

### Outbox and events

- `apps/mobile/src/platform/outbox.ts`: `appendToOutbox(tx, events, now)` writes to `sys_outbox`
  inside the repository's transaction.
- `EventDispatcher` (same file): handlers register with `dispatcher.on(type, handler)` in
  `apps/mobile/src/wiring.ts`; `dispatchPending()` reads unprocessed rows, calls the handlers and
  marks each row processed. A failing handler is retried with backoff (`OUTBOX_MAX_ATTEMPTS`,
  `OUTBOX_RETRY_BASE_MS`) and then dead-lettered, so it never blocks later events; `pruneOutbox`
  removes old rows. It runs after each commit (`afterCommit`) and on app start.
- Handlers are **idempotent**. For example, `RecordActivityFromSession` (core Activity Log) uses
  activity id = session id and returns early when that Activity already exists.
- Event payloads are the published language: plain JSON, versioned (`{ type, v: 1, … }`), and never
  containing entity objects.

### Anti-corruption layer

```ts
// recording/infrastructure/expo-location-tracker.ts — the only file that knows LocationObject
export const toFix = (l: Location.LocationObject): Fix => toFixOn(l, Platform.OS);
export function toFixOn(l: Location.LocationObject, os: typeof Platform.OS): Fix {
  // Android reports unknown speed/altitude as 0: map to null. iOS: negative speed = unknown.
  return {
    lat: l.coords.latitude,
    lon: l.coords.longitude,
    t: l.timestamp,
    accuracy: l.coords.accuracy ?? null,
    alt /* … */,
    speed /* … */,
  };
}
```

### Composition root (lazy, React-free, usable headless)

`apps/mobile/src/composition-root.ts` (Expo-bound) resolves the signed-in user and opens their
database; `apps/mobile/src/wiring.ts` (`wire(userId, db, adapters)`, platform-independent, also used
by integration tests with fakes) builds every context and registers the event handlers.

```ts
export async function getContainer(): Promise<Container | null> {
  const uid = await sessionStore.read();
  if (!uid) return null; // nobody signed in (rejects if it can't tell)
  if (current?.userId === uid) return current.promise;
  const db = await openExpoDatabase(`turftrack-${uid}.db`);
  await migrate(db);
  return wire(uid, db, adapters); // cached per user; diagnostics + maintenance omitted
}
```

Use no DI library: plain functions, constructed lazily. The background task and the UI's
`AppProvider` (`apps/mobile/src/ui-kit/app-context.tsx`) both call `getContainer()`, and both must
handle `null`.

### Context public API (`index.ts`) and adapter SPI (`ports.ts`)

Export only: the application API factory and its types, published event types, and (for `ui/`)
hooks. Never export domain classes or repositories. A core context also has `ports.ts`
(`@cityturfer/core/<ctx>/ports`): the repository/gateway ports and the aggregate its adapters
implement or rehydrate (e.g. `Claim`, `Activity`), imported only by that context's adapters in the
app. The app keeps `src/contexts/<ctx>/index.ts` (and `contract.ts`) as `export *` shims, so
`@/contexts/<ctx>` keeps working. Add a new core entry to `packages/core/package.json` `exports`.

## Testing per layer

- **Domain**: plain Jest with no mocks. Every invariant in `docs/poc-plan.md` §4 has a test. Pass
  time explicitly (`now: number` arguments, or a `{ now: () => t }` clock).
- **Application**: in-memory doubles, e.g. `InMemoryActivityRepository`
  (`packages/core/src/contexts/activity-log/test-support/`), `FakeHealthStore`
  (`apps/mobile/src/contexts/health-sync/test-support/`), the fake API server
  (`apps/mobile/src/contexts/cloud-backup/test-support/`); Recording use cases are tested through
  `wire('test', db, fakes)` with a fake tracker in `apps/mobile/src/__tests__/` (end-to-end,
  headless-resilience, recording-concurrency).
- **Infrastructure**: real SQL through `openNodeDatabase()`
  (`apps/mobile/src/test-support/node-database.ts`, better-sqlite3). Test that an atomic save writes
  nothing when any part fails. Fixtures: `loadFixes` (`test-support/fixtures.ts`) and `oracleStats`
  (`test-support/oracle.ts`).
- **Where tests live**: a test that uses only core code lives next to it in `packages/core` (its own
  Jest, `pnpm --filter @cityturfer/core test:unit`); a test that needs SQLite, Expo fakes or
  Recording stays in the app (e.g. the Home City and Identity use-case tests, the oracle parity
  test).
- **Architecture**: `depcruise` runs as part of `pnpm test` (`turbo run arch` covers app and core).

## Smells to reject in review

An anemic aggregate (only getters, with the rules living in use cases) · a use case that calls
another use case · domain code importing `expo-*` · `ui/` calling repositories · one context reading
another context's tables · events carrying entity instances · a "service" class that is really a bag
of functions with no domain concept · terms that aren't in the ubiquitous language (e.g. `workout`,
`gpsPoint`).
