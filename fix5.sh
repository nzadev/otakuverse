#!/system/bin/sh
export PREFIX=/data/data/com.termux/files/usr
export PATH=$PREFIX/bin:$PATH
export LD_LIBRARY_PATH=$PREFIX/lib
export TMPDIR=/data/data/com.termux/files/usr/tmp

killall node 2>/dev/null
killall cloudflared 2>/dev/null

cd /data/data/com.termux/files/home/otakuverse
rm -f server.log tunnel.log

nohup node server.js > server.log 2>&1 &
nohup cloudflared tunnel --url http://localhost:4173 > tunnel.log 2>&1 &
echo "Started."
