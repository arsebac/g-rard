# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies first for better caching
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Use --include=dev to ensure we have build tools
RUN npm install

# Copy source and build
COPY . .
RUN npx prisma generate --schema=./server/prisma/schema.prisma
RUN npm run build

# Prune dev dependencies for production
RUN npm prune --omit=dev && npm prune --omit=dev -w server && npm prune --omit=dev -w client

# Final production image
FROM node:20-alpine AS prod
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy only what's needed from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/node_modules ./server/node_modules
COPY --from=builder /app/server/package.json ./server/package.json
COPY --from=builder /app/server/prisma ./server/prisma
COPY --from=builder /app/client/dist ./client/dist

# Ensure the uploads directory exists and has correct permissions
RUN mkdir -p /app/uploads && chown node:node /app/uploads

EXPOSE 3000

# Use non-root user for security
USER node

CMD ["node", "server/dist/index.js"]
