#!/bin/bash
# Deploy: build → Cloudflare Pages (Ozvåag account, free tier). Any failure stops the ship.
set -e
cd "$(dirname "$0")"
node scripts/build.mjs studies/iberia/study.json
npx --yes wrangler pages deploy web --project-name=layercake --commit-dirty=true
