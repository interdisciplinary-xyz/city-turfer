import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

import { type Auth, CODE_TTL_S, codeCipher } from './better-auth';

/** Wrong tries a code survives: the third wrong one burns it (as sign-in codes, A1). */
export const CODE_ATTEMPTS = 3;

/**
 * The account-settings codes (docs/decisions/account-settings-2026-10-22.md, AC4): the **step-up**
 * code mailed to the current address before a sensitive change, and the code mailed to a **new**
 * address. They follow the sign-in codes' rules (A1): 6 digits, 10 minutes, 3 tries, single use,
 * stored encrypted (codeCipher) in `auth_verifications` as `<sealed>:<attempts>`, and a request
 * while one is valid mails the same code again. Built here rather than with Better Auth's emailOTP
 * change-email flow, which mails nothing for a taken address, writes only `auth_users`, revokes no
 * session and wants a fresh cookie session; the rows go through Better Auth's internal adapter
 * (`consume` writes with compare-and-swap statements, so the use is single and race-free).
 *
 * Identifiers: `step-up-otp-<current address>` (so `eraseAccount`'s `%-otp-<address>` clean-up and
 * an e-mail change clear it), and `email-change-otp-<user id>:<HMAC of the new address>` (the new
 * address is never stored; one pending code per new address).
 */
export class OneTimeCodes {
  private readonly cipher;

  constructor(
    private readonly auth: Auth,
    private readonly secret: string
  ) {
    this.cipher = codeCipher(secret);
  }

  stepUpId(email: string): string {
    return `step-up-otp-${email}`;
  }

  emailChangeId(userId: string, newEmail: string): string {
    const hmac = createHmac('sha256', this.secret).update(`email-change:${newEmail}`).digest('base64url');
    return `${emailChangePrefix(userId)}${hmac}`;
  }

  /** The valid, unburnt code of `identifier` again (10 more minutes), else a new one (`fixed` or random). */
  async issue(identifier: string, fixed: string | null = null): Promise<string> {
    const { internalAdapter } = await this.auth.$context;
    const expiresAt = new Date(Date.now() + CODE_TTL_S * 1000);
    const existing = await internalAdapter.findVerificationValue(identifier);
    if (existing && existing.expiresAt > new Date()) {
      const [sealed, attempts] = splitAtLastColon(existing.value);
      const plain = Number(attempts || '0') < CODE_ATTEMPTS ? await this.cipher.decrypt(sealed) : '';
      if (plain) {
        await internalAdapter.updateVerificationByIdentifier(identifier, { expiresAt });
        return plain;
      }
    }
    const code = fixed ?? String(randomInt(0, 1_000_000)).padStart(6, '0');
    await internalAdapter.deleteVerificationByIdentifier(identifier);
    await internalAdapter.createVerificationValue({
      identifier,
      value: `${await this.cipher.encrypt(code)}:0`,
      expiresAt,
    });
    return code;
  }

  /**
   * Spends the code: true once for the right code within 10 minutes. A wrong code costs one of the
   * three tries; the third wrong one burns the code. Expired, burnt or missing: false.
   *
   * Every write is one compare-and-swap statement on the row that was read (its id and its value):
   * the right code deletes exactly that row, a wrong one bumps its try count in place. Of two
   * concurrent requests only one spends the code, and a code issued in between (a new row) is
   * never touched. A lost swap means the row changed under us: read it again (a few times at most).
   */
  async consume(identifier: string, code: string): Promise<boolean> {
    const { internalAdapter, adapter } = await this.auth.$context;
    for (let round = 0; round < CODE_ATTEMPTS + 1; round++) {
      const row = await internalAdapter.findVerificationValue(identifier);
      if (!row || row.expiresAt <= new Date()) {
        return false;
      }
      const [sealed, attempts] = splitAtLastColon(row.value);
      const used = Number(attempts || '0');
      if (used >= CODE_ATTEMPTS) {
        return false;
      }
      const same = [
        { field: 'id', value: row.id },
        { field: 'value', value: row.value },
      ];
      const plain = await this.cipher.decrypt(sealed);
      if (plain !== '' && sameCode(plain, code)) {
        if (await adapter.consumeOne({ model: 'verification', where: same })) {
          return true;
        }
        continue;
      }
      const swapped =
        used + 1 < CODE_ATTEMPTS
          ? await adapter.updateMany({
              model: 'verification',
              where: same,
              update: { value: `${sealed}:${used + 1}`, updatedAt: new Date() },
            })
          : await adapter.deleteMany({ model: 'verification', where: same });
      if (swapped > 0) {
        return false;
      }
    }
    return false;
  }
}

/** The identifier prefix of a user's pending new-address codes (cleared on change and erasure). */
export const emailChangePrefix = (userId: string) => `email-change-otp-${userId}:`;

function splitAtLastColon(value: string): [string, string] {
  const i = value.lastIndexOf(':');
  return i < 0 ? [value, ''] : [value.slice(0, i), value.slice(i + 1)];
}

function sameCode(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
