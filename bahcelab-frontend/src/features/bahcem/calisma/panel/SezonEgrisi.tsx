import { useMemo, useState } from 'react'
import { useEdinimler, type GostergeId } from '../../api/edinimApi'
import { usePhenology } from '../../api/agroApi'
import { useGecmisDoldurma } from '../../api/gecmisApi'
import { useNormalBantlar } from '../../api/normalBantApi'
import { useElementWidth } from '../../hooks/useElementWidth'
import { sayi } from '../../lib/format'
import { AY_KISA, ayTarihi, bandAylari, sezonNoktalari, yilIciKonum } from '../../lib/sezon'
import { useCalismaStore } from '../calismaStore'
import { GOSTERGE_KATMAN, KATMANLAR } from '../katmanlar'

const SECENEKLER: GostergeId[] = ['ndvi', 'ndre', 'lai', 'ndmi', 'msavi']
const YUKSEKLIK = 190
const KENAR = { sol: 34, sag: 10, ust: 14, alt: 22 }

/**
 * «Bu sezon, kendi geçmişine göre»: bu yılın eğrisi, bahçenin kendi normal bandı (p10–p90 açık, p25–p75 koyu, ortanca kesikli),
 * fenoloji şeridi. Aya dokununca harita o aya (ve göstergenin katmanına) geçer. Band/geçmiş yoksa uydurma yok: boş durum.
 */
