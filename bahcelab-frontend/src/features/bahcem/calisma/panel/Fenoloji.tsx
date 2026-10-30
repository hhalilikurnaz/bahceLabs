import { evreAraligi } from '../../lib/sezon'

/** Evrelerin kısa adları (şerit etiketi için); katalog adı title'da kalır. */
const KISA_AD: Record<string, string> = { kis_dinlenme: 'Dinlenme', tomurcuklanma: 'Tomurcuk', ciceklenme: 'Çiçek', meyve_tutumu: 'Tutum', meyve_gelisimi: 'Büyüme', olgunlasma: 'Olgunlaşma' }

/** Fenoloji şeridi: katalogdaki TÜM evreler takvim yılına kırpılarak yerleştirilir; etiketler iki satıra dağıtılır (üst üste binmez). */
export function Fenoloji({ evreler, yil, genislik }: { evreler: { kod: string; ad: string; baslangic: string; bitis: string }[]; yil: number; genislik: number }) {
  if (!evreler.length) return null
  const iw = genislik - 36 - 10
  const parcalar = evreler
    .flatMap((e) => {
      const aralik = evreAraligi(e.baslangic, e.bitis, yil)
      return aralik ? [{ ...e, x0: aralik[0], x1: aralik[1] }] : []
    })
    .sort((p, q) => p.x0 - q.x0)
  const etiketli = parcalar.filter((e) => (e.x1 - e.x0) * (iw / 12) >= 30)
  return (
    <div className="relative mt-1 h-[52px]" style={{ marginLeft: 36, width: iw }} data-testid="fenoloji-seridi" aria-label="Fenoloji evreleri (ön değer)" role="img">
      {parcalar.map((e, i) => (
        <span key={e.kod + i} title={`${e.ad} (ön değer)`} data-testid="fenoloji-evre" className="absolute top-0 h-2.5 border-l border-app-card" style={{ left: `${(e.x0 / 12) * 100}%`, width: `${((e.x1 - e.x0) / 12) * 100}%`, background: `color-mix(in srgb, var(--color-app-accent) ${14 + (i % 2) * 14}%, transparent)` }} />
      ))}
      {etiketli.map((e, i) => {
        const ad = KISA_AD[e.kod] ?? e.ad
        const yaklasik = ad.length * 5.6
        const sol = Math.min(Math.max(((e.x0 + e.x1) / 2 / 12) * iw - yaklasik / 2, 0), iw - yaklasik)
        return (
          <span key={e.kod + 'e' + i} data-testid="fenoloji-etiket" className="absolute whitespace-nowrap text-caption leading-4 text-app-text-muted" style={{ left: sol, top: 15 + (i % 2) * 16 }}>
            {ad}
          </span>
        )
      })}
    </div>
  )
}
