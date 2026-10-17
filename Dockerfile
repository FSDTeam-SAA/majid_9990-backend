# ==========================================
# Stage 1: Build stage (compile TypeScript)
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install all dependencies (including devDependencies needed for typescript compile)
RUN npm ci

# Copy the rest of the application source code
COPY . .

# Build TypeScript to JavaScript (/dist directory)
RUN npm run build

# Remove development dependencies to keep only production packages
RUN npm prune --production


# ==========================================
# Stage 2: Production Runtime stage
# ==========================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Create non-root user for security
USER node

# Copy production node_modules from builder stage
COPY --chown=node:node --from=builder /app/node_modules ./node_modules

# Copy package.json
COPY --chown=node:node --from=builder /app/package*.json ./

# Copy compiled JavaScript output
COPY --chown=node:node --from=builder /app/dist ./dist

# Copy src for runtime swagger documentation parser
COPY --chown=node:node --from=builder /app/src ./src

# Copy trained data/assets if needed at runtime
COPY --chown=node:node --from=builder /app/eng.traineddata ./eng.traineddata
COPY --chown=node:node --from=builder /app/assets ./assets
COPY --chown=node:node --from=builder /app/swagger-output.json ./swagger-output.json

# Default backend port (can be overridden via environment variables)
EXPOSE 5000

# Start production server
CMD ["node", "dist/server.js"]