export function SezonEgrisi({ gardenId }: { gardenId: string }) {
  const [gosterge, setGosterge] = useState<GostergeId>('ndvi')
  const [ref, genislik] = useElementWidth<HTMLDivElement>()
  const edinim = useEdinimler(gardenId)
  const bantlar = useNormalBantlar(gardenId)
  const gecmis = useGecmisDoldurma(gardenId).data
  const fenoloji = usePhenology(gardenId).data
  const setKatman = useCalismaStore((s) => s.setKatman)
  const setTarih = useCalismaStore((s) => s.setTarih)
  const yil = new Date().getFullYear()
  const noktalar = useMemo(() => sezonNoktalari(edinim.data?.edinimler ?? [], gosterge, yil), [edinim.data, gosterge, yil])
  const band = bantlar.data?.gostergeler[gosterge]
  const { koyu, acik } = bandAylari(band)
  const yillar = band?.find((b) => b.ceyrek_yeterli)?.yillar
  const w = Math.max(240, genislik)
  const iw = w - KENAR.sol - KENAR.sag
  const ih = YUKSEKLIK - KENAR.ust - KENAR.alt

  const [lo, hi] = useMemo(() => {
    const vals = [...noktalar.map((n) => n.deger), ...acik.flatMap((b) => [b.p10!, b.p90!]), ...koyu.flatMap((b) => [b.p25!, b.p75!])]
    if (!vals.length) return [0, 1] as const
    const a = Math.min(...vals)
    const b = Math.max(...vals)
    const pay = (b - a) * 0.12 || 0.05
    return [a - pay, b + pay] as const
  }, [noktalar, acik, koyu])
  const X = (konum: number) => KENAR.sol + (konum / 12) * iw
  const Y = (v: number) => KENAR.ust + (1 - (v - lo) / (hi - lo || 1)) * ih
  const aySerisi = (list: typeof koyu, alt: 'p25' | 'p10', ust: 'p75' | 'p90') => {
    if (!list.length) return ''
    const sol = list.map((b) => `${X(b.ay - 0.5).toFixed(1)},${Y(b[ust]!).toFixed(1)}`)
    const sag = [...list].reverse().map((b) => `${X(b.ay - 0.5).toFixed(1)},${Y(b[alt]!).toFixed(1)}`)
    return `M${[...sol, ...sag].join(' L')}Z`
  }
  const ortanca = koyu.length ? `M${koyu.map((b) => `${X(b.ay - 0.5).toFixed(1)},${Y(b.p50!).toFixed(1)}`).join(' L')}` : ''
  const egri = noktalar.length ? `M${noktalar.map((n) => `${X(n.x).toFixed(1)},${Y(n.deger).toFixed(1)}`).join(' L')}` : ''
  const son = noktalar[noktalar.length - 1]
  const dolduruluyor = gecmis?.durum === 'isleniyor'

  const aya = (ay: number) => {
    const tarih = ayTarihi(edinim.data?.edinimler ?? [], yil, ay, gosterge)
    setKatman(GOSTERGE_KATMAN[gosterge])
    if (tarih) setTarih(tarih)
  }

  return (
    <section aria-label="Bu sezon, kendi geçmişine göre" className="rounded-md border border-app-border bg-app-card p-3.5" data-testid="sezon-egrisi">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[13px] font-semibold">Bu sezon, kendi geçmişine göre</h3>
        {yillar && <span className="num text-[11.5px] text-app-text-muted">{yillar.length} yıl · {Math.min(...yillar)}–{Math.max(...yillar)}</span>}
      </div>
      <div role="tablist" aria-label="Gösterge" className="mt-2 flex flex-wrap gap-1">
        {SECENEKLER.map((g) => (
          <button key={g} role="tab" type="button" aria-selected={gosterge === g} onClick={() => setGosterge(g)} data-testid={`sezon-${g}`} className={`min-h-9 rounded-md px-2.5 text-[12px] font-semibold max-[560px]:min-h-11 ${gosterge === g ? 'bg-app-text text-app-panel' : 'text-app-text-muted hover:bg-app-card-hover'}`}>
            {KATMANLAR[GOSTERGE_KATMAN[g]].ad}
          </button>
        ))}
      </div>
      <div ref={ref} className="relative mt-2">
        {edinim.isLoading || bantlar.isLoading ? (
          <div className="h-[190px] animate-pulse rounded bg-app-card-hover" aria-label="Sezon eğrisi yükleniyor" />
        ) : noktalar.length === 0 && koyu.length === 0 ? (
          <div className="grid h-[190px] place-items-center rounded border border-dashed border-app-border px-4 text-center text-[13px] text-app-text-muted" data-testid="sezon-bos">
            {dolduruluyor ? `Veri çekiliyor · %${gecmis?.yuzde ?? 0}. Grafik, geçmiş çekildikçe dolacak.` : 'Bu gösterge için henüz net görüntü ya da yeterli geçmiş yok.'}
          </div>
        ) : (
          <svg width={w} height={YUKSEKLIK} viewBox={`0 0 ${w} ${YUKSEKLIK}`} role="img" aria-label={`${KATMANLAR[GOSTERGE_KATMAN[gosterge]].ad}: ${yil} eğrisi ve normal bant`} className="block overflow-visible">
            {[0, 0.5, 1].map((t) => {
              const v = lo + (hi - lo) * t
              return (
                <g key={t}>
                  <line x1={KENAR.sol} x2={w - KENAR.sag} y1={Y(v)} y2={Y(v)} stroke="var(--color-app-border)" strokeWidth={0.6} />
                  <text x={KENAR.sol - 5} y={Y(v) + 3.5} textAnchor="end" fontSize={10} fill="var(--color-app-text-muted)" className="num">{sayi(v, gosterge === 'lai' ? 1 : 2)}</text>
                </g>
              )
            })}
            {acik.length > 0 && <path d={aySerisi(acik, 'p10', 'p90')} fill="color-mix(in srgb, var(--color-app-accent) 12%, transparent)" data-testid="band-p10-p90" />}
            {koyu.length > 0 && <path d={aySerisi(koyu, 'p25', 'p75')} fill="color-mix(in srgb, var(--color-app-accent) 26%, transparent)" data-testid="band-p25-p75" />}
            {ortanca && <path d={ortanca} fill="none" stroke="var(--color-app-text-muted)" strokeWidth={1.2} strokeDasharray="4 3" data-testid="band-ortanca" />}
            {egri && <path d={egri} fill="none" stroke="var(--color-app-text)" strokeWidth={1.8} strokeLinejoin="round" data-testid="sezon-yili-egrisi" />}
            {noktalar.map((n) => <circle key={n.tarih} cx={X(n.x)} cy={Y(n.deger)} r={2.2} fill="var(--color-app-text)" />)}
            {son && (
              <text x={Math.min(X(son.x) + 6, w - 40)} y={Y(son.deger) - 6} fontSize={11} fontWeight={700} fill="var(--color-app-text)" className="num" data-testid="sezon-son-deger">{yil} · {sayi(son.deger, gosterge === 'lai' ? 1 : 2)}</text>
            )}
            {koyu.length === 0 && !dolduruluyor && (
              <text x={KENAR.sol + 6} y={KENAR.ust + 12} fontSize={11} fill="var(--color-app-text-muted)" data-testid="sezon-yetersiz-gecmis">Normal bant için yetersiz geçmiş (en az {bantlar.data?.asgari_yil_ceyrek ?? 5} yıl gerekir)</text>
            )}
            {AY_KISA.map((a, i) => (i % 3 === 0 || w > 360 ? <text key={a} x={X(i + 0.5)} y={YUKSEKLIK - 6} textAnchor="middle" fontSize={10} fill="var(--color-app-text-muted)">{a}</text> : null))}
          </svg>
        )}
        {dolduruluyor && noktalar.length > 0 && <p className="mt-1 text-[11.5px] text-app-text-muted" data-testid="sezon-doluyor">Geçmiş çekiliyor · %{gecmis?.yuzde}: bant tamamlanana kadar eksik olabilir.</p>}
      </div>
      <Fenoloji evreler={fenoloji?.evreler ?? []} yil={yil} genislik={w} />
      <div className="mt-1 grid grid-cols-6 gap-1 min-[480px]:grid-cols-12" role="group" aria-label="Aya git">
        {AY_KISA.map((a, i) => (
          <button key={a} type="button" onClick={() => aya(i + 1)} data-testid={`ay-${i + 1}`} className="min-h-9 rounded text-[11.5px] font-medium text-app-text-muted hover:bg-app-card-hover hover:text-app-text max-[560px]:min-h-11">{a}</button>
        ))}
      </div>
      <p className="mt-1 text-[11.5px] text-app-text-dim">Açık bant: p10–p90 · koyu bant: p25–p75 · kesikli: ortanca · çizgi: {yil}. Aya dokununca harita o aya geçer.</p>
    </section>
  )
}

