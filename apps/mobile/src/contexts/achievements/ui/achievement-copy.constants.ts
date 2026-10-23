import type { AchievementId, OnboardingStepId } from '@cityturfer/core/achievements';

import type { Messages } from '@/i18n';

type AchievementKey = keyof Messages['achievements']['achievementTitle'];
type OnboardingStepKey = keyof Messages['achievements']['onboardingStep'];

/**
 * Where each achievement's title and description live in the `achievements` namespace
 * (`achievementTitle.<key>`, `achievementDescription.<key>`). Core keeps its English text as the
 * API's fallback; the app shows the catalogue's (L7).
 */
export const ACHIEVEMENT_KEY: Record<AchievementId, AchievementKey> = {
  'first-steps': 'firstSteps',
  'all-rounder': 'allRounder',
  'five-k': 'fiveK',
  'half-marathon': 'halfMarathon',
  'half-century-ride': 'halfCenturyRide',
  'hundred-km': 'hundredKm',
  regular: 'regular',
  'early-bird': 'earlyBird',
  'night-owl': 'nightOwl',
  neighbourhood: 'neighbourhood',
  'turf-lord': 'turfLord',
  stronghold: 'stronghold',
};

/** Each onboarding step's title in the `achievements` namespace (`onboardingStep.<key>`). */
export const ONBOARDING_STEP_KEY: Record<OnboardingStepId, OnboardingStepKey> = {
  'first-walk': 'firstWalk',
  'see-turf': 'seeTurf',
  'try-all-three': 'tryAllThree',
  'come-back': 'comeBack',
  'unlock-three': 'unlockThree',
};
