# Perbaikan `action_forbidden`

Build Vercel lama sebenarnya berhasil. Error `action_forbidden` berasal dari endpoint internal Downr yang menolak pemakaian dari aplikasi pihak ketiga.

Versi ini tidak lagi memakai endpoint internal Downr. Frontend Next.js tetap di Vercel, sedangkan pemrosesan media memakai instance Cobalt yang kamu host sendiri atau instance yang secara jelas memberi izin API.

## 1. Siapkan backend Cobalt

Gunakan `backend-cobalt/docker-compose.yml` pada server yang mendukung Docker. Ganti:

- `API_URL` dengan URL publik backend Cobalt.
- `CORS_URL` dengan domain frontend Vercel.

Kemudian jalankan:

```bash
 docker compose up -d
```

## 2. Atur Environment Variables Vercel

Di Vercel buka Project > Settings > Environment Variables, lalu tambahkan:

```text
COBALT_API_URL=https://api-downloader.domainmu.com
```

Jika backend memakai API key, tambahkan juga:

```text
COBALT_API_KEY=isi-api-key
```

Terapkan ke Production, Preview, dan Development, lalu Redeploy.

## Catatan platform

Cobalt mendukung banyak platform video publik, tetapi tidak menjanjikan semua platform. Spotify tidak menyediakan file audio lewat API resminya dan belum menjadi layanan unduhan Cobalt. DATZON dapat menampilkan dukungan Spotify lagi hanya jika ada provider yang sah dan memang mengizinkan integrasi.
