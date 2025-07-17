# Storage Strategy Comparison

**Author:** Tran Minh Khoi, IT Department, Phat Dat Holdings

## Options
- **Local Storage:** Files saved in `/uploads` on server
- **Cloud Storage (Google Cloud):** Files saved in GCS bucket

## Current Setup
- Production uses Google Cloud Storage (recommended)
- Local/dev can use local storage for testing

## Pros & Cons
- **Cloud:**
  - Scalable, reliable, secure
  - Accessible from anywhere
  - Requires Google credentials
- **Local:**
  - Simple, fast for dev
  - Not scalable or reliable for production

## Recommendation
- Use Google Cloud Storage for all production deployments

---
**Contact: Tran Minh Khoi, IT Department, Phat Dat Holdings** 