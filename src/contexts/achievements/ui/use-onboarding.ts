import { useCallback, useEffect, useMemo, useState } from 'react';

import { evaluateOnboarding, type OnboardingFacts, type OnboardingProgress } from '../domain/onboarding';
import { onboardingDismissal } from '../infrastructure/onboarding-dismissal';

/** Checklist progress plus persisted dismissal. `progress` is null while loading, once hidden, or when complete. */
export function useOnboarding(uid: string | null, facts: OnboardingFacts | null) {
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    setDismissed(null);
    if (uid) void onboardingDismissal.isDismissed(uid).then((d) => live && setDismissed(d));
    return () => {
      live = false;
    };
  }, [uid]);
  const hide = useCallback(() => {
    setDismissed(true);
    if (uid) void onboardingDismissal.dismiss(uid);
  }, [uid]);
  const progress = useMemo<OnboardingProgress | null>(() => (facts ? evaluateOnboarding(facts) : null), [facts]);
  return { progress: dismissed === false && progress && !progress.complete ? progress : null, hide };
}
