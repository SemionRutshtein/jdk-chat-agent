#!/bin/sh
set -e

# Use Railway-injected PORT if present; fall back to 3000 for local
export PORT="${PORT:-3000}"

# Inject runtime API URL into config.js so the built JS can read it
# VITE_API_URL is set as an env var in Railway at runtime (not baked at build time)
API_URL="${VITE_API_URL:-http://localhost:8000}"
echo "window.__API_URL__ = '${API_URL}';" > /usr/share/nginx/html/config.js
echo "Frontend config: PORT=${PORT} · API_URL=${API_URL}"

# Render nginx template with PORT substituted
envsubst '${PORT}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf

exec nginx -g "daemon off;"
