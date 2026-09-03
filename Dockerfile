# syntax=docker/dockerfile:1

# ---- deps: installer alle avhengigheter i monorepoet ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/database/package.json packages/database/package.json
RUN npm ci

# ---- builder: generer Prisma-klient og bygg Next.js ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/database/node_modules ./packages/database/node_modules
COPY . .

# DATABASE_URL trengs ikke for å generere klienten, kun for faktiske spørringer,
# men Prisma krever at variabelen er satt (til hva som helst) for at `generate` skal kjøre.
ENV DATABASE_URL="postgresql://placeholder:placeholder@placeholder:5432/placeholder"
RUN npm run db:generate
RUN npm run build -w @mikkemus/web

# ---- runner: minimalt runtime-image ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Skiperator krever at container-prosessen kjører som UID 150, se
# https://github.com/kartverket/skiperator#prerequisites
RUN addgroup -g 150 skiperator && adduser -D -u 150 -G skiperator skiperator

# Next.js sitt "standalone"-output for et npm-workspace-monorepo beholder
# mappestrukturen fra repo-roten, så server.js havner under apps/web/.
COPY --from=builder --chown=150:150 /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=150:150 /app/apps/web/.next/standalone ./
COPY --from=builder --chown=150:150 /app/apps/web/.next/static ./apps/web/.next/static

USER 150

# Port under 1024 krever root, og UID 150 er ikke root – derfor 8080, ikke 80.
ENV PORT=8080
EXPOSE 8080

CMD ["node", "apps/web/server.js"]
