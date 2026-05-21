#!/bin/sh
set -e

# Inject runtime API URL into config.js so the built JS can read it
# VITE_API_URL is set as an env var in Railway at runtime (not baked at build time)
API_URL="${VITE_API_URL:-http://localhost:8000}"
echo "window.__API_URL__ = '${API_URL}';" > /usr/share/nginx/html/config.js
echo "Frontend config: API_URL=${API_URL}"

exec nginx -g "daemon off;"
