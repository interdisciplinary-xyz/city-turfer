#!/usr/bin/env bash
# PostToolUse hook: format TS/TSX files Claude edits, once Prettier is installed.
# No-op before the app is scaffolded.
file=$(node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).tool_input?.file_path??"")}catch{}})')
case "$file" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac
root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
[[ -x "$root/node_modules/.bin/prettier" ]] || exit 0
"$root/node_modules/.bin/prettier" --write --log-level warn "$file" >&2 || true
exit 0
