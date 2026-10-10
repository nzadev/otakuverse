#!/data/data/com.termux/files/usr/bin/bash
clear
echo "========================================="
echo "       MEMPERBAIKI TERMUX ERROR          "
echo "========================================="
echo "HP lu ternyata error gara-gara aplikasi Termux-nya kadaluarsa!"
echo "Lagi diperbarui sekarang, tungguin sampe beres..."
echo ""

yes | pkg upgrade -y
pkg install nodejs cloudflared -y

echo "Pembaruan Beres! Nge-gas ulang server..."
bash ~/run_server.sh
