import type { BrandActivityType } from '@cityturfer/brand';

import type { ActivityTypeName } from './activity';

/**
 * Brand colour tokens live in `@cityturfer/brand` (packages/brand), shared with the web landing
 * page. Re-exported here so the app keeps one import path.
 */
export {
  ACCENT,
  DARK,
  LIGHT,
  ON_ACCENT,
  ON_LIGHT,
  ON_TIER,
  ON_TYPE_COLOR,
  RAMP,
  TIER_COLOR,
  TYPE_COLOR,
} from '@cityturfer/brand';

/** Compile-time guard: the brand's activity keys are exactly the app's activity types. */
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
export const _BRAND_ACTIVITY_TYPES_MATCH: Same<ActivityTypeName, BrandActivityType> = true;
