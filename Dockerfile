# Railway-optimized Dockerfile with better caching
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Install minimal system dependencies
RUN apk add --no-cache \
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

# Copy application files
COPY . .

# Copy training data if exists
RUN if [ -d data ]; then \
    find data -name "*.traineddata" -exec cp {} /usr/share/tesseract-ocr/4/tessdata/ \; && \
    find data -name "*.traineddata" -exec cp {} /usr/share/tesseract-ocr/5/tessdata/ \; ; \
    fi

# Set proper permissions
RUN chmod -R 644 /usr/share/tesseract-ocr/*/tessdata/ && \
    chmod -R 755 /app/temp /app/temp-images /app/uploads

# Expose port
EXPOSE 8080

# Add Docker health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8080/ || exit 1

# Create startup script
RUN echo '#!/bin/sh\nnode scripts/migrate-production.js && node server.js' > /app/startup.sh && \
    chmod +x /app/startup.sh

# Start application
CMD ["/app/startup.sh"] 