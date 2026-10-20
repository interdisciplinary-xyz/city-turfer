// Public API of the Achievements context: pure evaluation over Activity Log and Territory facts.
export {
  type Achievement,
  type AchievementId,
  type AchievementInput,
  evaluateAchievements,
} from './domain/achievements';
export { type AchievementsSummary, summarizeAchievements } from './domain/achievements-summary';
export {
  evaluateOnboarding,
  type OnboardingFacts,
  type OnboardingProgress,
  type OnboardingStep,
  type OnboardingStepId,
} from './domain/onboarding';
