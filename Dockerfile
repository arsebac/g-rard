# Stage 1: Base & Dependencies
FROM node:22-alpine AS deps
RUN apk add --no-cache openssl
WORKDIR /app

# Copy root and workspace package files
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/
COPY mcp/package*.json ./mcp/

# Install all dependencies
RUN npm ci

# Stage 2: Build
FROM node:22-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app

# Copy node_modules from deps, including workspace-level ones (npm nests a
# dependency under server/ or client/ when its version conflicts with the root)
COPY --from=deps /app ./

# Copy source code
COPY . .

# Generate Prisma and build
RUN npx prisma generate --schema=./server/prisma/schema.prisma
RUN npm run build

# Prune dev dependencies
RUN npm prune --omit=dev

# Stage 3: Production
FROM node:22-alpine AS prod
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
COPY --from=builder /app/server/node_modules ./node_modules
COPY --from=builder /app/server/package.json ./package.json
COPY --from=builder /app/server/prisma ./prisma

# Copy client files
WORKDIR /app/client
COPY --from=builder /app/client/dist ./dist

# Copy mcp files
WORKDIR /app/mcp
COPY --from=builder /app/mcp/dist ./dist
COPY --from=builder /app/mcp/package.json ./package.json

# Switch back to app root
WORKDIR /app

# Ensure uploads directory exists
RUN mkdir -p /app/uploads && chown node:node /app/uploads

EXPOSE 3000
USER node

CMD ["node", "server/dist/index.js"]
