import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cx } from '@/components/ui/cx'
import { MOTION, reducedMotion } from '@/lib/motion'

/**
 * Sağ panel ortak parçaları: her sekme AYNI düzende (ilke 1, 2):
 *   karar cümlesi → tek büyük sayı (+ küçük gerçek değer, veri yaşı) → tek kanıt grafiği → Yapılacaklar (AÇIK) → ikincil kartlar → ayrıntı akordeonu.
 */

/** Panel kabuğu: kaydırınca karar cümlesi kısalarak üstte CAM başlık olarak kalır (yalnız kaydırınca). */
export function PanelKabuk({ karar, testId, children }: { karar: string | null; testId: string; children: ReactNode }) {
  const kap = useRef<HTMLDivElement>(null)
  const [kaydi, setKaydi] = useState(false)
  useEffect(() => {
    const el = kap.current
    if (!el) return
    const f = () => setKaydi(el.scrollTop > 96)
    f()
    el.addEventListener('scroll', f, { passive: true })
    return () => el.removeEventListener('scroll', f)
  }, [])
  return (
    <div ref={kap} className="relative min-h-0 flex-1 overflow-y-auto bg-app-canvas" data-testid={testId}>
      {karar && (
        <div aria-hidden={!kaydi} data-testid="yapiskan-baslik" data-gorunur={String(kaydi)} className={cx('glass sticky top-0 z-20 -mb-11 flex h-11 items-center rounded-none border-x-0 border-t-0 px-5 text-lead font-semibold transition-[opacity,transform] duration-150 ease-out', kaydi ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0 pointer-events-none')}>
          <span className="truncate">{karar}</span>
        </div>
      )}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 p-3">{children}</div>
    </div>
  )
}

let sayiBir = false // «yalnız sayfa ilk açılışında 400 ms sayarak gelir»
/** Büyük sayı: sayısal ise ilk açılışta 400 ms sayarak gelir (reduced-motion'da anında); sonra sabit. */
export function BuyukSayi({ metin, className }: { metin: string; className?: string }) {
  const m = /^([+−-]?%?)(\d+(?:,\d+)?)(.*)$/.exec(metin)
  const hedef = m ? Number(m[2].replace(',', '.')) : null
  const ondalik = m && m[2].includes(',') ? m[2].split(',')[1].length : 0
  const [v, setV] = useState<number | null>(hedef !== null && !sayiBir && !reducedMotion() ? 0 : hedef)
  useEffect(() => {
    if (hedef === null) return
    if (sayiBir || reducedMotion()) return
    const t0 = performance.now()
    let raf = 0
    const adim = (t: number) => {
      const k = Math.min(1, (t - t0) / MOTION.sayi)
      setV(hedef * (1 - (1 - k) ** 3))
      if (k < 1) raf = requestAnimationFrame(adim)
      else { setV(hedef); sayiBir = true } // yalnız TAMAMLANINCA işaretlenir (StrictMode çift çalıştırmasına dayanıklı)
    }
    raf = requestAnimationFrame(adim)
    return () => cancelAnimationFrame(raf)
  }, [hedef])
  const goster = m && v !== null ? `${m[1]}${v.toFixed(ondalik).replace('.', ',')}${m[3]}` : metin
  return <span className={cx('font-semibold leading-none tabular-nums text-app-text', className)} aria-label={metin} data-testid="buyuk-sayi">{goster}</span>
}

/** Karar bloğu: başlık = cevap cümlesi; tek büyük sayı; küçük gerçek değer ve veri yaşı. */
export function KararBlogu({ karar, alt, sayi, etiket, kucuk, yas, children, testId = 'karar-blogu' }: { karar: string; alt?: ReactNode; sayi?: string | null; etiket?: string; kucuk?: ReactNode; yas?: ReactNode; children?: ReactNode; testId?: string }) {
  return (
    <section aria-label="Karar" className="rounded-md border border-app-border bg-app-card p-5" data-testid={testId}>
      <h2 className="text-h1 font-semibold text-app-text" style={{ textWrap: 'balance' }} data-testid="karar-cumlesi">{karar}</h2>
      {alt && <p className="mt-2 text-body text-app-text-muted" data-testid="karar-alt">{alt}</p>}
      {sayi && (
        <div className="mt-4 flex items-end gap-4">
          <BuyukSayi metin={sayi} className="text-metric" />
          <div className="min-w-0 pb-1">
            {etiket && <b className="block text-body font-semibold text-app-text">{etiket}</b>}
            {kucuk && <span className="block text-small text-app-text-muted">{kucuk}</span>}
            {yas}
          </div>
        </div>
      )}
      {children}
    </section>
  )
}

/** Yapılacaklar: varsa AÇIK liste (akordeona gizlenmez). */
export function Yapilacaklar({ children, testId = 'yapilacaklar' }: { children: ReactNode; testId?: string }) {
  return (
    <section aria-label="Yapılacaklar" className="rounded-md border border-app-border bg-app-card p-4" data-testid={testId}>
      <h3 className="text-lead font-semibold text-app-text">Yapılacaklar</h3>
      {children}
    </section>
  )
}

/** Ayrıntı akordeonları: tek çerçeve, ince çizgi. */
export function Akordeonlar({ children, testId = 'ayrinti-akordeonlari' }: { children: ReactNode; testId?: string }) {
  return <div className="overflow-hidden rounded-md border border-app-border bg-app-card [&>details:last-child]:border-b-0" data-testid={testId}>{children}</div>
}
export function Akordeon({ baslik, ozet, children, acik = false, testId }: { baslik: string; ozet?: string; children?: ReactNode; acik?: boolean; testId?: string }) {
  return (
    <details open={acik} className="group border-b border-app-border px-5" data-testid={testId}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
        <span className="whitespace-nowrap text-body font-semibold text-app-text">{baslik}</span>
        {ozet && <span className="min-w-0 flex-1 truncate text-small text-app-text-dim">{ozet}</span>}
        <span aria-hidden className="ml-auto text-app-text-dim transition-transform duration-150 group-open:rotate-180">⌄</span>
      </summary>
      {children && <div className="pb-4">{children}</div>}
    </details>
  )
}

/** Tek satır «yakında» (boş sekme; sekme pasif görünür). */
export function YakindaSatiri({ ad, ne }: { ad: string; ne: string }) {
  return (
    <section className="rounded-md border border-app-border bg-app-card p-5" data-testid="yakinda-satiri">
      <h2 className="text-h2 font-semibold text-app-text">{ad}</h2>
      <p className="mt-1 text-body text-app-text-muted"><span className="mr-2 rounded-[4px] border border-app-border px-1.5 py-px text-caption font-medium text-app-text-dim">yakında</span>{ne}</p>
    </section>
  )
}

/** İkincil kart: ana kanıttan sonra gelen küçük grafik/tablo kartı. */
export function IkincilKart({ baslik, children, testId }: { baslik: string; children: ReactNode; testId?: string }) {
  return (
    <section className="rounded-md border border-app-border bg-app-card p-4" data-testid={testId}>
      <h3 className="text-lead font-semibold text-app-text">{baslik}</h3>
      <div className="mt-2">{children}</div>
    </section>
  )
}
