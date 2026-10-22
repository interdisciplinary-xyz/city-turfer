import { DomainError } from '../../../../shared-kernel';
import { accountFieldError, displayName, newEmail, newPassword } from '../account-fields';

const codeOf = (fn: () => unknown) => {
  try {
    fn();
    return null;
  } catch (e) {
    return accountFieldError(e);
  }
};

describe('displayName', () => {
  it('trims, collapses whitespace and normalises to NFC', () => {
    expect(displayName('  Ala   Kowalska ')).toBe('Ala Kowalska');
    expect(displayName('Ala\tKowalska\n')).toBe('Ala Kowalska');
    expect(displayName('Zo\u0301sia')).toBe('Zósia'); // decomposed ó → one code point
  });

  it('clears the name for empty or blank input', () => {
    expect(displayName('')).toBeNull();
    expect(displayName('   ')).toBeNull();
  });

  it('counts code points, not UTF-16 units', () => {
    expect(displayName('🌆'.repeat(40))).toBe('🌆'.repeat(40));
    expect(codeOf(() => displayName('🌆'.repeat(41)))).toBe('display-name.too-long');
    expect(displayName('a'.repeat(40))).toHaveLength(40);
    expect(codeOf(() => displayName('a'.repeat(41)))).toBe('display-name.too-long');
  });

  it('refuses control characters', () => {
    expect(codeOf(() => displayName('Ala\u0000'))).toBe('display-name.invalid');
    expect(codeOf(() => displayName('Ala\u001b[31m'))).toBe('display-name.invalid');
    expect(codeOf(() => displayName('Ala\u2028Kot'))).toBe('display-name.invalid');
  });

  it('refuses format characters (Cf): zero-width, bidi marks and overrides, isolates', () => {
    for (const cf of [
      '\u200B', // zero-width space: a name of only this would save as non-empty
      '\u200E',
      '\u200F',
      '\u202A',
      '\u202E', // right-to-left override: reorders the text after it
      '\u2066',
      '\u2069',
      '\uFEFF',
      '\u00AD',
    ]) {
      expect([cf.codePointAt(0), codeOf(() => displayName(`Ala${cf}Kot`))]).toEqual([
        cf.codePointAt(0),
        'display-name.invalid',
      ]);
    }
    expect(codeOf(() => displayName('\u200B'))).toBe('display-name.invalid');
    expect(codeOf(() => displayName('\u202Etxt.exe'))).toBe('display-name.invalid');
  });

  it('keeps ZWJ inside emoji, flag tags after 🏴, and ZWNJ between letters', () => {
    for (const ok of ['Ala 👩\u200D💻', '🏳\uFE0F\u200D🌈', '🏃🏽\u200D♀\uFE0F', '👨\u200D👩\u200D👧']) {
      expect(displayName(ok)).toBe(ok);
    }
    const england = '🏴\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}';
    expect(displayName(`Ala ${england}`)).toBe(`Ala ${england}`);
    expect(displayName('می\u200Cخواهم')).toBe('می\u200Cخواهم');
    // Outside those sequences they are refused.
    expect(codeOf(() => displayName('Ala\u200DKot'))).toBe('display-name.invalid');
    expect(codeOf(() => displayName('\u200D👩'))).toBe('display-name.invalid');
    expect(codeOf(() => displayName('👩\u200D'))).toBe('display-name.invalid');
    expect(codeOf(() => displayName('\u200C'))).toBe('display-name.invalid');
    expect(codeOf(() => displayName('Ala \u200CKot'))).toBe('display-name.invalid');
    expect(codeOf(() => displayName('Ala\u{E0067}'))).toBe('display-name.invalid');
  });
});

describe('newEmail', () => {
  it('lower-cases and trims', () => {
    expect(newEmail('  Ala@Example.COM ', 'old@example.com')).toBe('ala@example.com');
  });

  it('refuses the current address, in any case', () => {
    expect(codeOf(() => newEmail('ALA@example.com', 'ala@example.com'))).toBe('email.unchanged');
  });

  it('refuses an invalid address', () => {
    expect(codeOf(() => newEmail('not-an-email', null))).toBe('email.invalid');
  });

  // The sign-in routes' rule (zod 4 `z.email()`): an address outside it could never sign in again.
  // apps/api runs the same kind of vectors through zod and this rule and asserts they agree.
  it('accepts exactly what sign-in accepts', () => {
    for (const ok of [
      'ania@example.com',
      'ania.nowak@example.com',
      'ania+cityturfer@example.co.uk',
      "o'brien@example.ie",
      'jan_kowalski-2@sub-domain.example.pl',
      'a@b.cd',
    ]) {
      expect(newEmail(ok, null)).toBe(ok);
    }
    for (const bad of [
      'jürgen@example.de', // non-ASCII local part
      'ania@exämple.de', // non-ASCII domain
      'jan&co@firma.pl', // `&`
      'ania@example.c', // one-letter TLD
      'ania@example.123', // numeric TLD
      'ania.@example.com', // dot before @
      '.ania@example.com',
      'an..ia@example.com',
      'ania@-example.com',
      'ania@example',
      '"ania"@example.com',
      `${'a'.repeat(64)}@${'b'.repeat(186)}.com`, // 255 characters
    ]) {
      expect([bad, codeOf(() => newEmail(bad, null))]).toEqual([bad, 'email.invalid']);
    }
    expect(newEmail(`${'a'.repeat(64)}@${'b'.repeat(185)}.com`, null)).toHaveLength(254);
  });
});

describe('newPassword', () => {
  it('accepts 12 to 128 code points, spaces included, untrimmed', () => {
    expect(newPassword('correct horse')).toBe('correct horse');
    expect(newPassword(' '.repeat(12))).toBe(' '.repeat(12));
    expect(newPassword('a'.repeat(128))).toHaveLength(128);
  });

  it('refuses short and long passwords', () => {
    expect(codeOf(() => newPassword('a'.repeat(11)))).toBe('password.too-short');
    expect(codeOf(() => newPassword('a'.repeat(129)))).toBe('password.too-long');
    expect(codeOf(() => newPassword('🔑'.repeat(11)))).toBe('password.too-short'); // 22 UTF-16 units
  });
});

describe('accountFieldError', () => {
  it('ignores other errors', () => {
    expect(accountFieldError(new Error('x'))).toBeNull();
    expect(accountFieldError(new DomainError('user-id.invalid'))).toBeNull();
  });
});
