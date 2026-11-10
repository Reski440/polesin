// Tes end-to-end Polesin 4x (lokal, bukan klaim kosong):
// build produksi -> jalankan server -> upload foto contoh 320x240 ->
// pilih skala 4x (preset Natural, default) -> jalankan enhance di
// Chromium headless -> verifikasi hasil 1280x960 dan pikselnya tidak
// kosong. Keluar 0 kalau lolos, 1 kalau gagal.
// Catatan: di VM ini Chromium tanpa WebGL, TFJS jatuh ke CPU — 4x bisa
// makan waktu beberapa menit. Timeout menunggu hasil: 10 menit.
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 3101
const BASE = `http://localhost:${PORT}`

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: root, stdio: 'inherit' })
    p.on('error', reject)
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} exit ${code}`))))
  })
}

async function waitReady(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      // coba lagi
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error('Server tidak siap.')
}

let server
let browser
try {
  console.log('== build ==')
  await run('npm', ['run', 'build'])

  console.log('== start server ==')
  // Jalankan binary next langsung (bukan via npx) supaya server.kill()
  // benar-benar mematikan servernya, bukan cuma wrapper npx.
  server = spawn('node', ['node_modules/next/dist/bin/next', 'start', '-p', String(PORT)], { cwd: root, stdio: 'pipe' })
  server.stdout.on('data', (d) => process.stdout.write(`[server] ${d}`))
  server.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`))
  await waitReady(`${BASE}/`)

  console.log('== playwright: buka halaman ==')
  browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader'] })
  const page = await browser.newPage()
  browser.on('disconnected', () => console.log('[browser] disconnected'))
  page.on('crash', () => console.log('[page] CRASH'))
  page.on('console', (msg) => {
    const t = msg.text()
    if (/tfjs|webgl|WebGL|upscaler|error/i.test(t)) console.log('[page]', t.slice(0, 300))
  })
  page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 300)))
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })

  console.log('== upload foto contoh 320x240 ==')
  await page.setInputFiles('[data-testid="gallery-input"]', path.join(root, 'scripts/sample-test.jpg'))
  await page.waitForSelector('[data-testid="original-meta"]', { timeout: 15000 })
  const meta = (await page.textContent('[data-testid="original-meta"]')).trim().replace(/\s+/g, ' ')
  console.log('meta asli:', meta)

  console.log('== pilih skala 4x (preset Natural, default) ==')
  await page.getByRole('button', { name: /^4x/ }).click()
  const pressed = await page.getByRole('button', { name: /^4x/ }).getAttribute('aria-pressed')
  if (pressed !== 'true') throw new Error('Tombol 4x tidak terpilih (aria-pressed != true).')

  console.log('== enhance 4x ==')
  const t0 = Date.now()
  await page.click('[data-testid="enhance-button"]')
  const logTimer = setInterval(() => {
    page.$('[data-testid="progress"]').then(async (el) => {
      if (!el) return
      const t = (await el.textContent()).trim().replace(/\s+/g, ' ')
      console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s]`, t.slice(0, 160))
    }).catch(() => undefined)
  }, 15000)
  try {
    await page.waitForFunction(
      () => document.querySelector('[data-testid="result"]') || document.querySelector('[data-testid="error-box"]'),
      undefined,
      { timeout: 600000 },
    )
  } finally {
    clearInterval(logTimer)
  }
  const errBox = await page.$('[data-testid="error-box"]')
  if (errBox) {
    throw new Error('Halaman menampilkan error: ' + (await errBox.textContent()).slice(0, 300))
  }
  await page.waitForSelector('[data-testid="result"]', { timeout: 10000 })
  const elapsed = Date.now() - t0
  const resultMeta = (await page.textContent('[data-testid="result-meta"]')).trim().replace(/\s+/g, ' ')
  console.log('meta hasil:', resultMeta)
  console.log('waktu enhance:', (elapsed / 1000).toFixed(1), 'dtk')

  const dims = await page.evaluate(() => {
    const img = document.querySelector('[data-testid="result-img"]')
    return { naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight }
  })
  console.log('dimensi hasil:', dims.naturalWidth, 'x', dims.naturalHeight)
  if (dims.naturalWidth !== 1280 || dims.naturalHeight !== 960) {
    throw new Error(`Dimensi hasil salah: ${dims.naturalWidth}x${dims.naturalHeight}, diharapkan 1280x960`)
  }

  // Pastikan hasil bukan gambar kosong: varians piksel harus jauh dari nol.
  const variance = await page.evaluate(() => {
    const img = document.querySelector('[data-testid="result-img"]')
    const c = document.createElement('canvas')
    c.width = img.naturalWidth
    c.height = img.naturalHeight
    const ctx = c.getContext('2d')
    ctx.drawImage(img, 0, 0)
    const data = ctx.getImageData(0, 0, c.width, c.height).data
    let sum = 0
    let sumSq = 0
    let n = 0
    for (let i = 0; i < data.length; i += 400) {
      const v = data[i]
      sum += v
      sumSq += v * v
      n++
    }
    const mean = sum / n
    return sumSq / n - mean * mean
  })
  console.log('varians piksel hasil:', variance.toFixed(1))
  if (variance < 10) throw new Error('Hasil terlihat kosong (varians piksel terlalu kecil).')

  const dl = await page.$('[data-testid="download-button"]')
  if (!dl) throw new Error('Tombol download tidak ada.')

  console.log(`E2E 4x OK: input 320x240 -> output 1280x960, preset Natural, enhance ${(elapsed / 1000).toFixed(1)} dtk, varians ${variance.toFixed(1)}`)
} catch (e) {
  console.error('E2E 4x GAGAL:', e instanceof Error ? e.message : e)
  process.exitCode = 1
} finally {
  if (browser) await browser.close().catch(() => undefined)
  if (server) {
    server.kill('SIGTERM')
    await new Promise((r) => setTimeout(r, 1500))
    try {
      server.kill('SIGKILL')
    } catch {
      // sudah mati
    }
  }
}
