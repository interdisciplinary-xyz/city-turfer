// e9e869a (README, #110) reached scope/v0.9.0 with a body line over 100 characters. It can't be
// reworded without a force-push, so only that exact commit is skipped; every other one is checked.
const LEGACY_SUBJECTS = ['docs: bring the readme up to v0.8.0'];

export default {
  extends: ['@commitlint/config-conventional'],
  ignores: [(message) => LEGACY_SUBJECTS.includes(message.split('\n')[0].trim())],
};
