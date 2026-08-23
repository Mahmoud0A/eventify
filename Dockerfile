# =============================================================================
# Eventify — production image (two-stage).
#
# Build model note: tsconfig.json intentionally uses noEmit +
# allowImportingTsExtensions (the codebase imports real .ts files), so there is
# no tsc dist/ emit step. The build stage validates types (tsc --noEmit) and
# generates the Prisma client; the runtime stage executes TypeScript directly
# with Node's loader: `node --import tsx src/server.ts`. Because the entry
# process IS node (no shell/tsx parent wrapper), SIGTERM reaches it directly.
# =============================================================================

# ---- Stage 1: deps + prisma generate + type validation ----------------------
FROM node:24-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Prisma client must exist BEFORE type validation (src/generated + src/lib
# import from .prisma/client).
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run typecheck

# ---- Stage 2: runtime -------------------------------------------------------
FROM node:24-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY prisma ./prisma
COPY prisma.config.ts ./
COPY --from=build /app/.prisma ./.prisma
COPY src ./src

USER node
EXPOSE 3000
CMD ["node", "--import", "tsx", "src/server.ts"]