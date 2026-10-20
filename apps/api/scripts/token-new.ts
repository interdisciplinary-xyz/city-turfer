// Mints a device token for a user (stopgap until Better Auth, docs/decisions/api-device-tokens-2026-10-20.md).
//   pnpm --filter @cityturfer/api run token:new -- admin
// Prints the token (give it to the device once; it is never stored) and the API_TOKENS entry
// (sha256 hex → userId) to add to the Vercel env var.
import { createHash, randomBytes } from 'node:crypto';

const userId = process.argv.slice(2).find((a) => a !== '--');
if (!userId || !/^[A-Za-z0-9_-]{1,64}$/.test(userId)) {
  console.error('Usage: pnpm --filter @cityturfer/api run token:new -- <userId>   (letters, digits, _ and -)');
  process.exit(1);
}

const token = `ct_${randomBytes(32).toString('base64url')}`;
const hash = createHash('sha256').update(token, 'utf8').digest('hex');

console.log(`Token for ${userId} (shown once; paste it into the device, never commit it):`);
console.log(`  ${token}`);
console.log('');
console.log('Add this entry to the API_TOKENS JSON object (Vercel → Settings → Environment Variables):');
console.log(`  ${JSON.stringify({ [hash]: userId })}`);
