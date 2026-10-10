#!/data/data/com.termux/files/usr/bin/bash
clear
echo "========================================="
echo "       STARTING OTAKUVERSE SERVER        "
echo "========================================="

echo "1. Mematikan server lama (jika ada)..."
killall node 2>/dev/null
killall cloudflared 2>/dev/null
sleep 2

echo "2. Menjalankan Otakuverse di Background..."
cd ~/otakuverse
nohup node server.js > server.log 2>&1 &

echo "3. Membuat Jalur Publik via Cloudflared..."
nohup cloudflared tunnel --url http://localhost:3000 > tunnel.log 2>&1 &

echo "4. Menunggu link berhasil dibuat (10-15 detik)..."
for i in {1..15}; do
    sleep 1
    LINK=$(grep -o 'https://[a-zA-Z0-9.-]*\.trycloudflare\.com' tunnel.log | head -n 1)
    if [ ! -z "$LINK" ]; then
        break
    fi
done

echo ""
echo "==========================================================="
echo "✅ SERVER SIAP TEMPUR!"
echo "==========================================================="
echo "📺 Link buat Nonton Sendiri : http://localhost:3000"
if [ ! -z "$LINK" ]; then
    echo "🌍 Link buat Temen Lu       : $LINK"
else
    echo "❌ Gagal dapet link publik, internet lu aman gak bro?"
fi
echo "==========================================================="
echo "(Biarkan aplikasi Termux ini nyala, jangan di force-close!)"
