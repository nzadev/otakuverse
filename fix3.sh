#!/system/bin/sh
export PREFIX=/data/data/com.termux/files/usr
export PATH=$PREFIX/bin:$PATH
export LD_LIBRARY_PATH=$PREFIX/lib

apt update
apt install openssl nodejs -y --reinstall
node -v
cd /data/data/com.termux/files/home/otakuverse
nohup node server.js > server.log 2>&1 &
nohup cloudflared tunnel --url http://localhost:4173 > tunnel.log 2>&1 &
echo "Done fixing and restarting"
