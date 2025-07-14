# Use Node.js 18 Alpine for smaller image size
FROM node:18-alpine

# Install system dependencies for PDF processing and OCR
RUN apk add --no-cache \
    imagemagick \
    imagemagick-dev \
    tesseract-ocr \
    tesseract-ocr-data-vie \
    tesseract-ocr-data-eng \
    ghostscript \
    graphicsmagick \
    poppler-utils \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# Create tessdata directory and set permissions
RUN mkdir -p /usr/share/tesseract-ocr/4/tessdata /usr/share/tesseract-ocr/5/tessdata

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY . .

# Copy Tesseract language data to multiple locations for compatibility
COPY eng.traineddata /usr/share/tesseract-ocr/4/tessdata/
COPY vie.traineddata /usr/share/tesseract-ocr/4/tessdata/
COPY eng.traineddata /usr/share/tesseract-ocr/5/tessdata/
COPY vie.traineddata /usr/share/tesseract-ocr/5/tessdata/

# Create necessary directories with proper permissions
RUN mkdir -p uploads temp-images temp logs \
    && chmod -R 755 uploads temp-images temp logs

# Set environment variables for production
ENV NODE_ENV=production
ENV TESSDATA_PREFIX=/usr/share/tesseract-ocr/4/tessdata
ENV MAGICK_CONFIGURE_PATH=/etc/ImageMagick-6
ENV GHOSTSCRIPT_FONT_PATH=/usr/share/fonts

# ImageMagick security policy - allow PDF processing
RUN sed -i 's/rights="none" pattern="PDF"/rights="read|write" pattern="PDF"/' /etc/ImageMagick-6/policy.xml || true
RUN sed -i 's/rights="none" pattern="PS"/rights="read|write" pattern="PS"/' /etc/ImageMagick-6/policy.xml || true

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8080/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["npm", "start"] 