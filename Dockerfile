# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Copy frontend dependency files
COPY package*.json ./
RUN npm ci

# Copy frontend source code
COPY . .

# Build frontend
RUN npm run build

# Stage 2: Setup Backend & Final Image
FROM node:20-alpine

WORKDIR /app

# Install system dependencies (if needed)
# RUN apk add --no-cache curl

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy backend dependency files
COPY server/package*.json ./

# Install production dependencies for backend
RUN npm ci --only=production

# Copy backend source code
COPY server/ .

# Create public directory
RUN mkdir public

# Copy built frontend assets from Stage 1 to backend public directory
COPY --from=frontend-builder /app/dist ./public

# Change ownership to non-root user
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Start server
CMD ["node", "index.js"]
