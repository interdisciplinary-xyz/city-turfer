import { DomainError } from '../../../shared-kernel';
import { email } from './user';

/**
 * The rules for what a Turfer may change about their account: name, e-mail, password
 * (docs/decisions/account-settings-2026-10-22.md, AC2 and AC6). One copy, used by the API to
 * validate and by the phone and the web portal for instant feedback, so all three agree.
 * The error codes are the API's problem `code`s.
 */

export const DISPLAY_NAME_MAX = 40;
export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;

export type AccountFieldError =
  | 'display-name.too-long'
  | 'display-name.invalid'
  | 'email.invalid'
  | 'email.unchanged'
  | 'password.too-short'
  | 'password.too-long';

// Control characters (C0, DEL, C1) and the line/paragraph separators.
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/;

const codePoints = (s: string) => [...s].length;

// Unicode format characters (Cf): zero-width spaces and joiners, bidi marks and overrides
// (U+200B–200F, U+202A–202E, U+2066–2069), the BOM, tag characters… Invisible, so a name of only
// U+200B would look blank, and U+202E reorders the text around it.
const FORMAT = /\p{Cf}/u;
const PICTOGRAPHIC = /\p{Extended_Pictographic}/u;
// What may sit between a pictograph and the ZWJ that follows it: VS16 and skin-tone modifiers.
const EMOJI_TAIL = /[\uFE0F\p{Emoji_Modifier}]/u;
const ZWJ = '\u200D';
const ZWNJ = '\u200C';
const LETTER = /\p{L}/u;
const MARK = /\p{M}/u;
const TAG_BLACK_FLAG = '\u{1F3F4}';
const isTag = (cp: string) => cp >= '\u{E0020}' && cp <= '\u{E007F}';

/**
 * Whether `name` holds a format character outside an emoji sequence or a word. Allowed, so emoji
 * and some scripts keep working: ZWJ (U+200D) between two pictographs (👩‍💻, 🏳️‍🌈, 🏃🏽‍♀️), tag
 * characters right after 🏴 (the England, Scotland and Wales flags), and ZWNJ (U+200C) between two
 * letters (Persian and Indic spelling needs it). Every other Cf is refused: none of these can make a
 * name look blank or reorder it.
 */
function hasFormatCharacter(name: string): boolean {
  const cps = [...name];
  for (let i = 0; i < cps.length; i++) {
    const cp = cps[i];
    if (!FORMAT.test(cp)) {
      continue;
    }
    if (cp === ZWJ) {
      let before = i - 1;
      while (before >= 0 && EMOJI_TAIL.test(cps[before])) {
        before--;
      }
      if (before >= 0 && PICTOGRAPHIC.test(cps[before]) && i + 1 < cps.length && PICTOGRAPHIC.test(cps[i + 1])) {
        continue;
      }
      return true;
    }
    if (cp === ZWNJ) {
      let before = i - 1;
      while (before >= 0 && MARK.test(cps[before])) {
        before--;
      }
      if (before >= 0 && LETTER.test(cps[before]) && i + 1 < cps.length && LETTER.test(cps[i + 1])) {
        continue;
      }
      return true;
    }
    if (isTag(cp)) {
      let start = i;
      while (start > 0 && isTag(cps[start - 1])) {
        start--;
      }
      if (start > 0 && cps[start - 1] === TAG_BLACK_FLAG) {
        continue;
      }
    }
    return true;
  }
  return false;
}

/**
 * A display name: trimmed, NFC, inner runs of whitespace collapsed to one space, at most 40 code
 * points, no control characters and no format characters (Cf) except inside emoji sequences.
 * `null` means "no name" (an empty or blank input clears it); the UIs then show "You".
 */
export function displayName(raw: string): string | null {
  // Tabs and line breaks count as whitespace (collapsed below); any other control character is refused.
  if (CONTROL.test(raw.replace(/[\t\n\r]/g, ' ')) || hasFormatCharacter(raw)) {
    throw new DomainError('display-name.invalid');
  }
  const value = raw.normalize('NFC').trim().replace(/\s+/g, ' ');
  if (value === '') {
    return null;
  }
  if (codePoints(value) > DISPLAY_NAME_MAX) {
    throw new DomainError('display-name.too-long');
  }
  return value;
}

/** The new address for an e-mail change: valid, lower-cased, and not the current one. */
export function newEmail(raw: string, current: string | null): string {
  const { value } = email(raw);
  if (current !== null && value === current.trim().toLowerCase()) {
    throw new DomainError('email.unchanged');
  }
  return value;
}

/**
 * A new account password (NIST SP 800-63B): 12 to 128 code points, any characters including
 * spaces, no composition rules, not trimmed. The breached-password check is the API's (it needs
 * the network). Returns the password unchanged.
 */
export function newPassword(raw: string): string {
  const n = codePoints(raw);
  if (n < PASSWORD_MIN) {
    throw new DomainError('password.too-short');
  }
  if (n > PASSWORD_MAX) {
    throw new DomainError('password.too-long');
  }
  return raw;
}

/** The field error of a thrown value, or null when it isn't one of these rules. */
export function accountFieldError(e: unknown): AccountFieldError | null {
  if (!(e instanceof DomainError)) {
    return null;
  }
  const codes: readonly string[] = [
    'display-name.too-long',
    'display-name.invalid',
    'email.invalid',
    'email.unchanged',
    'password.too-short',
    'password.too-long',
  ];
  return codes.includes(e.code) ? (e.code as AccountFieldError) : null;
}
