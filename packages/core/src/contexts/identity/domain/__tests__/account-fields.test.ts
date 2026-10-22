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
