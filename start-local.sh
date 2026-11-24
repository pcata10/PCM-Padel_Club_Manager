#!/usr/bin/env bash
# ════════════════════════════════════════════════════════
#  PadelMAN — One-click local launcher
#  Works on any Mac with Node.js installed.
#  Data is stored in backend/data/ — portable on pen drive.
# ════════════════════════════════════════════════════════
set -e
cd "$(dirname "$0")"

echo "🎾 Starting Padel Tournament Manager..."
echo ""

if ! command -v node &> /dev/null; then
  echo "❌ Node.js non trovato su questo computer!"
  echo "Per eseguire l'app è necessario installare Node.js (gratuito) da: https://nodejs.org"
  exit 1
fi

# Install backend deps if needed
if [ ! -d "backend/node_modules" ]; then
  echo "📦 Installing backend dependencies..."
  cd backend && npm install && cd ..
fi

# Install frontend deps if needed
if [ ! -d "frontend/node_modules" ]; then
  echo "📦 Installing frontend dependencies..."
  cd frontend && npm install && cd ..
fi

# Build frontend if no dist
if [ ! -d "frontend/dist" ]; then
  echo "🔨 Building frontend..."
  cd frontend && npm run build && cd ..
fi

# Serve frontend dist statically from backend
echo ""
echo "✅ All ready! Opening http://localhost:4000/login"
echo "🔑 Default login: admin@padel.local / admin123"
echo ""

# Automatically open browser on Mac
if [[ "$OSTYPE" == "darwin"* ]]; then
  (sleep 1 && open "http://localhost:4000/login") &
fi

# Start backend (serves API + static frontend)
cd backend && node server.js
