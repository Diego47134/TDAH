FROM node:24-slim
WORKDIR /app
COPY package.json package-lock.json server.js ./
COPY src ./src
COPY public ./public
COPY protocol ./protocol
COPY prompts ./prompts
# La clave de cifrado va en un volumen distinto al de los datos (o en la variable TDAH_CLAVE_CIFRADO).
ENV HOST=0.0.0.0 PORT=3000 DB_PATH=/data/tdah.sqlite NODE_ENV=production TDAH_ARCHIVO_CLAVE=/clave/.tdah-clave-cifrado
VOLUME ["/data", "/clave"]
EXPOSE 3000
CMD ["node", "--disable-warning=ExperimentalWarning", "server.js"]
