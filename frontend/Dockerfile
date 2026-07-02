# ============================================================================
# BUILDER STAGE - Install dependencies and build static assets
# ============================================================================
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Copy dependency manifests for better layer caching
COPY package.json bun.lock* ./

# Install project dependencies
RUN bun install

# Fix: Install serve locally as a project dependency to guarantee it is accessible
RUN bun add serve

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

WORKDIR /app

# Copy only the built static assets from builder
COPY --from=builder --chown=bun:bun /app/dist ./dist

# Fix: Copy the local node_modules containing the 'serve' package
COPY --from=builder --chown=bun:bun /app/node_modules ./node_modules

# Switch to the built-in non-root user
USER bun

# Expose port
EXPOSE 5173

# Health check using the local binary execution
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD ./node_modules/.bin/serve -s dist -l 5173 --test || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Fix: Directly execute the serve binary from your local project folder
CMD ["./node_modules/.bin/serve", "-s", "dist", "-l", "5173"]
