#!/system/bin/sh
export PREFIX=/data/data/com.termux/files/usr
export PATH=$PREFIX/bin:$PATH
export LD_LIBRARY_PATH=$PREFIX/lib

apt install cloudflared -y
cd /data/data/com.termux/files/home/otakuverse
rm -f tunnel.log
nohup cloudflared tunnel --url http://localhost:4173 > tunnel.log 2>&1 &
echo "Done"
