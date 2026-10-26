/**
 * Git facts the Claude Code hooks need: current branch and the active integration branch
 * (the newest scope/vX.Y.Z, local or on origin). Never throws: outside a repo it returns {}.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

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

/** Branch checked out in `dir` (`HEAD` when detached), or undefined outside a repository. */
export function gitBranch(dir) {
  return git(['rev-parse', '--abbrev-ref', 'HEAD'], dir) || undefined;
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

/**
 * Where an edited file sits in this repository: its checkout (the main one or a worktree) and its
 * path there, or null when it is outside the repository. The edit hooks judge that repo-relative
 * path: CLAUDE_PROJECT_DIR is the folder the session started in, while Claude also edits files in
 * worktrees elsewhere, which the hooks used to skip.
 * @param {string} file  path of the edited file (it may not exist yet)
 * @param {string} projectDir  the session's project folder
 * @returns {{ root: string, rel: string } | null}
 */
export function checkoutOf(file, projectDir) {
  const abs = resolve(projectDir, file);
  let dir = dirname(abs);
  while (!existsSync(dir) && dirname(dir) !== dir) {
    dir = dirname(dir);
  }
  const top = git(['rev-parse', '--show-toplevel'], dir);
  const common = (cwd) => git(['rev-parse', '--path-format=absolute', '--git-common-dir'], cwd);
  const mine = common(projectDir);
  if (!top || !mine || common(top) !== mine) {
    return null;
  }
  // Compare real paths (macOS: /tmp → /private/tmp); the file itself may not exist yet.
  const real = join(realpathSync(dir), relative(dir, abs));
  return { root: top, rel: relative(realpathSync(top), real).split(sep).join('/') };
}
