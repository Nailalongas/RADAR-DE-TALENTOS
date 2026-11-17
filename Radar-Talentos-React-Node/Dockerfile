FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi
COPY . .
RUN npm run build
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 RADAR_DATABASE_PATH=/app/data/radar.sqlite
COPY --from=build --chown=node:node /app /app
RUN mkdir -p /app/data/inbox /app/data/backups /app/data/secrets && chown -R node:node /app/data
USER node
EXPOSE 3000
CMD ["npm","start"]
