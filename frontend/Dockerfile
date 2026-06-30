# ============================================================================
# BUILDER STAGE - Install dependencies and build static assets
# ============================================================================
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Copy dependency manifests for better layer caching
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile --production=false

# Copy source code
COPY . .

# Build production-optimized static assets
RUN bun run build

# ============================================================================
# RUNNER STAGE - Serve static files with minimal runtime
# ============================================================================
FROM oven/bun:1-alpine AS runner

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user for security
RUN addgroup -g 1000 appuser && \
    adduser -D -u 1000 -G appuser appuser

WORKDIR /app

# Copy only the built static assets from builder
COPY --from=builder --chown=appuser:appuser /app/dist ./dist

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 5173

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:5173 || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Serve static files
CMD ["bun", "x", "serve", "-s", "dist", "-l", "5173"]