#!/usr/bin/env bash
set -euo pipefail
cd "$(cd "$(dirname "$0")" && pwd)"

if [ ! -d .git ]; then
  git init
  git remote remove origin >/dev/null 2>&1 || true
  git remote add origin https://github.com/waitholdthis/verdantprop.git
fi

branch=$(git branch --show-current)
if [ "$branch" != "main" ]; then
  git branch -M main || true
  branch=main
fi

git add -A
if git diff --cached --quiet; then
  echo 'No changes to commit.'
else
  git commit -m 'Add Verdant Properties redesigned site'
fi

git push --force origin "$branch"
