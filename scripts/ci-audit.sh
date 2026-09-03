#!/usr/bin/env bash
# pnpm audit against npm's /-/npm/v1/security/audits endpoint.
# That API flakes with ERR_SOCKET_TIMEOUT; keep the high/critical gate
# but do not fail the whole CI run when the registry is unreachable.
set -u

max_attempts="${AUDIT_ATTEMPTS:-3}"
# Keep each pnpm retry short so a dead endpoint does not sit for a minute.
export npm_config_fetch_retries="${npm_config_fetch_retries:-1}"
export npm_config_fetch_retry_mintimeout="${npm_config_fetch_retry_mintimeout:-2000}"
export npm_config_fetch_retry_maxtimeout="${npm_config_fetch_retry_maxtimeout:-8000}"
export npm_config_fetch_timeout="${npm_config_fetch_timeout:-20000}"

attempt=1
while [ "$attempt" -le "$max_attempts" ]; do
  echo "pnpm audit --audit-level=high (attempt ${attempt}/${max_attempts})"
  set +e
  output="$(pnpm audit --audit-level=high 2>&1)"
  code=$?
  set -e
  printf '%s\n' "$output"

  if [ "$code" -eq 0 ]; then
    exit 0
  fi

  if printf '%s' "$output" | grep -Eq 'ERR_SOCKET_TIMEOUT|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|503 Service|502 Bad Gateway|ECONNREFUSED'; then
    if [ "$attempt" -lt "$max_attempts" ]; then
      sleep_for=$((attempt * 8))
      echo "npm audit registry timed out; retrying in ${sleep_for}s…"
      sleep "$sleep_for"
      attempt=$((attempt + 1))
      continue
    fi
    echo "::warning::pnpm audit could not reach the npm registry after ${max_attempts} attempts. Skipping the gate for this run."
    exit 0
  fi

  exit "$code"
done
