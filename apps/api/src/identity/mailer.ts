/**
 * Port: sends transactional e-mail (sign-in codes, export links). Adapters: `BrevoMailer`
 * (production, plain fetch to Brevo's API), `ConsoleMailer` (the local dev server only: prints the
 * message so a developer can read the code), `MemoryMailer` (tests), `NullMailer` (a deployed
 * non-production server without a Brevo key: codes only via AUTH_FIXED_CODE). No adapter logs an
 * address, a code or a link anywhere but the local console.
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
    'It works once, for 10 minutes. If you did not ask for it, ignore this e-mail.',
  ].join('\n'),
});
