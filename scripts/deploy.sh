#!/bin/sh
# Deploy StudyFlow to GitHub Pages: build with the project base path, then
# publish dist/ to the gh-pages branch. Usage: npm run deploy
set -eu

cd "$(dirname "$0")/.."

STUDYFLOW_BASE="/studyflow/" npm run build
touch dist/.nojekyll

sh scripts/publish.sh
