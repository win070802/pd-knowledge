# Railway-optimized Dockerfile with better caching
FROM node:18-alpine

# Set working directory early
WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install Node.js dependencies first (cached layer)
RUN npm ci --only=production && npm cache clean --force

# Install system dependencies in separate layers for better caching
RUN apk add --no-cache \
    imagemagick \
    tesseract-ocr \
    tesseract-ocr-data-vie \
    tesseract-ocr-data-eng \
    ghostscript \
    graphicsmagick \
    poppler-utils

# Lightweight additional tools
RUN apk add --no-cache \
    python3 \
    make \
    g++

# Create tessdata directory
RUN mkdir -p /usr/share/tesseract-ocr/4/tessdata /usr/share/tesseract-ocr/5/tessdata

# Copy application files
COPY . .

# Copy training data if exists
RUN if [ -d data ]; then \
    find data -name "*.traineddata" -exec cp {} /usr/share/tesseract-ocr/4/tessdata/ \; && \
    find data -name "*.traineddata" -exec cp {} /usr/share/tesseract-ocr/5/tessdata/ \; ; \
    fi

# Set proper permissions
RUN chmod -R 644 /usr/share/tesseract-ocr/*/tessdata/

# Create necessary directories
RUN mkdir -p temp temp-images uploads

# Expose port
EXPOSE ${PORT:-3000}

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:${PORT:-3000}/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Setup script to run before starting the application
RUN echo '#!/bin/sh\nnode scripts/create-database.js && node scripts/migrate-production.js && node server.js' > /app/startup.sh && \
    chmod +x /app/startup.sh

# Start application with setup
CMD ["/app/startup.sh"] 