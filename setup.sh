#!/data/data/com.termux/files/usr/bin/bash
echo "=== MEMULAI SETUP OTAKUVERSE ==="
if [ ! -d ~/storage/downloads ]; then
    echo "Meminta Izin Storage! Harap perhatikan layar HP dan klik Izinkan/Allow..."
    termux-setup-storage
    sleep 5
fi

echo "[1/4] Install NodeJS & Cloudflared..."
pkg update -y
pkg install nodejs cloudflared -y

echo "[2/4] Ekstrak File..."
mkdir -p ~/otakuverse
rm -rf ~/otakuverse/*
tar -xzf /sdcard/Download/otakuverse_setup/otakuverse_phone.tar.gz -C ~/otakuverse

echo "[3/4] Install Package (npm install)..."
cd ~/otakuverse
npm install

echo "[4/4] Menjalankan Server!"
node server.js
