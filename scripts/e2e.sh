#!/usr/bin/env bash
# Runs the browser tests against a fresh, throwaway copy of the stack (empty database, port 8081).
set -euo pipefail
cd "$(dirname "$0")/.."
export RPANEL_PORT="${RPANEL_PORT:-8081}"
project=rpanel-e2e
docker compose -p "$project" down -v --remove-orphans >/dev/null 2>&1 || true
trap 'docker compose -p "$project" down -v --remove-orphans >/dev/null 2>&1 || true' EXIT
docker compose -p "$project" up -d --build --wait
RPANEL_URL="http://127.0.0.1:${RPANEL_PORT}" npx playwright test "$@"
