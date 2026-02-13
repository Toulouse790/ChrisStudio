# ── Build stage ──────────────────────────────────────────
FROM node:20-slim AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts
COPY tsconfig.json ./
COPY src/ ./src/
RUN npx tsc

# ── Runtime stage ────────────────────────────────────────
FROM node:20-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts

COPY --from=builder /app/dist ./dist
COPY public/ ./public/

RUN mkdir -p output/scripts output/audio output/videos output/assets data

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>{if(!r.ok)throw 1}).catch(()=>process.exit(1))"

USER node
CMD ["node", "dist/server.js"]
