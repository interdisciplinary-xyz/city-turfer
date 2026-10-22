/**
 * Creates a staff account from the command line (the admin panel's public "create first user" form is
 * closed: src/collections/staff/hooks.ts). Run with Payload's runner, which loads apps/admin/.env:
 *
 *   read -s STAFF_PASSWORD && export STAFF_PASSWORD
 *   pnpm --filter @cityturfer/admin staff:create -- --email you@example.com --roles staff-admin,support-read
 *
 * The password is read from the STAFF_PASSWORD environment variable, at least 12 characters. Set it
 * with `read -s STAFF_PASSWORD && export STAFF_PASSWORD`, so it lands neither in the shell history
 * nor in the process list.
 */
import config from '@payload-config';
import { getPayload } from 'payload';

import { STAFF_BOOTSTRAP } from '../src/collections/staff/hooks';
import { STAFF_ROLES, STAFF_SLUG, type StaffRole } from '../src/collections/staff/roles';

const MIN_PASSWORD = 12;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const email = arg('email')?.trim().toLowerCase();
const roles = (arg('roles') ?? 'support-read').split(',').map((r) => r.trim());
const password = process.env.STAFF_PASSWORD ?? '';

if (!email || !email.includes('@')) {
  fail('Usage: staff:create -- --email <email> [--roles staff-admin,support-read] (password in STAFF_PASSWORD)');
}
const unknown = roles.filter((r) => !(STAFF_ROLES as readonly string[]).includes(r));
if (unknown.length) {
  fail(`Unknown role(s): ${unknown.join(', ')}. Known: ${STAFF_ROLES.join(', ')}`);
}
if (password.length < MIN_PASSWORD) {
  fail(`Set STAFF_PASSWORD to at least ${MIN_PASSWORD} characters.`);
}

const payload = await getPayload({ config });
const doc = await payload.create({
  collection: STAFF_SLUG,
  data: { email, password, roles: roles as StaffRole[] },
  overrideAccess: true,
  context: { [STAFF_BOOTSTRAP]: true },
});
console.log(`Staff account created: ${doc.email} (${roles.join(', ')})`);
process.exit(0);
