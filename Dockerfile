# Railway-optimized Dockerfile with multi-stage build
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci && npm cache clean --force

# Copy source code
COPY . .

# Stage 2: Production image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apk update && apk add --no-cache \
    imagemagick \
    tesseract-ocr \
    tesseract-ocr-data-vie \
    tesseract-ocr-data-eng \
    ghostscript \
    poppler-utils \
    python3 \
    curl

# Create directories
RUN mkdir -p /usr/share/tesseract-ocr/4/tessdata \
    /usr/share/tesseract-ocr/5/tessdata \
    /app/temp \
    /app/temp-images \
    /app/uploads

# Copy package files and dependencies from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Copy application files
COPY --from=builder /app/src ./src
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/services ./services
COPY --from=builder /app/*.js ./
COPY --from=builder /app/config ./config
COPY --from=builder /app/data ./data

# Copy training data if exists
RUN if [ -d data ]; then \
    find data -name "*.traineddata" -exec cp {} /usr/share/tesseract-ocr/4/tessdata/ \; && \
    find data -name "*.traineddata" -exec cp {} /usr/share/tesseract-ocr/5/tessdata/ \; ; \
    fi

# Set proper permissions
RUN chmod -R 644 /usr/share/tesseract-ocr/*/tessdata/ && \
    chmod -R 755 /app/temp /app/temp-images /app/uploads

# Expose port
EXPOSE ${PORT:-8080}

# Create startup script
RUN echo '#!/bin/sh\nnode scripts/migrate-production.js && node server.js' > /app/startup.sh && \
    chmod +x /app/startup.sh

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8080}/simple-health || exit 1

# Start application
CMD ["/app/startup.sh"] 