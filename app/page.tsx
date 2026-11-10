import Enhancer from '../lib/enhancer'

export default function Home() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Foto buram? Poles saja.</h1>
      <p className="mt-2 text-sm text-muted sm:text-base">
        Polesin memperbesar dan mempertajam fotomu 2x atau 4x — langsung di browser, tanpa upload, tanpa akun, tanpa batas.
      </p>
      <div className="mt-6">
        <Enhancer />
      </div>
    </div>
  )
}
