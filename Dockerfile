# ── Stage 1: Build Vite frontend ─────────────────────────────────
FROM node:20-alpine AS frontend
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# ── Stage 2: API Express + ficheros estáticos ─────────────────────
FROM node:20-alpine
WORKDIR /app
COPY deploy/api/package*.json ./
RUN npm install --omit=dev
COPY deploy/api/ .
COPY --from=frontend /app/dist ./public
EXPOSE 3001
CMD ["node", "server.js"]
