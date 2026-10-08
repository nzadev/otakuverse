#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT=4173

# Check if already running
if lsof -i :$PORT >/dev/null 2>&1 || ss -tulpn | grep -q ":$PORT"; then
  echo ">> [OtakuVerse] Server sudah berjalan di port $PORT!"
else
  echo ">> [OtakuVerse] Menjalankan server di port $PORT..."
  cd "$SCRIPT_DIR"
  node server.js &
  sleep 1
fi

echo ">> [OtakuVerse] Akses aplikasi di:"
echo "   Local Host : http://localhost:$PORT"
if command -v ip >/dev/null 2>&1; then
  LOCAL_IP=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7; exit}' || echo "localhost")
  echo "   HP / LAN   : http://$LOCAL_IP:$PORT"
fi
