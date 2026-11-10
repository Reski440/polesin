// Mesin Polesin: upscale ESRGAN yang berjalan 100% di browser via UpscalerJS.
// Tidak ada panggilan ke server, tidak ada API key, foto tidak pernah keluar
// dari perangkat pengguna.

export type Scale = 2 | 4
export type Preset = 'tajam' | 'natural'

export const MODEL_INFO: Record<Scale, { name: string; sizeMB: string; path: string }> = {
  // ESRGAN Slim 2x (default model UpscalerJS): model.json 12 KB + bobot ~0,9 MB.
  2: { name: 'ESRGAN Slim 2x', sizeMB: '~1 MB', path: '/models/default/model.json' },
  // ESRGAN Medium 4x: model.json 30 KB + bobot ~2,8 MB.
  4: { name: 'ESRGAN Medium 4x', sizeMB: '~3 MB', path: '/models/medium-x4/model.json' },
}

// Hasil akhir dibatasi 4096 px di sisi terpanjang supaya browser HP tidak
// kehabisan memori. Input yang lebih besar diperkecil dulu (dengan penjelasan
// di UI), bukan gagal diam-diam.
export const MAX_OUTPUT_LONG_EDGE = 4096

export function maxInputLongEdge(scale: Scale): number {
  return Math.floor(MAX_OUTPUT_LONG_EDGE / scale)
}

export interface EnhanceProgress {
  phase: 'loading-model' | 'warming-up' | 'enhancing' | 'sharpening' | 'done'
  percent: number // 0-100
  note: string
}

export interface EnhanceResult {
  canvas: HTMLCanvasElement
  width: number
  height: number
  inputWidth: number
  inputHeight: number
  wasDownscaled: boolean
  ms: number
}

type UpscalerInstance = {
  upscale: (
    input: HTMLImageElement,
    opts: { output: 'base64'; patchSize?: number; padding?: number; progress?: (amount: number) => void },
  ) => Promise<string>
  warmup: () => Promise<void>
  dispose?: () => void
}

const upscalers = new Map<Scale, Promise<UpscalerInstance>>()

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Gagal membaca gambar.'))
    img.src = src
  })
}

async function getUpscaler(scale: Scale): Promise<UpscalerInstance> {
  const cached = upscalers.get(scale)
  if (cached) return cached
  const p = (async (): Promise<UpscalerInstance> => {
    const [{ default: Upscaler }, modelPkg] = await Promise.all([
      import('upscaler'),
      scale === 2
        ? import('@upscalerjs/default-model')
        : import('@upscalerjs/esrgan-medium/4x'),
    ])
    // Definisi model bawaan menunjuk ke 'models/model.json' (relatif, tidak
    // ada di server). Arahkan ke salinan di public/models/.
    const model = { ...modelPkg.default, path: MODEL_INFO[scale].path }
    return new Upscaler({ model }) as UpscalerInstance
  })()
  upscalers.set(scale, p)
  return p
}

// Perkecil gambar kalau sisi terpanjangnya melebihi batas. Mengembalikan
// elemen <img> yang sudah termuat (asli kalau tidak perlu diperkecil).
async function fitInput(
  img: HTMLImageElement,
  scale: Scale,
): Promise<{ image: HTMLImageElement; wasDownscaled: boolean }> {
  const w = img.naturalWidth
  const h = img.naturalHeight
  const maxEdge = maxInputLongEdge(scale)
  if (Math.max(w, h) <= maxEdge) return { image: img, wasDownscaled: false }
  const ratio = maxEdge / Math.max(w, h)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(w * ratio))
  canvas.height = Math.max(1, Math.round(h * ratio))
  const ctx = canvas.getContext('2d')
  if (!ctx) return { image: img, wasDownscaled: false }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return { image: await loadImage(canvas.toDataURL('image/png')), wasDownscaled: true }
}

// Penajaman 3x3 (unsharp). 'tajam' = efek nyata, 'natural' = tanpa penajaman
// sama sekali. Dijalankan di canvas hasil upscale.
function sharpenCanvas(ctx: CanvasRenderingContext2D, w: number, h: number, strength: number): void {
  const src = ctx.getImageData(0, 0, w, h)
  const dst = ctx.createImageData(w, h)
  const s = src.data
  const d = dst.data
  const a = strength
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      for (let c = 0; c < 3; c++) {
        const center = s[i + c]
        const up = y > 0 ? s[i - w * 4 + c] : center
        const down = y < h - 1 ? s[i + w * 4 + c] : center
        const left = x > 0 ? s[i - 4 + c] : center
        const right = x < w - 1 ? s[i + 4 + c] : center
        const v = center * (1 + 4 * a) - a * (up + down + left + right)
        d[i + c] = v < 0 ? 0 : v > 255 ? 255 : v
      }
      d[i + 3] = s[i + 3]
    }
  }
  ctx.putImageData(dst, 0, 0)
}

export async function enhanceImage(
  source: HTMLImageElement,
  scale: Scale,
  preset: Preset,
  onProgress: (p: EnhanceProgress) => void,
): Promise<EnhanceResult> {
  const started = Date.now()
  const { image, wasDownscaled } = await fitInput(source, scale)

  onProgress({
    phase: 'loading-model',
    percent: 5,
    note: `Mengunduh model AI ${scale}x (${MODEL_INFO[scale].sizeMB}, sekali saja — lalu tersimpan di cache browser)...`,
  })
  const upscaler = await getUpscaler(scale)

  onProgress({ phase: 'warming-up', percent: 15, note: 'Menyiapkan model di perangkatmu...' })
  await upscaler.warmup()

  const base64 = await upscaler.upscale(image, {
    output: 'base64',
    // patchSize wajib diisi supaya callback progress benar-benar dipanggil
    // (dan supaya prosesnya berjalan per-patch, hemat memori). padding diisi
    // eksplisit supaya tidak ada garis sambungan antar patch.
    patchSize: 128,
    padding: 2,
    progress: (amount: number) =>
      onProgress({
        phase: 'enhancing',
        percent: 15 + Math.round(amount * 70),
        note: 'Meningkatkan resolusi foto...',
      }),
  })

  const resultImg = await loadImage(base64)
  const canvas = document.createElement('canvas')
  canvas.width = resultImg.naturalWidth
  canvas.height = resultImg.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas tidak tersedia di browser ini.')
  ctx.drawImage(resultImg, 0, 0)

  if (preset === 'tajam') {
    onProgress({ phase: 'sharpening', percent: 92, note: 'Mempertajam (preset Tajam)...' })
    sharpenCanvas(ctx, canvas.width, canvas.height, 0.6)
  }

  onProgress({ phase: 'done', percent: 100, note: 'Selesai.' })
  return {
    canvas,
    width: canvas.width,
    height: canvas.height,
    inputWidth: image.naturalWidth,
    inputHeight: image.naturalHeight,
    wasDownscaled,
    ms: Date.now() - started,
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatMs(ms: number): string {
  if (ms < 1000) return `${ms} mdtk`
  return `${(ms / 1000).toFixed(1)} dtk`
}
