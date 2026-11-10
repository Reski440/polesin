// Menyalin file model UpscalerJS dari node_modules ke public/models/ agar
// browser bisa mengunduhnya saat runtime. Dijalankan otomatis sebelum
// `npm run dev` dan `npm run build` (lihat script predev/prebuild).
// Model TIDAK di-commit ke repo — ukurannya ~1 MB (2x) dan ~3 MB (4x).
import { cpSync, existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const jobs = [
  { from: '@upscalerjs/default-model/models', to: 'public/models/default' },
  { from: '@upscalerjs/esrgan-medium/models/x4', to: 'public/models/medium-x4' },
]

for (const { from, to } of jobs) {
  const src = path.join(root, 'node_modules', from)
  const dst = path.join(root, to)
  if (!existsSync(src)) {
    console.error(`[copy-models] tidak ketemu ${src} — jalankan npm install dulu`)
    process.exit(1)
  }
  mkdirSync(dst, { recursive: true })
  cpSync(src, dst, { recursive: true })
  console.log(`[copy-models] ${from} -> ${to}`)
}
