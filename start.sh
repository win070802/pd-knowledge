#!/bin/bash
echo "Starting application with Railway startup script"
node scripts/migrate-production.js
node server.js 