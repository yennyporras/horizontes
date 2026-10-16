# Horizontes: imagen única (API Fastify + SPA). Mismo patrón del IRMI (Coolify sobre el VPS de Hostinger).
# Build desde la raíz del repo:  docker build -f deploy/Dockerfile -t horizontes .
# En Coolify: Build Pack Dockerfile, ubicación /deploy/Dockerfile, base /.

# ─── Etapa 1: dependencias completas y build de la web ───────────────────────
FROM public.ecr.aws/docker/library/node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# typecheck + build de la SPA (participante, tablero y admin) hacia dist/web
RUN npx tsc --noEmit && npx vite build && mkdir -p shared

# ─── Etapa 2: solo dependencias de producción ────────────────────────────────
FROM public.ecr.aws/docker/library/node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# ─── Etapa 3: imagen de producción ───────────────────────────────────────────
FROM public.ecr.aws/docker/library/node:24-alpine AS production
WORKDIR /app

# El servidor corre TypeScript con tsx (sin paso de compilación, ver docs/STACK.md).
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY --from=build /app/server ./server
COPY --from=build /app/shared ./shared
COPY --from=build /app/data ./data
COPY --from=build /app/dist/web ./dist/web

# Usuario sin privilegios, dueño de /data (volumen persistente de la base SQLite).
RUN addgroup -S horizontes && adduser -S horizontes -G horizontes && \
    mkdir -p /data && chown -R horizontes:horizontes /data && \
    apk add --no-cache curl

VOLUME ["/data"]

ARG SOURCE_COMMIT=""
ENV SOURCE_COMMIT=${SOURCE_COMMIT}
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    TZ=America/Bogota \
    DB_PATH=/data/horizontes.sqlite

EXPOSE 3000
USER horizontes

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -qO- "http://localhost:${PORT:-3000}/api/health" || exit 1

CMD ["node_modules/.bin/tsx", "server/index.ts"]
