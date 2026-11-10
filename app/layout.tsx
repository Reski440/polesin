import './globals.css'
import type { ReactNode } from 'react'

export const metadata = {
  title: 'Polesin — Penjernih Foto AI di Browser',
  description: 'Perbesar dan pertajam foto 2x/4x langsung di browser. Tanpa upload, tanpa akun, tanpa batas.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body>
        <header className="border-b border-line">
          <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
            <span className="text-lg font-bold tracking-tight">
              Polesin<span className="text-sky-400">.</span>
            </span>
            <span className="text-xs text-muted">100% di browser · tanpa batas</span>
          </div>
        </header>
        <main className="mx-auto max-w-2xl px-4 py-6 sm:py-8">{children}</main>
        <footer className="mx-auto max-w-2xl px-4 pb-8 text-xs text-muted">
          Polesin memakai model ESRGAN open-source (UpscalerJS). Foto diproses di perangkatmu dan tidak pernah di-upload ke
          server mana pun.
        </footer>
      </body>
    </html>
  )
}
