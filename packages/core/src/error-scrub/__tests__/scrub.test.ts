// What an error report may carry: vectors for the phone's and the server's beforeSend /
// beforeBreadcrumb. Coordinates here are made-up city-centre values, never a real trace.
import {
  redactCoordinates,
  REDACTED_COORD,
  REDACTED_EMAIL,
  REDACTED_PAIR,
  redactEmails,
  routePattern,
  scrubBreadcrumb,
  scrubEvent,
  scrubText,
  scrubUrl,
} from '..';

const OSRM =
  'https://routing.openstreetmap.de/routed-foot/route/v1/driving/18.654,54.352;18.660,54.360?overview=full&geometries=geojson';

describe('scrubUrl', () => {
  it('reduces a street-router URL (coordinates in the path) to its host', () => {
    expect(scrubUrl(OSRM)).toBe('https://routing.openstreetmap.de');
    expect(scrubUrl('https://router.project-osrm.org/route/v1/foot/18.6,54.3;18.7,54.4')).toBe(
      'https://router.project-osrm.org'
    );
    expect(scrubUrl('http://my-osrm.example.com/route/v1/x')).toBe('http://my-osrm.example.com');
  });

  it('reduces a map-tile URL to its host', () => {
    expect(scrubUrl('https://tiles.openfreemap.org/planet/20250101/14/9123/5345.pbf')).toBe(
      'https://tiles.openfreemap.org'
    );
  });

  it('drops query, fragment and credentials from any other URL', () => {
    expect(scrubUrl('https://api.example.com/v1/activities/abc?token=s3cret#x')).toBe(
      'https://api.example.com/v1/activities/abc'
    );
    expect(scrubUrl('https://user:pw@api.example.com/v1/me')).toBe('https://api.example.com/v1/me');
  });
});

describe('redactCoordinates', () => {
  it.each([
    ['Route failed near 54.352,18.654', `Route failed near ${REDACTED_PAIR}`],
    ['at [18.654, 54.352] then', `at [${REDACTED_PAIR}] then`],
    ['fix 54.35 18.65 dropped', `fix ${REDACTED_PAIR} dropped`],
    ['-33.86;151.21', REDACTED_PAIR],
    ['{"latitude":54.352,"longitude":18.654}', `{"latitude":${REDACTED_COORD},"longitude":${REDACTED_COORD}}`],
    ['startLat=54.35 endLng: 18.65', `startLat=${REDACTED_COORD} endLng: ${REDACTED_COORD}`],
    ['bad value 54.352187', `bad value ${REDACTED_COORD}`],
  ])('%s', (input, expected) => {
    expect(redactCoordinates(input)).toBe(expected);
  });

  it.each([
    'timed out after 15000 ms',
    'app 0.17.0 (build 42)',
    'SQLITE_BUSY: database is locked (code 5)',
    'accuracy 12.5 m',
    'outbox.dead-letter attempts 5',
    'ratio 400.25,500.75',
  ])('leaves %s alone', (input) => {
    expect(redactCoordinates(input)).toBe(input);
  });
});

describe('redactEmails', () => {
  it.each([
    ['someone@example.com', REDACTED_EMAIL],
    ['Sign-in failed for jan.kowalski@example.pl.', `Sign-in failed for ${REDACTED_EMAIL}.`],
    ['user+cityturfer@mail.example.co.uk rejected', `${REDACTED_EMAIL} rejected`],
    [
      'Nie udało się wysłać kodu na adres łukasz.żółć@poczta.example.pl, spróbuj ponownie',
      `Nie udało się wysłać kodu na adres ${REDACTED_EMAIL}, spróbuj ponownie`,
    ],
    ['(<a@b.io>) and "c_d@e-f.org"', `(<${REDACTED_EMAIL}>) and "${REDACTED_EMAIL}"`],
    ['UPPER.Case@Example.COM', REDACTED_EMAIL],
  ])('%s', (input, expected) => {
    expect(redactEmails(input)).toBe(expected);
  });

  it.each([
    'decorator v1.2@3 applied',
    'release cityturfer@0.17.0+abc',
    'sdk @sentry/react-native@7.11.0',
    'import from @cityturfer/core/error-scrub',
    'mention @someone in a thread',
    'trailing at@',
  ])('leaves %s alone', (input) => {
    expect(redactEmails(input)).toBe(input);
  });

  it('stays fast on long runs without an address', () => {
    const inputs = ['a'.repeat(50_000), `${'a.'.repeat(25_000)}@`, `x@${'b.'.repeat(25_000)}1`, '@'.repeat(50_000)];
    const start = Date.now();
    for (const input of inputs) {
      expect(redactEmails(input)).toBe(input);
    }
    expect(Date.now() - start).toBeLessThan(500);
  });
});

