# DATZON DOWNLOADER 3.2

Downloader media multi-provider berbasis Next.js dengan preview langsung, tema terang/gelap, aksen warna, skeleton loading, galeri media, statistik TikTok, pemutar Spotify, Pinterest search, serta fallback Cobalt untuk platform lain.

## Provider

- **TikTok:** TikWM. Menampilkan kreator, avatar, caption, views, likes, komentar, share, favorit, region, tanggal, video, musik, slide foto, dan live photo.
- **Spotify:** BINTANG API. Menampilkan cover, judul, artis, album, durasi, pemutar audio, dan tombol unduh.
- **Pinterest:** BINTANG Pinterest Search. Gunakan URL halaman pencarian Pinterest atau ketik `pinterest: kata kunci`.
- **YouTube, Douyin, Instagram, Facebook, X, SoundCloud, Reddit, Vimeo, Bilibili, dan lainnya:** Cobalt melalui `COBALT_API_URL`.
- **Tautan file langsung:** `.mp4`, `.webm`, `.mp3`, `.m4a`, `.jpg`, `.png`, dan format umum lain diproses tanpa provider.

## Menjalankan secara lokal

```bash
npm install
npm run dev
```

Buka `http://localhost:3000`.

## Build produksi

```bash
npm run build
npm start
```

## Deploy ke Vercel

1. Upload isi folder ini ke root repository GitHub.
2. Import repository ke Vercel dengan preset Next.js.
3. Untuk platform fallback, tambahkan Environment Variable:

```env
COBALT_API_URL=https://alamat-backend-cobalt-kamu
```

4. Redeploy setelah Environment Variable disimpan.

TikTok, Spotify, Pinterest Search, dan tautan file langsung tidak membutuhkan `COBALT_API_URL`. Cobalt hanya diperlukan untuk platform lainnya.

## Backend Cobalt

Folder `backend-cobalt/` berisi:

- `Dockerfile` untuk hosting container yang meminta Dockerfile.
- `docker-compose.yml` untuk VPS atau hosting Docker Compose.

Cobalt berjalan pada port `9000`.

## Struktur utama

- `app/page.tsx` — tampilan utama dan hasil media kaya metadata.
- `app/api/download/route.ts` — dispatcher provider.
- `lib/providers/tiktok.ts` — integrasi TikWM.
- `lib/providers/spotify.ts` — integrasi Spotify BINTANG.
- `lib/providers/pinterest.ts` — integrasi Pinterest Search.
- `lib/cobalt.ts` — fallback Cobalt.
- `components/media-preview.tsx` — preview video, audio, gambar, slide, dan live photo.

## Catatan

- API gratis dapat berubah, lambat, atau berhenti tanpa pemberitahuan. Pesan error provider ditampilkan dengan jelas agar mudah diganti nanti.
- URL media dari provider bisa kedaluwarsa. Unduh setelah diproses.
- Proyek ini tidak cocok untuk GitHub Pages karena memakai route server-side Next.js.
- Gunakan hanya untuk media yang dimiliki atau memang diizinkan untuk disimpan.
