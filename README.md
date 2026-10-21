# WebAR Viewer (Google Model-Viewer)

Aplikasi Web Augmented Reality (WebAR) murni menggunakan **HTML5, CSS3, dan JavaScript** berbasis framework web resmi Google: [**`<model-viewer>`**](https://modelviewer.dev/).

---

## 🚀 Fitur Utama

1. **Load Custom GLB / glTF**:
   - Unggah file `.glb` atau `.gltf` kustom melalui tombol **"Pilih GLB"**.
   - Mendukung **Drag & Drop** langsung ke canvas browser.
   - Pilihan model sampel bawaan (Astronaut, Robot, Kursi, Makanan).
2. **Kamera Augmented Reality (AR)**:
   - Tombol **"Lihat di Kamera AR"** bawaan Google Model Viewer.
   - Menggunakan standar **WebXR**, **Google Scene Viewer** (Android / ARCore), dan **Apple Quick Look** (iOS / Safari).
   - Penempatan objek di **Lantai/Meja** (*floor*) atau **Dinding** (*wall*).
3. **Kontrol Interaktif**:
   - Orbit kamera 3D interaktif (*touch pan/zoom/rotate*).
   - Putar otomatis (*auto-rotate* toggle).
   - Pengaturan intensitas bayangan (*shadow intensity*) & pencahayaan (*exposure*).
   - Reset kamera ke posisi awal.

---

## 📂 Struktur File

```
.
├── index.html   # Struktur utama & komponen <model-viewer>
├── style.css    # Desain antarmuka modern & responsif (Glassmorphism)
├── app.js       # Logika upload GLB, drag-drop, dan kontrol AR
└── README.md    # Dokumentasi proyek
```

---

## 🛠️ Cara Menjalankan

Karena WebXR dan Web Component memerlukan web server lokal (bukan protokol `file:///`), jalankan server lokal sederhana berikut:

### Opsi 1: Menggunakan Python 3 (Bawaan)
Buka terminal di folder ini dan jalankan:
```bash
python3 -m http.server 8000
```
Lalu buka di browser: `http://localhost:8000`

---

## 📱 Panduan Menampilkan AR di Kamera Smartphone

Fitur kamera AR (WebXR / Scene Viewer) membutuhkan perangkat mobile:

1. **Android (Chrome)**:
   - Memerlukan perangkat dengan dukungan **Google Play Services for AR** (ARCore).
2. **iPhone / iPad (Safari)**:
   - Otomatis didukung lewat Apple AR Quick Look bawaan iOS.

> **Catatan Pengujian di HP via Jaringan Lokal:**
> Browser mobile (Chrome/Safari) menerapkan kebijakan keamanan yang mewajibkan protokol **HTTPS** untuk mengakses sensor kamera AR (kecuali `localhost`).
> 
> Untuk menguji langsung di HP:
> - Gunakan tunneling instan seperti **Cloudflare Tunnel** atau **Ngrok**:
>   ```bash
>   # Contoh menggunakan npx cloudflared / ngrok:
>   npx cloudflared tunnel --url http://localhost:8000
>   ```
> - Buka link HTTPS yang dihasilkan di Google Chrome Android atau Safari iPhone.
> - Tekan tombol hijau **"Lihat di Kamera AR"**, arahkan kamera ke lantai datar, dan model 3D akan muncul di dunia nyata!
