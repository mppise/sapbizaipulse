# Stage 1 — Build frontend (Vite)
FROM node:20-slim AS ui-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY src/ui ./src/ui
COPY tsconfig.json ./
RUN npm run ui:build

# Stage 2 — Compile backend (TypeScript)
FROM node:20-slim AS ts-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY src ./src
COPY tsconfig.json ./
RUN npx tsc

# Stage 3 — Production image
FROM node:20-slim AS production
WORKDIR /app

# Install Playwright Chromium with system deps
COPY package*.json ./
RUN npm ci --omit=dev && npx playwright install chromium --with-deps

# Copy compiled backend
COPY --from=ts-builder /app/dist ./dist

# Copy built frontend into expected static path
COPY --from=ui-builder /app/dist/ui ./dist/ui

# Copy prompt files (resolved at runtime via __dirname → dist/ai/prompts/)
COPY src/ai/prompts ./dist/ai/prompts

# Copy topic config (loaded at runtime from _cfg/)
COPY _cfg/ai-topics.md ./_cfg/ai-topics.md

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "dist/server.js"]
