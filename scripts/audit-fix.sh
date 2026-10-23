#!/usr/bin/env bash
# Apply `pnpm audit --fix`, then pin each new override to the minimum
# patched version so a range like `>=15.5.28` cannot float to the next major.
set -euo pipefail

before="$(mktemp)"
if [[ -f pnpm-workspace.yaml ]]; then
  cp pnpm-workspace.yaml "$before"
else
  : > "$before"
fi

pnpm audit --fix override
node scripts/pin-audit-overrides.mjs pnpm-workspace.yaml "$before"
pnpm install --no-frozen-lockfile
