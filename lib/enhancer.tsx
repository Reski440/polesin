'use client'

import { useEffect, useRef, useState } from 'react'
import {
  enhanceImage,
  formatBytes,
  formatMs,
  maxInputLongEdge,
  MODEL_INFO,
  type EnhanceProgress,
  type Preset,
  type Scale,
} from './enhance'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FILE_BYTES = 20 * 1024 * 1024 // 20 MB

interface OriginalPhoto {
  url: string
  name: string
  size: number
  width: number
  height: number
}

interface ResultPhoto {
  dataUrl: string
  width: number
  height: number
  inputWidth: number
  inputHeight: number
  wasDownscaled: boolean
  ms: number
  size: number
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Gagal membaca gambar.'))
    img.src = src
  })
}

function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string; hint?: string }[]
  value: T
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div>
      <p className="mb-2 text-sm text-muted">{label}</p>
      <div className="flex gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex-1 rounded-lg border px-3 py-3 text-sm font-medium ${
              value === opt.value
                ? 'border-sky-400 bg-sky-400/10 text-white'
                : 'border-line bg-panel text-muted hover:text-white'
            }`}
            aria-pressed={value === opt.value}
          >
            {opt.label}
            {opt.hint ? <span className="block text-xs font-normal text-muted">{opt.hint}</span> : null}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function Enhancer() {
  const [original, setOriginal] = useState<OriginalPhoto | null>(null)
  const [scale, setScale] = useState<Scale>(2)
  const [preset, setPreset] = useState<Preset>('natural')
  const [format, setFormat] = useState<'png' | 'jpg'>('png')
  const [status, setStatus] = useState<'idle' | 'working' | 'done' | 'error'>('idle')
  const [progress, setProgress] = useState<EnhanceProgress | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [result, setResult] = useState<ResultPhoto | null>(null)
  const [resultStale, setResultStale] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [compare, setCompare] = useState(50)

  const galleryInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const resultCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const startRef = useRef(0)

  useEffect(() => {
    if (status !== 'working') return
    const id = setInterval(() => setElapsedMs(Date.now() - startRef.current), 250)
    return () => clearInterval(id)
  }, [status])

  async function handleFile(file: File | undefined | null) {
    if (!file) return
    setError(null)
    setResult(null)
    setResultStale(false)
    if (!ACCEPTED_TYPES.includes(file.type) && !file.type.startsWith('image/')) {
      setError('Format foto tidak didukung. Pakai JPG, PNG, atau WebP.')
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      setError('Fotonya terlalu besar (maksimal 20 MB).')
      return
    }
    const url = URL.createObjectURL(file)
    try {
      const img = await loadImage(url)
      setOriginal({ url, name: file.name, size: file.size, width: img.naturalWidth, height: img.naturalHeight })
      setStatus('idle')
    } catch {
      setError('Gagal membaca foto itu. Coba foto lain.')
    }
  }

  async function handleSample() {
    setError(null)
    setResult(null)
    setResultStale(false)
    try {
      const res = await fetch('/sample.jpg')
      if (!res.ok) throw new Error('Foto contoh tidak ketemu.')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const img = await loadImage(url)
      setOriginal({ url, name: 'foto-contoh.jpg', size: blob.size, width: img.naturalWidth, height: img.naturalHeight })
      setStatus('idle')
    } catch {
      setError('Gagal memuat foto contoh. Coba lagi.')
    }
  }

  async function handleEnhance() {
    if (!original || status === 'working') return
    setError(null)
    setResult(null)
    setResultStale(false)
    setStatus('working')
    setProgress({ phase: 'loading-model', percent: 0, note: 'Menyiapkan...' })
    setElapsedMs(0)
    startRef.current = Date.now()
    try {
      const source = await loadImage(original.url)
      const out = await enhanceImage(source, scale, preset, setProgress)
      resultCanvasRef.current = out.canvas
      const size = await new Promise<number>((resolve) => {
        out.canvas.toBlob((b) => resolve(b ? b.size : 0), 'image/png')
      })
      setResult({
        dataUrl: out.canvas.toDataURL('image/png'),
        width: out.width,
        height: out.height,
        inputWidth: out.inputWidth,
        inputHeight: out.inputHeight,
        wasDownscaled: out.wasDownscaled,
        ms: out.ms,
        size,
      })
      setStatus('done')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Terjadi kesalahan.'
      setError(
        `Gagal memproses foto: ${msg} Kalau model AI gagal dimuat, periksa koneksi internet lalu tekan "Poles Foto" lagi.`,
      )
      setStatus('error')
    }
  }

  function handleDownload() {
    const canvas = resultCanvasRef.current
    if (!canvas || !result) return
    const mime = format === 'png' ? 'image/png' : 'image/jpeg'
    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `polesin-${scale}x.${format}`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    }, mime, 0.92)
  }

  function handleReset() {
    if (original) URL.revokeObjectURL(original.url)
    setOriginal(null)
    setResult(null)
    setResultStale(false)
    setError(null)
    setProgress(null)
    setStatus('idle')
    setCompare(50)
    if (galleryInputRef.current) galleryInputRef.current.value = ''
    if (cameraInputRef.current) cameraInputRef.current.value = ''
  }

  const maxEdge = maxInputLongEdge(scale)

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* 1. Pilih foto */}
      <section className="rounded-xl border border-line bg-panel p-4 sm:p-5">
        <h2 className="text-base font-semibold">1. Pilih foto</h2>
        <p className="mt-1 text-sm text-muted">JPG, PNG, atau WebP, maksimal 20 MB. Foto tidak di-upload ke mana-mana.</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="rounded-lg bg-sky-500 px-3 py-3 text-sm font-semibold text-white hover:bg-sky-400"
          >
            📷 Ambil Foto
          </button>
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            className="rounded-lg border border-line bg-ink px-3 py-3 text-sm font-semibold text-white hover:border-sky-400"
          >
            🖼️ Pilih dari Galeri
          </button>
        </div>
        <input
          ref={cameraInputRef}
          data-testid="camera-input"
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <input
          ref={galleryInputRef}
          data-testid="gallery-input"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <button type="button" onClick={handleSample} className="mt-3 text-sm text-sky-400 hover:underline">
          Atau coba foto contoh dulu →
        </button>
        {original ? (
          <div className="mt-4" data-testid="original-meta">
            <img src={original.url} alt="Foto asli" className="max-h-64 w-full rounded-lg border border-line object-contain" />
            <p className="mt-2 text-sm text-muted">
              {original.name} — {original.width} × {original.height} px, {formatBytes(original.size)}
              {Math.max(original.width, original.height) > maxEdge ? (
                <span className="block text-amber-300">
                  Foto ini akan diperkecil dulu ke {maxEdge} px di sisi terpanjang sebelum diproses (hasil akhir tetap {scale}x
                  dari versi yang diperkecil).
                </span>
              ) : null}
            </p>
            <button type="button" onClick={handleReset} className="mt-2 text-sm text-muted hover:text-white hover:underline">
              Ganti foto
            </button>
          </div>
        ) : null}
      </section>

      {/* 2. Pengaturan */}
      <section className="space-y-5 rounded-xl border border-line bg-panel p-4 sm:p-5">
        <h2 className="text-base font-semibold">2. Atur hasil</h2>
        <Segmented<Scale>
          label="Perbesaran"
          value={scale}
          onChange={(v) => {
            setScale(v)
            if (result) setResultStale(true)
          }}
          options={[
            { value: 2, label: '2x', hint: 'Model ~1 MB, lebih cepat' },
            { value: 4, label: '4x', hint: 'Model ~3 MB, lebih detail' },
          ]}
        />
        <Segmented<Preset>
          label="Gaya"
          value={preset}
          onChange={(v) => {
            setPreset(v)
            if (result) setResultStale(true)
          }}
          options={[
            { value: 'natural', label: 'Natural', hint: 'Hasil asli model, tanpa penajaman ekstra' },
            { value: 'tajam', label: 'Tajam', hint: 'Ditambah penajaman setelah di-upscale' },
          ]}
        />
        <p className="text-xs text-muted">
          Model AI {MODEL_INFO[scale].name} diunduh sekali saat pertama dipakai ({MODEL_INFO[scale].sizeMB}), lalu tersimpan di
          cache browser — pemakaian berikutnya tidak perlu unduh lagi.
        </p>
      </section>

      {/* Tombol proses */}
      <button
        type="button"
        data-testid="enhance-button"
        onClick={handleEnhance}
        disabled={!original || status === 'working'}
        className="w-full rounded-xl bg-sky-500 px-4 py-4 text-base font-bold text-white hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {status === 'working' ? 'Memproses...' : '✨ Poles Foto'}
      </button>

      {/* Progress */}
      {status === 'working' && progress ? (
        <div className="rounded-xl border border-line bg-panel p-4" data-testid="progress">
          <div className="flex items-baseline justify-between text-sm">
            <span>{progress.note}</span>
            <span className="text-muted">{formatMs(elapsedMs)}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink">
            <div className="h-full bg-sky-400 transition-all" style={{ width: `${progress.percent}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted">{progress.percent}% — proses berjalan di HP kamu, bukan di server.</p>
        </div>
      ) : null}

      {/* Error */}
      {error ? (
        <div className="rounded-xl border border-red-500/50 bg-red-500/10 p-4 text-sm text-red-200" data-testid="error-box">
          {error}
        </div>
      ) : null}

      {/* Hasil */}
      {result && original ? (
        <section className="rounded-xl border border-line bg-panel p-4 sm:p-5" data-testid="result">
          <h2 className="text-base font-semibold">Hasil</h2>
          {resultStale ? (
            <p className="mt-1 text-sm text-amber-300">Pengaturan berubah — tekan “Poles Foto” lagi untuk hasil baru.</p>
          ) : null}
          <div
            className="relative mt-3 w-full overflow-hidden rounded-lg border border-line bg-black"
            style={{ aspectRatio: `${result.width} / ${result.height}` }}
          >
            <img
              src={result.dataUrl}
              alt="Hasil Polesin"
              data-testid="result-img"
              className="absolute inset-0 h-full w-full object-contain"
            />
            <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - compare}% 0 0)` }}>
              <img src={original.url} alt="Foto asli" className="absolute inset-0 h-full w-full object-contain" />
            </div>
            <div className="absolute inset-y-0 w-0.5 bg-white/80" style={{ left: `${compare}%` }} />
            <span className="absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">Asli</span>
            <span className="absolute right-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">Hasil</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={compare}
            onChange={(e) => setCompare(Number(e.target.value))}
            aria-label="Geser untuk membandingkan foto asli dan hasil"
            className="mt-3"
          />
          <p className="mt-1 text-xs text-muted">Geser untuk membandingkan foto asli (kiri) dan hasil (kanan).</p>
          <p className="mt-3 text-sm text-muted" data-testid="result-meta">
            {result.inputWidth} × {result.inputHeight} px → {result.width} × {result.height} px · {formatBytes(result.size)} ·{' '}
            {formatMs(result.ms)}
            {result.wasDownscaled ? ' · input diperkecil dulu karena melebihi batas' : ''}
          </p>
          <div className="mt-4 flex gap-2">
            <div className="flex rounded-lg border border-line">
              {(['png', 'jpg'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  className={`px-3 py-2 text-sm font-medium uppercase ${format === f ? 'bg-sky-400/10 text-white' : 'text-muted'}`}
                  aria-pressed={format === f}
                >
                  {f}
                </button>
              ))}
            </div>
            <button
              type="button"
              data-testid="download-button"
              onClick={handleDownload}
              className="flex-1 rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-400"
            >
              ⬇️ Download Hasil ({format.toUpperCase()})
            </button>
          </div>
          <button type="button" onClick={handleReset} className="mt-3 text-sm text-muted hover:text-white hover:underline">
            Poles foto lain
          </button>
        </section>
      ) : null}

      {/* Jujur soal cara kerja */}
      <section className="rounded-xl border border-line bg-panel p-4 text-sm text-muted sm:p-5">
        <h2 className="text-base font-semibold text-white">Cara kerja Polesin — jujur saja</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Semua proses berjalan 100% di browser HP/komputer kamu. Foto tidak pernah di-upload ke server mana pun.</li>
          <li>Tanpa akun, tanpa API key, tanpa batas jumlah foto. Yang bekerja adalah perangkatmu sendiri.</li>
          <li>
            Polesin memperbesar &amp; mempertajam foto (2x/4x) dengan model ESRGAN open-source — bukan menggambar ulang foto
            seperti AI berbasis prompt.
          </li>
          <li>Model AI diunduh sekali saat pertama dipakai, lalu tersimpan di cache browser.</li>
          <li>Di HP lama prosesnya bisa lebih lambat, dan foto yang sangat buram tidak bisa kembali sempurna.</li>
        </ul>
      </section>
    </div>
  )
}
