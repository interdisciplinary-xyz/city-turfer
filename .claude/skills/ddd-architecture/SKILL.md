---
name: ddd-architecture
description:
  CityTurfer's Domain-Driven Design rules and code patterns — bounded contexts (Identity, Recording,
  Activity Log, Territory, Shared Kernel), layers (domain/application/infrastructure/ui), dependency
  rule enforced by dependency-cruiser, aggregate/value-object/domain-event/repository/use-case
  templates, transactional outbox, composition root usable from the headless background task, and
  the ubiquitous language, and what lives in packages/core (@cityturfer/core: shared kernel, core
  constants, domain + application of Territory, Activity Log, Achievements, Identity) versus the
  app. Use before writing or reviewing any code in apps/mobile/src/ or packages/core/, when
  deciding where code belongs, adding an aggregate, use case, port, adapter, event or context, or
  when a dependency-cruiser rule fails.
---

# DDD architecture for CityTurfer

DDD is a **hard requirement** for this project. The design lives in `docs/poc-plan.md`, sections
2–5. This skill covers how to apply it in code.

## Where does this code go?

First, which package. **`packages/core` (`@cityturfer/core`)** holds what the phone and the server
both run: the shared kernel, the core constants (activity types, tracking thresholds, Earth radius,
`DETAIL_ZOOM`) and the `domain/` + `application/` + `contract.ts` + public `index.ts` of
**Territory, Activity Log, Achievements and Identity**, plus the H3 adapter
(`packages/core/src/h3/`, entry `@cityturfer/core/h3`). **`apps/mobile`** keeps everything
device-bound: Recording and Health Sync (all layers), every adapter (SQLite repositories, Expo, OSM
router, secure store), `platform/` (SQLite, migrations, outbox), UI and wiring. Core is TS source
with no React, Expo, native module, UI package or `@/` import; its contexts use relative imports.

- **is a business rule or invariant ("can't resume a finished session", "drop fixes faster than 8
  m/s for a run")**: the context's `domain/`, **inside the aggregate** or a domain policy
  (`packages/core/src/contexts/<ctx>/domain/` for the four core contexts)
- **is pure maths on tracks or measures used by both contexts**: `packages/core/src/shared-kernel/`
  (the app's `@/shared-kernel` is a re-export shim)
- **orchestrates: load aggregate → call method → save → publish**: the context's `application/` (one
  use case per file; in core for the four core contexts)
- **talks to Expo, SQLite, the filesystem or the OS**: the context's `infrastructure/` (an adapter
  implementing a port)
- **is cross-cutting plumbing (db connection, migrations, outbox, dispatcher, jobs, diagnostics)**:
  `apps/mobile/src/platform/`
- **renders or holds UI state**: the context's `ui/` (hooks, components) and `apps/mobile/src/app/`
  (thin screens)
- **wires implementations to ports**: `apps/mobile/src/composition-root.ts` only

If a rule shows up as an `if` in a use case, a repository or a component, move it into the domain.

## Dependency rule (enforced)

`.dependency-cruiser.cjs`:

```js
const ctx = '^apps/mobile/src/contexts/([^/]+)/';
module.exports = {
  forbidden: [
    {
      name: 'domain-is-pure',
      severity: 'error',
      from: { path: '^apps/mobile/src/(shared-kernel|contexts/[^/]+/domain)/' },
      to: {
        path: '^(node_modules/(react|react-native|expo[^/]*|zustand|h3-js|@maplibre|expo-secure-store)|apps/mobile/src/(platform|composition-root)|apps/mobile/src/contexts/[^/]+/(application|infrastructure|ui))',
      },
    },
    {
      name: 'application-no-infra-or-ui',
      severity: 'error',
      from: { path: ctx + 'application/' },
      to: {
        path: '^(node_modules/(react|react-native|expo[^/]*)|apps/mobile/src/contexts/[^/]+/(infrastructure|ui)|apps/mobile/src/composition-root)',
      },
    },
    {
      name: 'contexts-only-via-public-api',
      severity: 'error',
      from: { path: ctx },
      to: {
        path: '^apps/mobile/src/contexts/([^/]+)/(domain|application|infrastructure|ui)/',
        pathNot: '^apps/mobile/src/contexts/$1/',
      },
    },
    {
      name: 'screens-use-ui-layer',
      severity: 'error',
      from: { path: '^app/' },
      to: {
        path: '^apps/mobile/src/(contexts/[^/]+/(domain|application|infrastructure)|platform)/',
      },
    },
    { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },
  ],
  options: { tsConfig: { fileName: 'tsconfig.json' }, doNotFollow: { path: 'node_modules' } },
};
```

`packages/core/.dependency-cruiser.cjs` repeats the layer rules for core and adds
`core-is-platform-free` (no React, Expo, native, UI packages or apps anywhere in core) and
`h3-only-in-h3`. The app's config adds `core-via-entry-points` (only `@cityturfer/core/<entry>`,
never files under `packages/core/src/` directly), `core-ports-for-own-adapters` and
`core-ports-only-of-own-context` (`@cityturfer/core/<ctx>/ports` is for that context's
`infrastructure/`, test doubles and the wiring). Both run as each workspace's `arch` script.

