# Deploy DATZON DOWNLOADER ke Vercel

## Penting
Proyek ini memakai Next.js Route Handler di `app/api/download/route.ts`, jadi jangan dijalankan lewat GitHub Pages. GitHub Pages hanya cocok untuk hasil statis dan akan menampilkan README/Jekyll bila source Pages diarahkan ke repository.

## Cara memperbarui repository
Ganti atau upload ulang file berikut ke root repository GitHub:

- `package-lock.json`
- `package.json`
- `vercel.json`
- `.npmrc`
- `.gitignore`

File `package-lock.json` versi lama berisi alamat registry internal yang tidak dapat dijangkau Vercel. Versi ini sudah memakai `https://registry.npmjs.org`.

## Deploy ulang
1. Buka proyek di Vercel.
2. Masuk ke Settings > Build and Deployment.
3. Pastikan Root Directory adalah `./`.
4. Pastikan Framework Preset adalah Next.js.
5. Pilih Node.js 22.x bila pengaturan tersedia.
6. Jalankan Redeploy tanpa menggunakan cache build lama.

Vercel akan menjalankan:

```bash
npm install --registry=https://registry.npmjs.org --no-audit --no-fund
npm run build
```
