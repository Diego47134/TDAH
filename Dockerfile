FROM node:22-slim
WORKDIR /app
COPY package.json ./
COPY src ./src
COPY public ./public
COPY protocol ./protocol
COPY prompts ./prompts
ENV HOST=0.0.0.0 PORT=3000 DB_PATH=/app/data/tdah.sqlite NODE_ENV=production
VOLUME ["/app/data"]
EXPOSE 3000
CMD ["node", "--disable-warning=ExperimentalWarning", "src/server.js"]
