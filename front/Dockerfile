# syntax=docker/dockerfile:1

# --- Build: exact dependencies from package-lock.json, then the browser and server bundles.
FROM node:24.22.1-alpine AS build
WORKDIR /build
COPY package.json package-lock.json ./
# The npm cache is kept between builds, outside the image.
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund
COPY . .
# The CHANGELOG of the repository, imported by the "Nouveautés" page as ../CHANGELOG.md (context
# "repo" of the Compose files: docker build --build-context repo=.. outside Compose)
COPY --from=repo CHANGELOG.md /CHANGELOG.md
RUN npm run build

# --- Runtime: Node.js and the built application only. The server bundle already contains its
# dependencies (Express, Angular), so there is no node_modules here.
FROM node:24.22.1-alpine
ENV NODE_ENV=production \
    PORT=4000
WORKDIR /app
COPY --from=build /build/dist/les-creations-de-yona/ ./
USER node

EXPOSE 4000
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=5 \
    CMD wget --quiet --spider http://127.0.0.1:4000/healthz || exit 1
CMD ["node", "server/server.mjs"]
