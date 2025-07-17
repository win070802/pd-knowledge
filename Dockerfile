# Multi-stage build để giảm kích thước image
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Cài đặt dependencies
RUN npm ci && npm cache clean --force

# Copy source code
COPY . .

# Stage 2: Runtime image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Cài đặt dependencies hệ thống cần thiết
RUN apk update && apk add --no-cache \
    imagemagick \
    tesseract-ocr \
    tesseract-ocr-data-vie \
    tesseract-ocr-data-eng \
    ghostscript \
    graphicsmagick \
    poppler-utils \
    python3

# Tạo thư mục cho tessdata
RUN mkdir -p /usr/share/tesseract-ocr/4/tessdata /usr/share/tesseract-ocr/5/tessdata

# Copy package files và node_modules từ builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Copy source code
COPY --from=builder /app/src ./src
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/services ./services
COPY --from=builder /app/*.js ./
COPY --from=builder /app/config ./config
COPY --from=builder /app/data ./data

# Copy training data nếu có
RUN if [ -d data ]; then \
    find data -name "*.traineddata" -exec cp {} /usr/share/tesseract-ocr/4/tessdata/ \; && \
    find data -name "*.traineddata" -exec cp {} /usr/share/tesseract-ocr/5/tessdata/ \; ; \
    fi

# Tạo thư mục cần thiết và set quyền
RUN mkdir -p temp temp-images uploads && \
    chmod -R 644 /usr/share/tesseract-ocr/*/tessdata/ && \
    chmod -R 755 temp temp-images uploads

# Expose port
EXPOSE ${PORT:-8080}

# Tạo startup script
RUN echo '#!/bin/sh\nnode scripts/migrate-production.js && node server.js' > /app/startup.sh && \
    chmod +x /app/startup.sh

# Health check disabled
# HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
#     CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-8080}/health || exit 1

# Start application
CMD ["/app/startup.sh"] 