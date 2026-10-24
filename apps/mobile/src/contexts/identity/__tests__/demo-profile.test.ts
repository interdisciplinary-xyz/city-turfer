import { DEMO_USER_ID } from '@cityturfer/core/demo';

import { DEMO_PROFILE_ID } from '..';

// wiring.ts (also run by the headless task) names the demo profile through Identity, never through
// @cityturfer/core/demo (dev data: the Gdańsk routes). The two ids must stay the same.
it('the demo profile id in Identity is the demo data’s user id', () => {
  expect(DEMO_PROFILE_ID).toBe(DEMO_USER_ID);
});
