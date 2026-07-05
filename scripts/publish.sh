#!/bin/sh
# Publish an already-built dist/ to the gh-pages branch (orphan commit via
# git plumbing; credentials come from the main repo). Called by deploy.sh.
set -eu

cd "$(dirname "$0")/.."
[ -f dist/index.html ] || { echo "dist/ is not built — run npm run build first"; exit 1; }

INDEX="$(pwd)/.git/gh-pages-index"
rm -f "$INDEX"
GIT_INDEX_FILE="$INDEX" git --work-tree=dist add -A
TREE=$(GIT_INDEX_FILE="$INDEX" git write-tree)
COMMIT=$(git commit-tree "$TREE" -m "deploy $(git rev-parse --short HEAD)")
rm -f "$INDEX"

git push -f origin "$COMMIT:refs/heads/gh-pages"
echo "Deployed -> https://darok69.github.io/studyflow/"
