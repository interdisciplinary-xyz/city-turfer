import assert from 'node:assert/strict';
import { test } from 'node:test';

import { findCoordinates, summarisePending } from '../chain/run.mjs';

test('findCoordinates flags degree-like numbers and leaves request lines alone', () => {
  const log = [
    '{"msg":"request","method":"PUT","route":"/v1/activities/:activityId","status":201,"ms":14}',
    '{"msg":"oops","lat":52.21345}',
    'track at 20.99899,52.2133',
    '{"msg":"config","database":true}',
  ].join('\n');
  assert.deepEqual(findCoordinates(log), ['{"msg":"oops","lat":52.21345}', 'track at 20.99899,52.2133']);
});

test('summarisePending lists each pending check with its server and reason', () => {
  const jsonl = '{"server":"live API","check":"S1 turf cells","pending":"501"}\n';
  assert.deepEqual(summarisePending(jsonl), ['  - [live API] S1 turf cells: 501']);
  assert.deepEqual(summarisePending(''), []);
});
