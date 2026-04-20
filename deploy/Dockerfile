# ── Stage 1: build Vite ──────────────────────────────────────────
FROM node:20-alpine AS builder

ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# ── Stage 2: nginx sirve el build estático ───────────────────────
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY deploy/nginx-static.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
