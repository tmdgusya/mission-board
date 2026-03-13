#!/bin/bash
set -e

# Idempotent environment setup for mission-board

# Install dependencies if node_modules doesn't exist or package.json changed
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
  echo "Installing dependencies..."
  bun install
fi

# Create data directory for SQLite database
mkdir -p data

# Ensure database directory is writable
chmod 755 data

echo "Environment setup complete."