Exceptions: the root `index.ts` imports the background task module (it sits outside
`apps/mobile/src/`, so depcruise doesn't cruise it), and `apps/mobile/src/composition-root.ts` /
`apps/mobile/src/wiring.ts` may import anything (no rule has them as a `from`). The live rules are
`.dependency-cruiser.cjs`. Don't relax the rules any further. In M0, add a deliberately violating
fixture file, check that `depcruise` fails on it, then delete it, so the rules are known to work.

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

```ts
export class RecordingSession {
  private events: RecordingEvent[] = [];
  private constructor(private state: RecordingSessionState) {}

  static start(id: SessionId, type: ActivityType, now: Instant): RecordingSession {
    const s = new RecordingSession({
      id,
      type,
      profile: TrackingProfile.forType(type),
      status: 'recording',
      startedAt: now,
      segment: 0,
      tail: null,
      totals: Totals.zero(),
    });
    s.record({ type: 'SessionStarted', sessionId: id, activityType: type, at: now });
    return s;
  }

  resume(now: Instant): void {
    if (this.state.status !== 'paused') throw new DomainError('session.not-paused');
    this.state = {
      ...this.state,
      status: 'recording',
      segment: this.state.segment + 1,
      tail: null,
    };
    this.record({
      type: 'SessionResumed',
      sessionId: this.state.id,
      segment: this.state.segment,
      at: now,
    });
  }

  ingest(fixes: readonly Fix[]): TrackPoint[] {
    /* FixFilter + AutoPausePolicy; update tail/totals */
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

// application/IngestFixes.ts
export class IngestFixes {
  constructor(
    private readonly sessions: RecordingSessionRepository,
    private readonly log: Logger
  ) {}
  async execute(fixes: readonly Fix[]): Promise<IngestResult> {
    const session = await this.sessions.getActive();
    if (!session) return { kind: 'no-active-session' }; // the caller (task) may stop the tracker
    const accepted = session.ingest(fixes);
    await this.sessions.save(session, accepted); // also writes pullEvents() to the outbox
    return { kind: 'ingested', accepted: accepted.length, snapshot: session.snapshot() };
  }
}
```

Use cases return result objects instead of throwing for expected outcomes. They throw only for
programming errors. A use case never contains an `if` that encodes a business rule.

### Outbox and events

- `platform/outbox.ts`: `append(tx, events)` writes to the `sys_outbox` table inside the
  repository's transaction.
- `platform/EventDispatcher.ts`: `dispatchPending()` reads unprocessed rows, calls the registered
  handlers, and marks each row processed. It runs after each commit and on app start.
- Handlers are **idempotent**. For example, `RecordActivityFromSession` uses activity id = session
  id with `INSERT OR IGNORE`.
- Event payloads are the published language: plain JSON, versioned (`{ type, v: 1, … }`), and never
  containing entity objects.

### Anti-corruption layer

```ts
// recording/infrastructure/expo-location-tracker.ts — the only file that knows LocationObject
export const toFix = (l: Location.LocationObject): Fix =>
  Fix.of({
    lat: l.coords.latitude,
    lon: l.coords.longitude,
    altitude: l.coords.altitude ?? null,
    accuracy: l.coords.accuracy ?? null,
    speed: l.coords.speed != null && l.coords.speed >= 0 ? l.coords.speed : null,
    at: Instant.ofEpochMs(l.timestamp),
  });
```

### Composition root (lazy, React-free, usable headless)

```ts
let container: Container | null = null;
export async function getContainer(): Promise<Container> {
  if (container) return container;
  const db = await openDatabase();           // platform; also runs migrations
  const dispatcher = new EventDispatcher(db);
  const sessions = new SqliteRecordingSessionRepository(db);
  // …activity-log wiring, handler registration on dispatcher
  container = { recording: createRecordingApi({ sessions, tracker: new ExpoLocationTracker(), clock: systemClock }),
                activityLog: createActivityLogApi({ … }), dispatcher };
  return container;
}
```

Use no DI library: plain functions, constructed lazily. The background task and the UI's
`AppProvider` (`apps/mobile/src/ui-kit/app-context.tsx`) both call `getContainer()`.

### Context public API (`index.ts`) and adapter SPI (`ports.ts`)

Export only: the application API factory and its types, published event types, and (for `ui/`)
hooks. Never export domain classes or repositories. A core context also has `ports.ts`
(`@cityturfer/core/<ctx>/ports`): the repository/gateway ports and the aggregate its adapters
implement or rehydrate (e.g. `Claim`, `Activity`), imported only by that context's adapters in the
app. The app keeps `src/contexts/<ctx>/index.ts` (and `contract.ts`) as `export *` shims, so
`@/contexts/<ctx>` keeps working. Add a new core entry to `packages/core/package.json` `exports`.

## Testing per layer

- **Domain**: plain Jest with no mocks. Every invariant in `docs/poc-plan.md` §4 has a test. Use
  `FakeClock`.
- **Application**: in-memory repositories (`InMemoryRecordingSessionRepository`) and
  `FakeLocationTracker` under `application/__tests__/fakes/`.
- **Infrastructure**: real SQL through the better-sqlite3 adapter. Test that atomic save rolls back
  everything if the outbox insert fails.
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
