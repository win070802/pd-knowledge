#!/bin/bash

echo "🔧 Installing system dependencies for PDF Knowledge Management System"
echo "=================================================================="

# Check if we're on macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "📱 Detected macOS"
    
    # Check if Homebrew is installed
    if ! command -v brew &> /dev/null; then
        echo "❌ Homebrew is not installed. Please install Homebrew first:"
        echo "   /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
        exit 1
    fi
    
    # Install ImageMagick (required for pdf2pic)
    echo "📦 Installing ImageMagick..."
    brew install imagemagick
    
    # Install Tesseract (for OCR)
    echo "📦 Installing Tesseract OCR..."
    brew install tesseract
    
    # Install Vietnamese language pack for Tesseract
    echo "📦 Installing Vietnamese language pack for Tesseract..."
    brew install tesseract-lang
    
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "🐧 Detected Linux"
    
    # Check if apt is available (Ubuntu/Debian)
    if command -v apt &> /dev/null; then
        echo "📦 Installing ImageMagick and Tesseract..."
        sudo apt update
        sudo apt install -y imagemagick tesseract-ocr tesseract-ocr-vie
    
    # Check if yum is available (CentOS/RHEL)
    elif command -v yum &> /dev/null; then
        echo "📦 Installing ImageMagick and Tesseract..."
        sudo yum install -y ImageMagick tesseract tesseract-langpack-vie
    
    # Check if dnf is available (Fedora)
    elif command -v dnf &> /dev/null; then
        echo "📦 Installing ImageMagick and Tesseract..."
        sudo dnf install -y ImageMagick tesseract tesseract-langpack-vie
    
    else
        echo "❌ Unsupported Linux distribution. Please install ImageMagick and Tesseract manually."
        exit 1
    fi
    
else
    echo "❌ Unsupported operating system: $OSTYPE"
    echo "Please install ImageMagick and Tesseract manually."
    exit 1
fi

echo ""
echo "✅ System dependencies installed successfully!"
echo ""
echo "🧪 Testing installations..."

# Test ImageMagick
if command -v convert &> /dev/null; then
    echo "✅ ImageMagick: $(convert -version | head -n 1)"
else
    echo "❌ ImageMagick installation failed"
fi

# Test Tesseract
if command -v tesseract &> /dev/null; then
    echo "✅ Tesseract: $(tesseract --version | head -n 1)"
    echo "📝 Available languages: $(tesseract --list-langs | grep -E '(eng|vie)' | tr '\n' ' ')"
else
    echo "❌ Tesseract installation failed"
fi

echo ""
echo "🚀 You can now run the PDF Knowledge Management System with full OCR support!"
echo ""
echo "Next steps:"
echo "1. Create .env file with your configuration"
echo "2. Run: npm start"
echo "3. Upload scanned PDF documents - they will be processed with OCR!" 