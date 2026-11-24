#!/usr/bin/env bash
# ════════════════════════════════════════════════════════
#  Gestione Tornei Padel — One-click launcher (Mac & Linux)
#  100% Locale & Offline. Dati in backend/data/
# ════════════════════════════════════════════════════════
set -e
cd "$(dirname "$0")"

echo "========================================================"
echo "  🎾 Avvio Gestione Tornei Padel (Modalità Locale)"
echo "========================================================"
echo ""

# 1. Arricchisce il PATH con i percorsi standard di Node.js su Mac/Linux
# (necessario quando lo script viene avviato con doppio clic da Finder/File Manager)
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node 2>/dev/null | tail -n 1)/bin:$PATH"

if [ -d "$(pwd)/tools/bin" ]; then
  export PATH="$(pwd)/tools/bin:$PATH"
fi

# 2. Verifica se Node.js è presente
if ! command -v node &> /dev/null; then
  echo "⚠️ Node.js non è presente su questo computer."

  # Su macOS: prova con Homebrew o scarica l'installer ufficiale .pkg
  if [[ "$OSTYPE" == "darwin"* ]]; then
    if command -v brew &> /dev/null; then
      echo "⬇️ Installazione automatica di Node.js tramite Homebrew..."
      brew install node
    else
      echo "⬇️ Download dell'installer ufficiale Node.js LTS per macOS in corso..."
      NODE_PKG_URL="https://nodejs.org/dist/v20.18.0/node-v20.18.0.pkg"
      DEST_PKG="/tmp/node-installer.pkg"

      if command -v curl &> /dev/null; then
        curl -fsSL "$NODE_PKG_URL" -o "$DEST_PKG"
      elif command -v wget &> /dev/null; then
        wget -q "$NODE_PKG_URL" -O "$DEST_PKG"
      fi

      if [ -f "$DEST_PKG" ]; then
        echo "⚙️ Apertura della procedura guidata di installazione di Node.js..."
        echo "   Completa l'installazione a video, poi premi INVIO qui per continuare."
        open "$DEST_PKG"
        read -r -p "Premi INVIO dopo aver completato l'installazione di Node.js..."
      fi
    fi
  # Su Linux
  elif [[ "$OSTYPE" == "linux"* ]]; then
    if command -v apt-get &> /dev/null; then
      echo "⬇️ Installazione automatica tramite apt..."
      sudo apt-get update && sudo apt-get install -y nodejs npm
    elif command -v dnf &> /dev/null; then
      echo "⬇️ Installazione automatica tramite dnf..."
      sudo dnf install -y nodejs npm
    elif command -v pacman &> /dev/null; then
      echo "⬇️ Installazione automatica tramite pacman..."
      sudo pacman -S --noconfirm nodejs npm
    fi
  fi

  # Nuova verifica dopo il tentativo di installazione
  export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
  if ! command -v node &> /dev/null; then
    echo ""
    echo "❌ Node.js non rilevato. Puoi installarlo gratuitamente da: https://nodejs.org"
    echo "Dopo l'installazione, rilancia questo script."
    exit 1
  fi
fi

echo "✅ Node.js attivo: $(node -v)"
echo ""

# 3. Assicura che la cartella dei dati esista
mkdir -p backend/data

# 4. Installa le dipendenze del backend se mancanti
if [ ! -d "backend/node_modules" ]; then
  echo "📦 Installazione dipendenze backend in corso..."
  (cd backend && npm install)
fi

# 5. Compila il frontend se manca la cartella dist
if [ ! -d "frontend/dist" ]; then
  echo "🔨 Compilazione interfaccia frontend in corso..."
  if [ ! -d "frontend/node_modules" ]; then
    (cd frontend && npm install)
  fi
  (cd frontend && npm run build)
fi

echo ""
echo "✅ Tutto pronto! Apertura browser su http://localhost:4000/login"
echo "🔑 Credenziali predefinite: admin@padel.local / admin123"
echo ""

# 6. Apertura automatica del browser
if [[ "$OSTYPE" == "darwin"* ]]; then
  (sleep 1 && open "http://localhost:4000/login") &
elif [[ "$OSTYPE" == "linux"* ]]; then
  if command -v xdg-open &> /dev/null; then
    (sleep 1 && xdg-open "http://localhost:4000/login") &
  fi
fi

# 7. Avvio del server backend (serve API + interfaccia web statica)
cd backend
exec node server.js
