import { useEffect, useRef } from 'react'
import { HARITA } from '../../../map/haritaRenkleri'

/** Yağış günü: eğik çizgi damlaları (2B tuval, requestAnimationFrame; React yeniden çizimi yok). Yalnız yağış ≥ 1 mm ve hareketi azalt kapalıyken bağlanır. */
export function YagmurKanvasi({ mm }: { mm: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    let raf = 0
    const yeniBoyut = () => {
      const r = c.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      c.width = Math.max(1, Math.round(r.width * dpr))
      c.height = Math.max(1, Math.round(r.height * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    yeniBoyut()
    const adet = Math.round(Math.min(220, 50 + mm * 10))
    const damla = Array.from({ length: adet }, () => ({ x: Math.random(), y: Math.random(), h: 0.6 + Math.random() * 0.8, u: 8 + Math.random() * 8 }))
    const renk = getComputedStyle(document.documentElement).getPropertyValue('--color-app-water').trim() || HARITA.r2a78d6
    const dongu = () => {
      const w = c.clientWidth
      const h = c.clientHeight
      ctx.clearRect(0, 0, w, h)
      ctx.strokeStyle = renk
      ctx.globalAlpha = 0.5
      ctx.lineWidth = 1.2
      ctx.beginPath()
      for (const d of damla) {
        const x = d.x * w
        const y = d.y * h
        ctx.moveTo(x, y)
        ctx.lineTo(x - d.u * 0.35, y + d.u)
        d.y += (d.h * 0.012)
        d.x -= 0.0015
        if (d.y > 1) { d.y = -0.05; d.x = Math.random() * 1.1 }
        if (d.x < -0.05) d.x = 1
      }
      ctx.stroke()
      raf = requestAnimationFrame(dongu)
    }
    raf = requestAnimationFrame(dongu)
    window.addEventListener('resize', yeniBoyut)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', yeniBoyut) }
  }, [mm])
  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 z-[5] h-full w-full" data-testid="yagmur" />
}