describe('scrubText', () => {
  it('scrubs URLs inside a message, keeping sentence punctuation', () => {
    expect(scrubText(`Network request failed: ${OSRM}.`)).toBe(
      'Network request failed: https://routing.openstreetmap.de.'
    );
  });

  it('redacts e-mail addresses next to URLs and coordinates', () => {
    expect(
      scrubText('Backup for someone@example.com failed at 54.352,18.654: https://user:pw@api.example.com/v1/me')
    ).toBe(`Backup for ${REDACTED_EMAIL} failed at ${REDACTED_PAIR}: https://api.example.com/v1/me`);
  });
});

describe('scrubEvent', () => {
  const base = {
    event_id: 'e1',
    platform: 'javascript',
    sdk: { name: 'sentry.javascript.react-native', version: '7.11.0' },
    release: 'cityturfer@0.17.0+abc',
    environment: 'production',
  };

  it('drops the request (body, headers, query, cookies), the user, extra and the server name', () => {
    const out = scrubEvent({
      ...base,
      request: {
        url: 'https://api.example.com/v1/activities?x=1',
        method: 'PUT',
        data: '{"track":[[18.654,54.352]]}',
        headers: { authorization: 'Bearer t0ken', cookie: 'session=abc' },
        cookies: { session: 'abc' },
        query_string: 'x=1',
      },
      user: { id: 'u1', email: 'someone@example.com', ip_address: '203.0.113.9' },
      extra: { payload: { lat: 54.352 } },
      server_name: "Anna's iPhone",
      message: 'boom',
    });
    expect(out).not.toHaveProperty('request');
    expect(out).not.toHaveProperty('user');
    expect(out).not.toHaveProperty('extra');
    expect(out).not.toHaveProperty('server_name');
    expect(JSON.stringify(out)).not.toMatch(/someone@example\.com|t0ken|session=|54\.352/);
    expect(out).toMatchObject(base);
  });

  it('keeps only the allowed contexts, without the device name', () => {
    const out = scrubEvent({
      ...base,
      contexts: {
        os: { name: 'iOS', version: '26.1' },
        device: { name: "Anna's iPhone", model: 'iPhone17,1', family: 'iOS' },
        app: { app_version: '0.17.0' },
        runtime: { name: 'Hermes' },
        ota_updates: { channel: 'production' },
        culture: { timezone: 'Europe/Warsaw', locale: 'pl-PL' },
        trace: { trace_id: 't' },
        location: { lat: 54.352, lon: 18.654 },
      },
    });
    expect(Object.keys(out.contexts ?? {}).sort()).toEqual(['app', 'device', 'os', 'ota_updates', 'runtime']);
    expect(out.contexts?.device).toEqual({ model: 'iPhone17,1', family: 'iOS' });
  });

  it('redacts coordinates and router URLs in messages, exception values, tags and breadcrumbs', () => {
    const out = scrubEvent({
      ...base,
      message: 'gap estimate failed between 54.352,18.654 and 54.360,18.660',
      logentry: { message: 'route %s', params: ['18.654,54.352'] },
      transaction: '/activity/[id]?from=54.352,18.654',
      tags: { area: 'activity-log', code: 'router-failed', url: OSRM },
      exception: {
        values: [
          {
            type: 'TypeError',
            value: `Network request failed for ${OSRM}`,
            stacktrace: { frames: [{ filename: 'app:///main.jsbundle?platform=ios', lineno: 1 }] },
          },
        ],
      },
      breadcrumbs: [
        { category: 'fetch', data: { url: OSRM } },
        { category: 'navigation', data: { from: '/activity/123?x=1', to: '/(tabs)/map' } },
        { category: 'app.lifecycle', message: 'resumed at 54.352,18.654', data: { state: 'active' } },
      ],
    });
    const text = JSON.stringify(out);
    expect(text).not.toMatch(/54\.35|18\.65|overview=/);
    expect(out.message).toBe(`gap estimate failed between ${REDACTED_PAIR} and ${REDACTED_PAIR}`);
    expect(out.logentry).toEqual({ message: 'route %s' });
    expect(out.transaction).toBe('/activity/[id]');
    expect(out.tags).toEqual({ area: 'activity-log', code: 'router-failed', url: 'https://routing.openstreetmap.de' });
    expect(out.exception?.values?.[0]).toEqual({
      type: 'TypeError',
      value: 'Network request failed for https://routing.openstreetmap.de',
      // Stack frames are untouched: symbolication needs them as they are.
      stacktrace: { frames: [{ filename: 'app:///main.jsbundle?platform=ios', lineno: 1 }] },
    });
    expect(out.breadcrumbs).toEqual([
      { category: 'navigation', data: { from: '/activity/:id', to: '/(tabs)/map' } },
      { category: 'app.lifecycle', message: `resumed at ${REDACTED_PAIR}` },
    ]);
  });

  it('redacts e-mail addresses in the message, exception values and breadcrumb messages', () => {
    const out = scrubEvent({
      ...base,
      message: 'Sign-in failed for someone@example.com',
      exception: { values: [{ type: 'Error', value: 'Konto jan+test@example.pl nie istnieje' }] },
      breadcrumbs: [{ category: 'auth', message: 'signed out someone@example.com' }],
    });
    expect(JSON.stringify(out)).not.toMatch(/@example\./);
    expect(out.message).toBe(`Sign-in failed for ${REDACTED_EMAIL}`);
    expect(out.exception?.values?.[0]?.value).toBe(`Konto ${REDACTED_EMAIL} nie istnieje`);
    expect(out.breadcrumbs).toEqual([{ category: 'auth', message: `signed out ${REDACTED_EMAIL}` }]);
  });

  it('keeps only the error name and code of a HealthKit error', () => {
    const out = scrubEvent({
      ...base,
      message: 'Workout "Morning run" 5.2 km could not be read',
      tags: { area: 'health-sync', code: 'health.import-failed', workout: 'Morning run' },
      exception: {
        values: [
          {
            type: 'HKError',
            value: 'Error Domain=com.apple.healthkit Code=5 "Authorization not determined" heart rate 142',
            stacktrace: { frames: [] },
          },
        ],
      },
      breadcrumbs: [{ category: 'ui.click', message: 'Import from Apple Health' }],
      extra: { workoutId: 'w1' },
    });
    expect(out.message).toBeUndefined();
    expect(out.breadcrumbs).toBeUndefined();
    expect(out.tags).toEqual({ area: 'health-sync', code: 'health.import-failed' });
    expect(out.exception?.values).toEqual([
      { type: 'HKError', value: 'health.import-failed', stacktrace: { frames: [] } },
    ]);
    expect(JSON.stringify(out)).not.toMatch(/Morning run|heart|Authorization|w1/);
  });

  it('drops the exception value of a health-sync report without a code', () => {
    const out = scrubEvent({
      ...base,
      tags: { area: 'health-sync' },
      exception: { values: [{ type: 'Error', value: 'x' }] },
    });
    expect(out.exception?.values).toEqual([{ type: 'Error' }]);
  });

  it('does not mutate its input and survives odd shapes', () => {
    const input = { ...base, user: { id: 'u' }, message: 'at 54.352,18.654', breadcrumbs: [null as never] };
    const copy = JSON.parse(JSON.stringify(input));
    expect(() => scrubEvent(input)).not.toThrow();
    expect(input).toEqual(copy);
    expect(scrubEvent({ exception: { values: [null as never] }, tags: { n: 1 } })).toEqual({
      exception: { values: [null] },
      tags: { n: 1 },
    });
  });
});

