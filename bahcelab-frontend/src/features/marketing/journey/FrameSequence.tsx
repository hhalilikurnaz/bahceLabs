import { useEffect, useRef, type CSSProperties, type RefObject } from 'react'

export type SequenceSource = { path: string; count: number; ext: string }

type FrameSequenceProps = {
  desktop: SequenceSource
  mobile?: SequenceSource
  pad?: number
  progressRef: RefObject<number>
  from?: number
  to?: number
  className?: string
  style?: CSSProperties
  onFirstFrame?: () => void
  idle?: number
}

export function FrameSequence({
  desktop,
  mobile,
  pad = 4,
  progressRef,
  from = 0,
  to = 1,
  className,
  style,
  onFirstFrame,
  idle = 0,
}: FrameSequenceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const g = canvas.getContext('2d', { alpha: false })
    if (!g) return

    const small = window.matchMedia('(max-width: 767px)').matches
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
      ?.saveData
    const src = (small || saveData) && mobile ? mobile : desktop
    const n = src.count
    const url = (i: number) => `${src.path}${String(i + 1).padStart(pad, '0')}.${src.ext}`
    const idleSpan = Math.max(0, Math.min(1, idle)) * (n - 1)

    const frames: (HTMLImageElement | null)[] = new Array(n).fill(null)
    let cancelled = false
    let visible = true
    let raf = 0
    let lastDrawn = -1
    let W = 0
    let H = 0

    const idleEnd = Math.ceil(idleSpan)
    const order: number[] = []
    const seen = new Set<number>()
    // Boşta oynatma aralığındaki kareleri önce sık yükle (aksi halde idle akıcı görünmez)
    for (let i = 0; i <= idleEnd && i < n; i++) {
      seen.add(i)
      order.push(i)
    }
    for (const stride of [n, 16, 8, 4, 2, 1]) {
      for (let i = 0; i < n; i += stride) if (!seen.has(i)) (seen.add(i), order.push(i))
    }
    if (!seen.has(n - 1)) order.push(n - 1)

    let cursor = 0
    let inflight = 0
    const MAX = 6
    const pump = () => {
      while (!cancelled && inflight < MAX && cursor < order.length) {
        const i = order[cursor++]
        inflight++
        const img = new Image()
        img.decoding = 'async'
        img.src = url(i)
        img
          .decode()
          .then(() => {
            if (cancelled) return
            frames[i] = img
            if (i === 0) onFirstFrame?.()
            lastDrawn = -1
            schedule()
          })
          .catch(() => {})
          .finally(() => {
            inflight--
            pump()
          })
      }
    }

    const nearest = (target: number) => {
      if (frames[target]) return target
      for (let d = 1; d < n; d++) {
        if (target - d >= 0 && frames[target - d]) return target - d
        if (target + d < n && frames[target + d]) return target + d
      }
      return -1
    }

    const drawFrame = (idx: number) => {
      const img = frames[idx]
      if (!img) return
      const iw = img.naturalWidth
      const ih = img.naturalHeight
      const s = Math.max(W / iw, H / ih)
      const dw = iw * s
      const dh = ih * s
      g.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh)
    }

    let shown = 0
    let base = 0
    let phase = 0
    let lastT = performance.now()
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    /** İleri-geri bir tam tur (sn) */
    const IDLE_PERIOD = 7

    const tick = (now: number) => {
      raf = 0
      const dt = Math.min(0.1, (now - lastT) / 1000)
      lastT = now
      const p = Math.min(1, Math.max(0, (progressRef.current - from) / (to - from)))
      let target: number
      const isIdle = p <= 0.002 && idleSpan > 0 && !reduce
      if (isIdle) {
        phase += (dt * 2) / IDLE_PERIOD
        if (phase >= 2) phase -= 2
        const u = phase <= 1 ? phase : 2 - phase
        shown = u * idleSpan
        base = shown
        const idx = Math.round(shown)
        const drawIdx = frames[idx] ? idx : nearest(idx)
        if (drawIdx >= 0 && drawIdx !== lastDrawn) {
          drawFrame(drawIdx)
          lastDrawn = drawIdx
        }
      } else {
        target = base + p * (n - 1 - base)
        shown += (target - shown) * Math.min(1, dt * 12)
        if (Math.abs(target - shown) < 0.02) shown = target
        if (idleSpan > 0)
          phase = Math.acos(Math.max(-1, Math.min(1, 1 - (2 * Math.min(base, idleSpan)) / idleSpan)))
        const idx = nearest(Math.round(shown))
        if (idx >= 0 && idx !== lastDrawn) {
          drawFrame(idx)
          lastDrawn = idx
        }
      }
      if (visible) raf = requestAnimationFrame(tick)
    }
    const schedule = () => {
      if (!raf && visible) raf = requestAnimationFrame(tick)
    }

    const resize = () => {
      const r = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      W = Math.max(1, Math.round(r.width * dpr))
      H = Math.max(1, Math.round(r.height * dpr))
      canvas.width = W
      canvas.height = H
      lastDrawn = -1
      schedule()
    }

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting
      if (visible) schedule()
      else if (raf) {
        cancelAnimationFrame(raf)
        raf = 0
      }
    })
    io.observe(canvas)
    resize()
    pump()

    return () => {
      cancelled = true
      ro.disconnect()
      io.disconnect()
      if (raf) cancelAnimationFrame(raf)
    }
  }, [desktop, mobile, pad, progressRef, from, to, onFirstFrame, idle])

  return <canvas ref={canvasRef} className={className} style={style} aria-hidden="true" />
}
