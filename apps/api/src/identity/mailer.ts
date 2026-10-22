/**
 * Port: sends transactional e-mail (sign-in, step-up and new-address codes, security notices,
 * export links). Adapters: `BrevoMailer` (production, plain fetch to Brevo's API), `ConsoleMailer`
 * (the local dev server only: prints the message so a developer can read the code),
 * `MemoryMailer` (tests), `NullMailer` (a deployed non-production server without a Brevo key:
 * codes only via AUTH_FIXED_CODE). No adapter logs an address, a code or a link anywhere but the
 * local console. Mails are English only (no language is known per account yet).
 */
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

export class MemoryMailer implements Mailer {
  readonly sent: MailMessage[] = [];

  send(message: MailMessage): Promise<void> {
    this.sent.push(message);
    return Promise.resolve();
  }

  /** The last message to this address, or undefined. */
  lastTo(to: string): MailMessage | undefined {
    return this.sent.findLast((m) => m.to === to);
  }
}

export const nullMailer: Mailer = { send: () => Promise.resolve() };

/** Local dev server only (src/server.ts): never wired on Vercel. */
export const consoleMailer: Mailer = {
  send: (m) => {
    process.stdout.write(`\n[dev mail] to ${m.to}: ${m.subject}\n${m.text}\n\n`);
    return Promise.resolve();
  },
};

/** Brevo transactional e-mail (EU). https://developers.brevo.com/reference/sendtransacemail */
export class BrevoMailer implements Mailer {
  constructor(
    private readonly apiKey: string,
    private readonly from: { email: string; name: string },
    private readonly fetchFn: typeof fetch = fetch
  ) {}

  async send(m: MailMessage): Promise<void> {
    const res = await this.fetchFn('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': this.apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ sender: this.from, to: [{ email: m.to }], subject: m.subject, textContent: m.text }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      // The status only: Brevo's body may echo the address.
      throw new Error(`brevo ${res.status}`);
    }
  }
}

/** `MAIL_FROM`: `Name <address>` or a bare address. */
export function parseMailFrom(raw: string): { email: string; name: string } | null {
  const match = /^\s*(?:(.+?)\s*<([^<>\s]+@[^<>\s]+)>|([^<>\s]+@[^<>\s]+))\s*$/.exec(raw);
  if (!match) {
    return null;
  }
  return match[3] ? { email: match[3], name: 'CityTurfer' } : { email: match[2], name: match[1] };
}

export const signInCodeMail = (to: string, code: string): MailMessage => ({
  to,
  subject: `${code} is your CityTurfer code`,
  text: [
    `Your CityTurfer sign-in code is ${code}.`,
    '',
    'It works once, for 10 minutes. Didn’t ask for it? Ignore this email.',
  ].join('\n'),
});

// --- Account settings (docs/decisions/account-settings-2026-10-22.md) -----------------------------
// No links that sign anyone in. Times in UTC, like the export mail.

const when = (at: number) => new Date(at).toUTCString();

/** Step-up: a fresh code to the current address before a sensitive change (AC4). */
export const stepUpCodeMail = (to: string, code: string): MailMessage => ({
  to,
  subject: `${code} is your CityTurfer confirmation code`,
  text: [
    `Your code to confirm a change to your CityTurfer account is ${code}.`,
    '',
    'It works once, for 10 minutes. Didn’t ask for it? Ignore this email: nothing changes without',
    'the code. Never share a code with anyone.',
  ].join('\n'),
});

/** The code that proves the new address can receive mail. */
export const newAddressCodeMail = (to: string, code: string): MailMessage => ({
  to,
  subject: `${code} is your CityTurfer code for this address`,
  text: [
    `Your code to use this email address for your CityTurfer account is ${code}.`,
    '',
    'It works once, for 10 minutes. Didn’t ask for it? Ignore this email: the address isn’t added',
    'without the code.',
  ].join('\n'),
});

/** Sent instead of a code when the new address already has an account (no enumeration). */
export const addressInUseMail = (to: string): MailMessage => ({
  to,
  subject: 'This address already has a CityTurfer account',
  text: [
    'Someone asked to move their CityTurfer account to this email address. It already belongs to',
    'a CityTurfer account, so nothing changed.',
    '',
    'If it was you: sign in with this address instead, or delete one of the two accounts first.',
    'If it wasn’t you, ignore this email.',
  ].join('\n'),
});

/**
 * To the old address after an e-mail change (AC5). Wording for "not you" awaits a founder decision:
 * there is no recovery process yet and staff can't change an address, so it promises neither.
 */
export const emailChangedMail = (to: string, at: number): MailMessage => ({
  to,
  subject: 'Your CityTurfer email address was changed',
  text: [
    `The email address of your CityTurfer account was changed on ${when(at)}. This address no`,
    'longer signs in, and your other phones and browsers were signed out.',
    '',
    'If it was you, there’s nothing to do.',
    '',
    'Not you? The change needed a code we sent to this address, so someone else may be able to',
    'read this inbox. Change your email password first. We can’t move the account back to this',
    'address, and nobody at CityTurfer can change it for you. Never share a code with anyone.',
  ].join('\n'),
});

/** After an account password was set (`changed: false`) or replaced (AC5). */
export const passwordSetMail = (to: string, at: number, changed: boolean): MailMessage => ({
  to,
  subject: changed
    ? 'Your CityTurfer account password was changed'
    : 'An account password was added to your CityTurfer account',
  text: [
    changed
      ? `Your CityTurfer account password was changed on ${when(at)}.`
      : `An account password was added to your CityTurfer account on ${when(at)}.`,
    'You can sign in with it or with an email code. Your other phones and browsers were signed out.',
    '',
    'If it was you, there’s nothing to do.',
    'Not you? Sign in with a code sent to this address, then change the account password or remove it.',
  ].join('\n'),
});

/** After the account password was removed. */
export const passwordRemovedMail = (to: string, at: number): MailMessage => ({
  to,
  subject: 'Your CityTurfer account password was removed',
  text: [
    `Your CityTurfer account password was removed on ${when(at)}. You now sign in with an email`,
    'code only.',
    '',
    'If it was you, there’s nothing to do.',
    'Not you? Sign in with a code sent to this address and set a new account password.',
  ].join('\n'),
});
