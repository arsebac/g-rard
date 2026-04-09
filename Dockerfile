FROM node:20-alpine AS base
WORKDIR /app

# Install deps
COPY package.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/
RUN npm install

# Build client
COPY client/ ./client/
RUN npm run build -w client

# Build server
COPY server/ ./server/
RUN npx prisma generate --schema=./server/prisma/schema.prisma
RUN npm run build -w server

# Production image
FROM node:20-alpine AS prod
WORKDIR /app
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/server/dist ./server/dist
COPY --from=base /app/server/node_modules ./server/node_modules
COPY --from=base /app/client/dist ./client/dist
COPY server/package.json ./server/
COPY server/prisma ./server/prisma

EXPOSE 3000
CMD ["node", "server/dist/index.js"]
