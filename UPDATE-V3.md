# DATZON Downloader V3.1

Perubahan utama:

- Font utama diganti ke Baloo 2.
- Tinggi kolom tautan diperkecil agar lebih rapi di perangkat seluler.
- Judul/caption besar TikTok yang duplikat dihapus. Caption tetap tersedia di panel salin.
- Ringkasan Total pilihan, Video, Audio, dan Gambar dihapus.
- Thumbnail Video HD TikTok diganti ikon video.
- Baris Foto Slide dan Foto Live dibuat ringkas dengan tombol unduh di sisi kanan.
- Thumbnail Foto Live memakai frame video ketika gambar poster tidak tersedia.
- Kartu artis Spotify yang duplikat dihapus.
- Nama file Spotify memakai format `Judul Lagu.mp3` dengan spasi.
- Endpoint audio Spotify memeriksa kecocokan durasi dan metadata sebelum file diputar atau diunduh.
- File Spotify yang durasinya tidak lengkap ditolak agar pengguna tidak menerima lagu salah atau potongan pendek.
- Saat unduh Spotify, judul, artis, album, dan cover ditambahkan ke metadata MP3 bila sumbernya kompatibel.

## Instalasi

```bash
npm install
npm run dev
```

Untuk produksi:

```bash
npm run build
npm start
```

Catatan: hasil Spotify tetap bergantung pada provider pihak ketiga. Versi ini memilih menolak audio yang tidak cocok daripada menyimpan file salah.
