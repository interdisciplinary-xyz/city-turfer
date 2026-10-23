import type { DefaultNameWords } from '@cityturfer/core/activity-log';

// The modules, not the @/i18n barrel: that one brings the React provider (not needed here, nor in Jest).
import { loadLanguageSetting } from '@/i18n/language';
import type { Locale } from '@/i18n/locales';
import { translator } from '@/i18n/translator';

/**
 * Default Activity names from the catalogue (`activityNames.defaultName`), in `locale` (default: the
 * app language now). A message that cannot be formatted throws, so core falls back to English
 * rather than storing a raw message or key as the name (it is user data from then on).
 */
export function catalogueDefaultNameWords(locale?: Locale): DefaultNameWords {
  const t = translator('activityNames', locale);
  return (partOfDay, type) => {
    const name = t('defaultName', { partOfDay, type });
    if (/[{}]/.test(name) || name.startsWith('activityNames.')) {
      throw new Error('activity-names.unformatted');
    }
    return name;
  };
}

/**
 * The words in the language active now, for a new Activity. Reads the saved Language setting first:
 * on a headless launch (the OS delivering locations) no provider has read it yet. Never rejects: an
 * unreadable setting means the phone's language.
 */
export async function currentDefaultNameWords(): Promise<DefaultNameWords> {
  await loadLanguageSetting().catch(() => undefined);
  return catalogueDefaultNameWords();
}
