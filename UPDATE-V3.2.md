# DATZON Downloader V3.2

Perubahan utama:

- Thumbnail daftar Foto Live TikTok sekarang mengambil frame langsung dari video, bukan bergantung pada poster yang sering rusak.
- Thumbnail gambar memiliki fallback aman bila URL poster provider gagal.
- Spotify menahan tampilan hasil di skeleton sampai MP3 penuh selesai divalidasi, dimuat, dan siap diputar serta diunduh.
- Audio Spotify yang sudah disiapkan dipakai ulang sebagai Blob lokal agar tombol unduh tidak mengulang proses provider.
- Tombol unduh pada preview memakai nama file asli dan tetap berada di halaman.
- Warna dominan sampul disimpan di cache sesi dan tidak kembali putih saat tema atau aksen diganti.
- Kolom input tautan dibuat sedikit lebih pendek pada desktop dan seluler.
- Versi proyek dinaikkan menjadi 3.2.0.

Catatan: provider gratis tetap dapat berubah atau gagal sewaktu-waktu. Gunakan hanya untuk media yang memang diizinkan untuk disimpan.
