# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies first for better caching
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install all dependencies (including dev)
RUN npm install

# Copy source and build
COPY . .
RUN npx prisma generate --schema=./server/prisma/schema.prisma
RUN npm run build

# Prune dev dependencies for production
RUN npm prune --omit=dev

# Final production image
FROM node:20-alpine AS prod
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy node_modules from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Copy server files into server/ directory to match expected relative paths
WORKDIR /app/server
COPY --from=builder /app/server/dist ./dist
COPY --from=builder /app/server/package.json ./package.json
COPY --from=builder /app/server/prisma ./prisma

# Copy client files into client/ directory
WORKDIR /app/client
COPY --from=builder /app/client/dist ./dist

# Switch back to app root
WORKDIR /app

# Ensure the uploads directory exists and has correct permissions
RUN mkdir -p /app/uploads && chown node:node /app/uploads

EXPOSE 3000

# Use non-root user for security
USER node

# Start from server directory to ensure correct resolution of dist
CMD ["node", "server/dist/index.js"]
