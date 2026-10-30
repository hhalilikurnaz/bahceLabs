import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { reducedMotion } from '@/lib/motion'
import { useCalismaStore } from '../calismaStore'

export type Durak = 'kapali' | 'yarim' | 'tam'
const SIRA: Durak[] = ['kapali', 'yarim', 'tam']
const ETIKET: Record<Durak, string> = { kapali: 'kapalı', yarim: 'yarım', tam: 'tam' }
const KAPALI_PX = 132 // tutamak + karar cümlesi görünür kalır

/**
 * Mobil alt sayfa (≤ 899 px): harita üstte tam ekran, panel alttan. ÜÇ DURAK (kapalı / yarım / tam); sürüklemede parmağı izler,
 * bırakınca hız ve yakınlığa göre en yakın durağa ağır sönümlü (zıplamasız) yayla oturur. Tutamak bölgesi CAM. Klavye: ↑ ↓ ya da Enter.
 */
export function AltSayfa({ children, baslangic = 'yarim' }: { children: ReactNode; baslangic?: Durak }) {
  const kap = useRef<HTMLDivElement>(null)
  const sayfa = useRef<HTMLDivElement>(null)
  const [durak, setDurak] = useState<Durak>(baslangic)
  const [canli, setCanli] = useState<number | null>(null)
  const sur = useRef<{ y0: number; ofs0: number; t0: number; son: number; vel: number } | null>(null)
  const yuk = () => (kap.current?.clientHeight ?? 700)
  const tamPx = () => Math.round(yuk() * 0.7) // tam durakta bile haritada bahçe için şerit kalır
  const gorunur = (d: Durak) => (d === 'kapali' ? KAPALI_PX : d === 'yarim' ? Math.round(yuk() * 0.5) : tamPx())
  const ofset = (d: Durak) => tamPx() - gorunur(d)
  const setAltSayfaPx = useCalismaStore((s) => s.setAltSayfaPx)
  useEffect(() => () => void (sur.current = null), [])
  // Harita, sayfanın görünür yüksekliğini dolgu sayar (bahçe çokgeni her durakta görünür)
  useEffect(() => {
    setAltSayfaPx(gorunur(durak))
    return () => setAltSayfaPx(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durak, setAltSayfaPx])
  const bas = (e: PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    sur.current = { y0: e.clientY, ofs0: ofset(durak), t0: e.timeStamp, son: e.clientY, vel: 0 }
  }
  const tasi = (e: PointerEvent<HTMLButtonElement>) => {
    const s = sur.current
    if (!s) return
    s.vel = (e.clientY - s.son) / Math.max(1, e.timeStamp - s.t0)
    s.son = e.clientY
    s.t0 = e.timeStamp
    setCanli(Math.min(ofset('kapali'), Math.max(0, s.ofs0 + (e.clientY - s.y0))))
  }
  const birak = () => {
    const s = sur.current
    sur.current = null
    if (!s || canli === null) return
    const hedefOfs = canli + s.vel * 160 // hızla ileri tahmin
    const en = SIRA.reduce((b, d) => (Math.abs(ofset(d) - hedefOfs) < Math.abs(ofset(b) - hedefOfs) ? d : b), durak)
    setCanli(null)
    setDurak(en)
  }
  const tus = (e: KeyboardEvent<HTMLButtonElement>) => {
    const i = SIRA.indexOf(durak)
    if (e.key === 'ArrowUp') setDurak(SIRA[Math.min(2, i + 1)])
    else if (e.key === 'ArrowDown') setDurak(SIRA[Math.max(0, i - 1)])
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDurak(SIRA[(i + 1) % 3]) }
  }
  const ty = canli ?? ofset(durak)
  return (
    <div ref={kap} className="pointer-events-none absolute inset-0 z-30" data-testid="alt-sayfa-kap">
      <div
        ref={sayfa}
        data-testid="alt-sayfa"
        data-durak={durak}
        className="pointer-events-auto absolute inset-x-0 bottom-0 flex flex-col overflow-hidden rounded-t-xl border border-b-0 border-app-border bg-app-canvas"
        style={{ height: tamPx(), transform: `translateY(${ty}px)`, transition: canli !== null || reducedMotion() ? 'none' : 'transform 300ms cubic-bezier(0.22, 1, 0.36, 1)' }}
      >
        <button
          type="button"
          role="slider"
          aria-label="Panel yüksekliği"
          aria-valuemin={0}
          aria-valuemax={2}
          aria-valuenow={SIRA.indexOf(durak)}
          aria-valuetext={ETIKET[durak]}
          data-testid="alt-sayfa-tutamak"
          onPointerDown={bas}
          onPointerMove={tasi}
          onPointerUp={birak}
          onPointerCancel={birak}
          onKeyDown={tus}
          className="glass relative z-10 flex h-11 w-full shrink-0 cursor-grab touch-none items-center justify-center rounded-b-none rounded-t-xl border-x-0 border-t-0 active:cursor-grabbing"
        >
          <span className="h-1 w-9 rounded-full bg-app-border-strong" />
        </button>
        <div className="flex min-h-0 flex-1 flex-col" style={{ pointerEvents: durak === 'kapali' ? 'none' : 'auto' }}>{children}</div>
      </div>
    </div>
  )
}
