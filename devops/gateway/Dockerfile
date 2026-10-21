# Single entry point of the application, locally (port 8000) and behind Coolify's proxy:
# /api/* goes to the backend, everything else to the Angular SSR server.
# The configuration is baked into the image: Coolify only ships the Compose file to the server,
# so a bind-mounted Caddyfile would not be there.
FROM caddy:2.11.7-alpine

COPY Caddyfile /etc/caddy/Caddyfile

# Healthy once the whole chain answers: gateway, then the SSR server behind it
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --start-interval=1s --retries=5 \
    CMD wget --quiet --spider http://127.0.0.1/healthz || exit 1