describe('scrubBreadcrumb', () => {
  it.each(['console', 'fetch', 'xhr', 'http'])('drops %s breadcrumbs', (category) => {
    expect(scrubBreadcrumb({ category, message: 'GET https://api.example.com', data: {} })).toBeNull();
  });

  it('drops breadcrumbs of type http whatever their category', () => {
    expect(scrubBreadcrumb({ type: 'http', category: 'net', data: { url: OSRM } })).toBeNull();
  });

  it('keeps only the route patterns of a navigation', () => {
    expect(
      scrubBreadcrumb({
        category: 'navigation',
        message: 'Navigated to /activity/9b2c1f3e-7a4d-4c1b-9e2f-1a2b3c4d5e6f?shared=1',
        data: {
          from: '/(tabs)/history',
          to: '/activity/9b2c1f3e-7a4d-4c1b-9e2f-1a2b3c4d5e6f?shared=1',
          params: { id: '9b2c1f3e' },
        },
        timestamp: 1,
      })
    ).toEqual({ category: 'navigation', data: { from: '/(tabs)/history', to: '/activity/:id' }, timestamp: 1 });
  });

  it('keeps other breadcrumbs without data, message scrubbed', () => {
    expect(
      scrubBreadcrumb({ category: 'ui.touch', level: 'info', message: 'Touch at 54.352,18.654', data: { path: [] } })
    ).toEqual({ category: 'ui.touch', level: 'info', message: `Touch at ${REDACTED_PAIR}` });
  });
});

describe('routePattern', () => {
  it.each([
    ['/activity/123', '/activity/:id'],
    ['/plan/0123456789abcdef0123', '/plan/:id'],
    ['/(tabs)/map#here', '/(tabs)/map'],
    ['activity/[id]', 'activity/[id]'],
  ])('%s → %s', (input, expected) => {
    expect(routePattern(input)).toBe(expected);
  });
});
