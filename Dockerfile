# Stage 1: Base & Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache openssl
WORKDIR /app

# Copy root and workspace package files
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install all dependencies
RUN npm install

# Stage 2: Build
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app

# Copy node_modules from deps
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/server/package.json ./server/package.json
COPY --from=deps /app/client/package.json ./client/package.json

# Copy source code
COPY . .

# Generate Prisma and build
RUN npx prisma generate --schema=./server/prisma/schema.prisma
RUN npm run build

# Prune dev dependencies
RUN npm prune --omit=dev

# Stage 3: Production
FROM node:20-alpine AS prod
RUN apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy only production node_modules
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Copy server files
WORKDIR /app/server
COPY --from=builder /app/server/dist ./dist
COPY --from=builder /app/server/package.json ./package.json
COPY --from=builder /app/server/prisma ./prisma

# Copy client files
WORKDIR /app/client
COPY --from=builder /app/client/dist ./dist

# Switch back to app root
WORKDIR /app

# Ensure uploads directory exists
RUN mkdir -p /app/uploads && chown node:node /app/uploads

EXPOSE 3000
USER node

CMD ["node", "server/dist/index.js"]
