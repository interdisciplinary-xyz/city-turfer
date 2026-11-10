// Commits that reached a scope with a line over 100 characters and can't be reworded without a
// force-push, so only these exact commits are skipped; every other one is checked:
// e9e869a (README, #110, scope/v0.9.0); fa93c52 and ebbd4bf (#212, scope/v0.15.0: docs-only, so
// CI's paths-ignore skipped the check then; it now runs in its own workflow).
const LEGACY_SUBJECTS = [
  'docs: bring the readme up to v0.8.0',
  'docs(product): product-manager note on the homepage tidy-up',
  'docs(product): exact section counts in the homepage tidy note',
];

export default {
  extends: ['@commitlint/config-conventional'],
  ignores: [(message) => LEGACY_SUBJECTS.includes(message.split('\n')[0].trim())],
};
