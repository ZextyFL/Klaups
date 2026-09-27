#!/usr/bin/env sh
# macOS/Linux equivalent of start-worker.bat.
set -e
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Node.js 20+ is required: https://nodejs.org"; exit 1; }
if [ ! -f .env ]; then
  cp .env.example .env
  echo "First run: fill in SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in apps/worker/.env, then run this again."
  exit 0
fi
[ -d node_modules ] || npm install --no-audit --no-fund
echo "Klaups LIVE connector is running. Keep this open while you stream (Ctrl+C to stop)."
exec npm start
