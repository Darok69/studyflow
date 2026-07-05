#!/bin/sh
# Deploy StudyFlow to GitHub Pages (branch-based: gh-pages).
# Usage: npm run deploy
set -eu

REPO_URL="https://github.com/Darok69/studyflow.git"
BASE="/studyflow/"

cd "$(dirname "$0")/.."

STUDYFLOW_BASE="$BASE" npm run build
touch dist/.nojekyll

cd dist
rm -rf .git
git init -q -b gh-pages
git add -A
git -c user.name="deploy" -c user.email="deploy@studyflow.local" commit -qm "deploy $(date +%Y-%m-%d_%H%M)"
git push -f "$REPO_URL" gh-pages
rm -rf .git

echo "Deployed → https://darok69.github.io/studyflow/"
