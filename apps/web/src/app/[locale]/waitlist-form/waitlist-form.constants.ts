export type WaitlistFormProps = {
  /** The Brevo form's action URL. */
  action: string;
  /** Named in the privacy note. */
  controller: string;
  contactEmail: string;
  /** Sent to Brevo so the confirmation email is in the visitor's language. */
  locale: string;
};

export type WaitlistState = 'idle' | 'sending' | 'sent' | 'failed';

/** Brevo form field names (from Brevo's embed code). */
export const BREVO_FIELDS = {
  email: 'EMAIL',
  consent: 'OPT_IN',
  honeypot: 'email_address_check',
  locale: 'locale',
} as const;
