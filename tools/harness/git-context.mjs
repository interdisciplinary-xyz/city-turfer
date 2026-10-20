/**
 * Git facts the Claude Code hooks need: current branch and the active integration branch
 * (the newest scope/vX.Y.Z, local or on origin). Never throws: outside a repo it returns {}.
 */
import { execFileSync } from 'node:child_process';

function git(args, cwd) {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 3000,
    }).trim();
  } catch {
    return '';
  }
}

const semver = (v) => v.split('.').map(Number);
const newer = (a, b) => {
  const [x, y] = [semver(a), semver(b)];
  for (let i = 0; i < 3; i++) {
    if (x[i] !== y[i]) {
      return x[i] > y[i];
    }
  }
  return false;
};

/** Newest `scope/vX.Y.Z` among branch names (with or without an `origin/` prefix). */
export function newestScope(refs) {
  let best = null;
  for (const ref of refs) {
    const m = ref.match(/(?:^|\/)scope\/v(\d+\.\d+\.\d+)$/);
    if (m && (!best || newer(m[1], best))) {
      best = m[1];
    }
  }
  return best ? `scope/v${best}` : undefined;
}

/** @returns {{ branch?: string, activeScope?: string, dirty?: number }} */
export function gitContext(cwd) {
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd) || undefined;
  if (!branch) {
    return {};
  }
  const refs = git(['for-each-ref', '--format=%(refname:short)', 'refs/heads/scope', 'refs/remotes/origin/scope'], cwd)
    .split('\n')
    .filter(Boolean);
  const dirty = git(['status', '--porcelain'], cwd).split('\n').filter(Boolean).length;
  return { branch, activeScope: newestScope(refs), dirty };
}
