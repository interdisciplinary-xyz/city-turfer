/**
 * Waitlist (Brevo, double opt-in). The form posts to the Brevo form's endpoint; the visitor
 * confirms by email before they are on the list. All three values are set on Vercel (and in
 * apps/web/.env.local to preview locally); while any is missing, the page shows no form.
 *
 * - NEXT_PUBLIC_WAITLIST_FORM_URL: the Brevo form's action URL (`https://…sibforms.com/serve/…`)
 * - NEXT_PUBLIC_WAITLIST_CONTROLLER: who controls the data (named in the privacy note)
 * - NEXT_PUBLIC_CONTACT_EMAIL: where people write to have their data removed
 */
const url = process.env.NEXT_PUBLIC_WAITLIST_FORM_URL;
const controller = process.env.NEXT_PUBLIC_WAITLIST_CONTROLLER;
const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

export const WAITLIST = url && controller && contactEmail ? { url, controller, contactEmail } : null;
