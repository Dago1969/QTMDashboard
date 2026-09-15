#!/bin/sh
set -e

# Generate env.js in the served root so the frontend can read runtime env vars
cat <<EOF > /usr/share/nginx/html/env.js
window.NG_APP_API_BASE_URL = "${NG_APP_API_BASE_URL:-/api}";
window.NG_APP_TICKET_API_BASE_URL = "${NG_APP_TICKET_API_BASE_URL:-/api/ticket}";
EOF

exec "$@"
