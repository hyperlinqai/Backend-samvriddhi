# ─── Stage 1: Dependencies ────────────────────────────────
FROM node:22-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --only=production && \
    cp -R node_modules /tmp/prod_modules && \
    npm ci

# ─── Stage 2: Build ──────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# ─── Stage 3: Production ─────────────────────────────────
FROM node:22-alpine AS production

# Security: run as non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

WORKDIR /app

# Copy production dependencies
COPY --from=deps /tmp/prod_modules ./node_modules

# Copy built application
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY package.json ./

# Create directories for logs and uploads
RUN mkdir -p logs uploads && \
    chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start application
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
