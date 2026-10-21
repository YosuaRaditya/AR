# WebAR Studio (Hit-Test Tap-to-Place & Custom GLB)

Aplikasi Web Augmented Reality (WebAR) murni menggunakan **HTML5, CSS3, dan JavaScript** berbasis standar web resmi Google & W3C: **WebXR Device API** dengan implementasi **Three.js**.

---

## 🌟 Pembaruan & Fitur Utama

1. **Bidang AR Sip & Tap to Place (Kunci Posisi Tidak Bergeser)**:
   - Objek 3D **tidak langsung muncul sembarangan**.
   - Ketika kamera AR dibuka, sistem memindai bidang datar (lantai/meja) di dunia nyata secara otomatis menggunakan WebXR Hit-Test.
   - Indikator **Cincin Target (Reticle)** berwarna hijau neon akan menempel pada lantai/meja yang terdeteksi.
   - **Ketuk Layar (Tap)** di posisi yang Anda inginkan: objek 3D akan ditempatkan di sana dan **terkunci permanen pada koordinat dunia nyata** (tidak bergeser atau melayang mengikuti kamera).
   - Tombol **"📍 Reposisi"** untuk memindahkan model ke titik baru kapan saja.

2. **Load Custom GLB / glTF**:
   - Pilih file `.glb` / `.gltf` kustom melalui tombol **"Pilih GLB"** atau **Drag & Drop**.
   - Model otomatis dinormalisasi ukurannya dan titik pivot diletakkan pas di atas lantai sehingga tidak tenggelam ke bawah lantai.
   - Pilihan model sampel bawaan (Astronaut, Robot, Kursi, Makanan 3D).

3. **Slider Ukuran & Skala AR**:
   - Atur skala objek secara presisi (0.2x hingga 3.0x).

4. **Deteksi Otomatis Masalah Kamera HP & HTTPS**:
   - Peringatan instan jika aplikasi dibuka melalui HTTP yang tidak aman.
   - Tombol panduan & modal QR Code untuk memudahkan pengujian di smartphone.

---

## 📱 Mengapa Kamera Belum Terbuka di HP? (Dan Solusinya)

Sistem keamanan semua browser modern (Google Chrome Android & Apple Safari iOS) **secara ketat memblokir akses ke kamera & WebXR** jika web diakses melalui alamat IP HTTP biasa (seperti `http://192.168.x.x:8000`).

Halaman **wajib** dibuka melalui koneksi aman: **HTTPS** atau **localhost**.

### Pilihan Solusi Termudah:

#### Cara 1: Menggunakan Link HTTPS Publik Instan (Rekomendasi)
Di terminal komputer Anda (pastikan server port 8000 berjalan):
```bash
npx localtunnel --port 8000
```
Buka link HTTPS yang diberikan di browser Google Chrome HP Anda. Kamera AR akan langsung terbuka 100%!

#### Cara 2: Kabel USB Android (ADB Reverse - Tanpa Butuh Internet)
1. Sambungkan HP Android ke laptop via kabel USB (pastikan USB Debugging aktif).
2. Jalankan di terminal:
   ```bash
   adb reverse tcp:8000 tcp:8000
   ```
3. Buka `http://localhost:8000` di Google Chrome HP Anda. Chrome akan memperlakukan ini sebagai localhost aman dan mengizinkan kamera AR!

#### Cara 3: Menggunakan Script Helper Bawaan
Jalankan script interaktif yang sudah disediakan:
```bash
./start_ar.sh
```

---

## 📂 Struktur File

```
.
├── index.html     # UI, canvas WebGL, dan WebXR DOM Overlay
├── style.css      # Desain responsif, banner peringatan, dan HUD AR
├── app.js         # Engine Three.js, WebXR Hit-Test, reticle & tap to place
├── start_ar.sh    # Script pembantu peluncuran ke HP
└── README.md      # Dokumentasi lengkap
```
