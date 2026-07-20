# ── ArkStream — Production Dockerfile ─────────────────────────────────────────
# Multi-stage build: installs, builds frontend + API, produces a lean runner.
# Used by Railway (Docker deployment) or any OCI-compatible platform.
#
# NOTE: uses -slim (Debian/glibc), not -alpine (musl). The workspace's pnpm
# overrides explicitly exclude musl-targeted native binaries (rollup,
# lightningcss, esbuild, tailwind oxide), so Alpine will fail to resolve them.

# ── Stage 1: builder ──────────────────────────────────────────────────────────
FROM node:22-slim AS builder

RUN npm install -g pnpm@10
WORKDIR /app

# Workspace manifests first (cache layer)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.json tsconfig.base.json ./

# Library sources
COPY lib/ ./lib/

# Artifact sources
COPY artifacts/arkstream/  ./artifacts/arkstream/
COPY artifacts/api-server/ ./artifacts/api-server/

# Install all workspace dependencies
RUN pnpm install --frozen-lockfile

# Build Vite frontend (output → artifacts/arkstream/dist/public)
ENV BASE_PATH=/ NODE_ENV=production
RUN pnpm --filter @workspace/arkstream run build

# Build Express API (output → artifacts/api-server/dist/)
RUN pnpm --filter @workspace/api-server run build

# ── Stage 2: runner ───────────────────────────────────────────────────────────
FROM node:22-slim AS runner

WORKDIR /app

# Only copy the compiled outputs — no source, no dev deps
COPY --from=builder /app/artifacts/api-server/dist  ./artifacts/api-server/dist
COPY --from=builder /app/artifacts/arkstream/dist/public ./artifacts/arkstream/dist/public

ENV NODE_ENV=production
EXPOSE 8080

# node itself (not wget/curl) does the healthcheck — Debian-slim doesn't
# ship either of those by default, but node is guaranteed to be here.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/api/healthz', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