/** Fenoloji şeridi: katalogdaki evreler (ön değer) takvim yılı eksenine yerleştirilir. */
function Fenoloji({ evreler, yil, genislik }: { evreler: { kod: string; ad: string; baslangic: string; bitis: string }[]; yil: number; genislik: number }) {
  if (!evreler.length) return null
  const iw = genislik - KENAR.sol - KENAR.sag
  const parcalar = evreler
    .map((e) => {
      const bas = e.baslangic.slice(0, 4) < String(yil) ? 0 : yilIciKonum(e.baslangic) - 0.5
      const bit = e.bitis.slice(0, 4) > String(yil) ? 12 : yilIciKonum(e.bitis) + 0.5
      return { ...e, x0: Math.max(0, bas), x1: Math.min(12, bit) }
    })
    .filter((e) => e.x1 > e.x0)
    .sort((p, q) => p.x0 - q.x0)
  // Komşu evreler birbirine taşmasın: her evre öncekinin bittiği yerden başlar
  parcalar.forEach((e, i) => {
    if (i > 0) e.x0 = Math.max(e.x0, parcalar[i - 1].x1)
    e.x1 = Math.max(e.x1, e.x0)
  })
  return (
    <div className="relative mt-1 h-6" style={{ marginLeft: KENAR.sol, width: iw }} data-testid="fenoloji-seridi" aria-label="Fenoloji evreleri (ön değer)" role="img">
      {parcalar.map((e, i) => (
        <span key={e.kod + i} title={e.ad} className="absolute top-0 h-5 overflow-hidden whitespace-nowrap border-l border-app-card px-1 text-[10px] leading-5 text-app-text" style={{ left: `${(e.x0 / 12) * 100}%`, width: `${(Math.max(0, e.x1 - e.x0) / 12) * 100}%`, background: `color-mix(in srgb, var(--color-app-accent) ${10 + (i % 2) * 8}%, transparent)` }}>
          {(e.x1 - e.x0) * (iw / 12) > 90 ? e.ad : ''}
        </span>
      ))}
    </div>
  )
}
