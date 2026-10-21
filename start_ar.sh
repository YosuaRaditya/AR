#!/bin/bash
# =============================================================================
# Helper Script: Buka WebAR di Smartphone dengan HTTPS / Port Forwarding
# =============================================================================

echo "========================================================"
echo "          🌐 WebAR Studio - Helper Peluncur HP         "
echo "========================================================"
echo ""
echo "Pilih metode pengujian untuk membuka Kamera AR di HP:"
echo "1) Jalankan Local Server (Port 8000)"
echo "2) Buat Link HTTPS Publik Instan (via Localtunnel)"
echo "3) Port Forwarding USB Android (via ADB Reverse - Tanpa Internet)"
echo ""
read -p "Masukkan pilihan [1/2/3]: " pilihan

case $pilihan in
  1)
    echo ""
    echo "Menjalankan local server di http://localhost:8000 ..."
    echo "Gunakan Opsi 2 atau 3 jika membuka di HP agar kamera AR diizinkan browser."
    python3 -m http.server 8000
    ;;
  2)
    echo ""
    echo "Membuat tunnel HTTPS gratis..."
    echo "Buka link HTTPS yang muncul di Chrome Android atau Safari iPhone:"
    npx localtunnel --port 8000
    ;;
  3)
    echo ""
    echo "Mengirim port ke HP Android via USB..."
    adb reverse tcp:8000 tcp:8000
    if [ $? -eq 0 ]; then
      echo "✅ Berhasil! Sekarang buka http://localhost:8000 di Google Chrome HP Android Anda."
      echo "Browser akan mengenali sebagai localhost aman dan mengizinkan kamera AR!"
    else
      echo "❌ Gagal. Pastikan HP terhubung via kabel USB dan 'USB Debugging' aktif di Opsi Pengembang."
    fi
    ;;
  *)
    echo "Pilihan tidak valid."
    ;;
esac
