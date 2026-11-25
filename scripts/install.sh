#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
git submodule sync --recursive
git submodule update --init --recursive
node scripts/verify-upstreams.mjs
(cd engine && HUSKY=0 npm ci)
# Content has no package.json or separate dependency installation.
# Vale's Node HTTPS downloader needs Node 24 proxy support in managed Cloud.
# On hosts without proxy variables this has no effect on the download destination.
(cd rs2b0t && NODE_USE_ENV_PROXY="${NODE_USE_ENV_PROXY:-1}" bun install --frozen-lockfile)
node scripts/verify-upstreams.mjs
