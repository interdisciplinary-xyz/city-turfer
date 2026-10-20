#!/usr/bin/env bash
# PostToolUse hook: run Prettier on the file Claude just edited, so `pnpm run standard:format`
# (Prettier check in ci:quality) never fails on Claude's output. .prettierignore still applies.
file=$(node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).tool_input?.file_path??"")}catch{}})')
case "$file" in
  *.ts|*.tsx|*.js|*.mjs|*.cjs|*.json|*.md|*.yml|*.yaml|*.css) ;;
  *) exit 0 ;;
esac
root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
[[ -x "$root/node_modules/.bin/prettier" ]] || exit 0
"$root/node_modules/.bin/prettier" --write --log-level warn "$file" >&2 || true
exit 0
