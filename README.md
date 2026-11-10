# Polesin — Penjernih Foto AI di Browser

Polesin memperbesar dan mempertajam foto **2x atau 4x langsung di browser**. Tanpa upload, tanpa akun, tanpa API key, tanpa batas jumlah foto.

## Cara pakai

1. Buka halaman, pilih foto dari galeri atau ambil foto dengan kamera HP.
2. Pilih perbesaran **2x** atau **4x**, dan gaya **Natural** atau **Tajam**.
3. Tekan **Poles Foto**, tunggu prosesnya, lalu download hasilnya (PNG/JPG).
4. Geser pembanding untuk melihat foto asli vs hasil.

## Cara kerja — jujur saja

- Semua proses berjalan **100% di browser** (model ESRGAN open-source via UpscalerJS). Foto tidak pernah di-upload ke server mana pun.
- Model AI diunduh sekali saat pertama dipakai (2x ≈ 1 MB, 4x ≈ 3 MB), lalu tersimpan di cache browser.
- Polesin **memperbesar & mempertajam** foto — bukan menggambar ulang foto seperti AI berbasis prompt.
- Di HP lama prosesnya bisa lebih lambat. Foto yang sangat buram tidak bisa kembali sempurna.
- Input dibatasi supaya hasil akhir tidak melebihi 4096 px di sisi terpanjang (2x: input maks 2048 px, 4x: input maks 1024 px). Foto yang lebih besar diperkecil dulu, dengan penjelasan di layar.

## Jalankan lokal

```bash
npm install
npm run dev     # http://localhost:3000
```

Model disalin otomatis dari `node_modules` ke `public/models/` sebelum dev/build (`scripts/copy-models.mjs`).

## Tes

```bash
npm run typecheck   # tsc --noEmit
npm run build       # build produksi
npm run test:e2e    # build + server + uji enhance 2x di Chromium headless
```

Tes e2e meng-upload foto contoh 320×240, menjalankan enhance 2x, dan memastikan hasilnya benar 640×480 dengan piksel yang tidak kosong.

## Teknologi

Next.js 14 + TypeScript + Tailwind CSS, UpscalerJS (`upscaler` + `@upscalerjs/default-model` untuk 2x dan `@upscalerjs/esrgan-medium` untuk 4x), TensorFlow.js (WebGL).
