FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 RADAR_DATABASE_PATH=/app/data/radar.sqlite
COPY --chown=node:node package.json ./
COPY --chown=node:node server ./server
COPY --chown=node:node database ./database
COPY --chown=node:node dashboard ./dashboard
COPY --chown=node:node scripts ./scripts
COPY --chown=node:node samples ./samples
COPY --chown=node:node config/operations.example.json ./config/operations.example.json
RUN mkdir -p /app/data/inbox /app/data/backups /app/data/secrets && chown -R node:node /app/data
USER node
EXPOSE 3000
CMD ["npm","start"]
