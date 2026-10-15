FROM node:24-slim
WORKDIR /app
COPY package.json package-lock.json server.js ./
COPY src ./src
COPY public ./public
COPY protocol ./protocol
COPY prompts ./prompts
ENV HOST=0.0.0.0 PORT=3000 DB_PATH=/data/tdah.sqlite NODE_ENV=production
VOLUME ["/data"]
EXPOSE 3000
CMD ["node", "--disable-warning=ExperimentalWarning", "server.js"]
