import type { Achievement } from '@cityturfer/core/achievements';

import type { Locale, T } from '@/i18n';
import { fixed } from '@/ui-kit/format';

import { ACHIEVEMENT_KEY } from './achievement-copy.constants';

/** Whole numbers as they are, km progress with one decimal (core floors it to 0.1 km); never grouped. */
const amount = (n: number, locale: Locale) => (Number.isInteger(n) ? fixed(n, 0, locale) : fixed(n, 1, locale));

/** An achievement's title, description and progress line in `t`'s language (`locale`: the same one, for numbers). */
export function achievementCopy(a: Achievement, t: T<'achievements'>, locale: Locale) {
  const key = ACHIEVEMENT_KEY[a.id];
  const title = t(`achievementTitle.${key}`);
  const description = t(`achievementDescription.${key}`);
  let progress: string;
  if (a.unlocked) {
    progress = t('unlocked');
  } else if (a.unit === null) {
    progress = t('notYet');
  } else if (a.unit === 'km') {
    progress = t('progress.km', { current: amount(a.current, locale), target: amount(a.target, locale) });
  } else {
    progress = t(`progress.${a.unit}`, {
      current: amount(a.current, locale),
      target: amount(a.target, locale),
      count: a.target,
    });
  }
  return { title, description, progress };
}
