#!/data/data/com.termux/files/usr/bin/bash
clear
echo "========================================="
echo "       STARTING OTAKUVERSE SERVER        "
echo "========================================="

export PATH=/data/data/com.termux/files/usr/bin:$PATH

echo "1. Mematikan proses lama (jika ada)..."
killall node 2>/dev/null
killall cloudflared 2>/dev/null
sleep 1

echo "2. Menjalankan OtakuVerse..."
if [ -d "/data/data/com.termux/files/home/otakuverse" ]; then
    cd "/data/data/com.termux/files/home/otakuverse"
elif [ -d "$HOME/otakuverse" ]; then
    cd "$HOME/otakuverse"
else
    cd "$(dirname "$0")"
fi
nohup node server.js > server.log 2>&1 &

echo "3. Membuat Jalur Publik Cloudflare Tunnel..."
nohup cloudflared tunnel --url http://localhost:4173 > tunnel.log 2>&1 &

echo "4. Menunggu link berhasil dibuat..."
LINK=""
for i in {1..15}; do
    sleep 1
    LINK=$(grep -o 'https://[a-zA-Z0-9.-]*\.trycloudflare\.com' tunnel.log 2>/dev/null | head -n 1)
    if [ -n "$LINK" ]; then
        break
    fi
done

echo ""
echo "==========================================================="
echo "✅ SERVER SIAP DIGUNAKAN!"
echo "==========================================================="
echo "📺 Nonton di HP (Browser)  : http://localhost:4173"
if [ -n "$LINK" ]; then
    echo "🌍 Link Publik Cloudflare  : $LINK"
else
    echo "ℹ️  Cloudflared sedang booting, cek file tunnel.log jika butuh link publik."
fi
echo "==========================================================="
echo "(Jangan tutup Termux saat sedang menonton)"
