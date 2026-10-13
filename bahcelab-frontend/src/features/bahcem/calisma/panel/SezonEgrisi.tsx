import { useMemo, useState, type CSSProperties } from 'react'
import { useEdinimler, type GostergeId } from '../../api/edinimApi'
import { usePhenology } from '../../api/agroApi'
import { useGecmisDoldurma } from '../../api/gecmisApi'
import { useNormalBantlar } from '../../api/normalBantApi'
import { useDarEkran } from '../../hooks/useDarEkran'
import { useElementWidth } from '../../hooks/useElementWidth'
import { sayi } from '../../lib/format'
import { AY_KISA, ayTarihi, bandAylari, evreAraligi, sezonNoktalari } from '../../lib/sezon'
import { useCalismaStore } from '../calismaStore'
import { GOSTERGE_KATMAN, KATMANLAR } from '../katmanlar'

const SECENEKLER: GostergeId[] = ['ndvi', 'ndre', 'lai', 'ndmi', 'msavi']
const YUKSEKLIK = 170
const KENAR = { sol: 34, sag: 10, ust: 14, alt: 6 }
const DAR_ALT = 18 // telefonda eksen etiketleri (çeyrek aylar) çizimin altında
const CEYREK_AYLAR = [0, 3, 6, 9]

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
  const yillar = (band?.find((b) => b.ay === new Date().getMonth() + 1 && b.ceyrek_yeterli) ?? band?.find((b) => b.ceyrek_yeterli))?.yillar
  const dar = useDarEkran(479) // 480 px altı: çeyrek ay etiketleri + şerit boyunca dokunma; üstünde: hizalı ay düğmeleri
  const w = Math.max(240, genislik)
  const iw = w - KENAR.sol - KENAR.sag
  const yukseklik = YUKSEKLIK + (dar ? DAR_ALT : 0)
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
  const bugunAy = new Date().getMonth() + 1
  const ortancaYol = (list: typeof koyu) => (list.length ? `M${list.map((b) => `${X(b.ay - 0.5).toFixed(1)},${Y(b.p50!).toFixed(1)}`).join(' L')}` : '')
  const ortancaGecmis = ortancaYol(koyu.filter((b) => b.ay <= bugunAy))
  const ortancaSonrasi = ortancaYol(koyu.filter((b) => b.ay >= bugunAy)) // bugünden sonrası soluk: tahmin değil, geçmiş yılların ortancası
  const sonOrtanca = koyu.find((b) => b.ay === 12) ?? koyu[koyu.length - 1]
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
          <div className="h-[170px] animate-pulse rounded bg-app-card-hover" aria-label="Sezon eğrisi yükleniyor" />
        ) : noktalar.length === 0 && koyu.length === 0 ? (
          <div className="grid h-[170px] place-items-center rounded border border-dashed border-app-border px-4 text-center text-[13px] text-app-text-muted" data-testid="sezon-bos">
            {dolduruluyor ? `Veri çekiliyor · %${gecmis?.yuzde ?? 0}. Grafik, geçmiş çekildikçe dolacak.` : 'Bu gösterge için henüz net görüntü ya da yeterli geçmiş yok.'}
          </div>
        ) : (
          <svg width={w} height={yukseklik} viewBox={`0 0 ${w} ${yukseklik}`} role="img" aria-label={`${KATMANLAR[GOSTERGE_KATMAN[gosterge]].ad}: ${yil} eğrisi ve normal bant`} className="block overflow-visible">
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
            {ortancaGecmis && <path d={ortancaGecmis} fill="none" stroke="var(--color-app-text-muted)" strokeWidth={1.2} strokeDasharray="4 3" data-testid="band-ortanca" />}
            {ortancaSonrasi && <path d={ortancaSonrasi} fill="none" stroke="var(--color-app-text-muted)" strokeWidth={1} strokeDasharray="2 4" opacity={0.4} data-testid="band-ortanca-sonrasi" />}
            {sonOrtanca && <text x={w - KENAR.sag} y={KENAR.ust + ih - 4} textAnchor="end" fontSize={10} fill="var(--color-app-text-muted)" data-testid="band-ortanca-etiket">geçmiş yılların ortancası</text>}
            <line x1={X(bugunAy - 1 + new Date().getDate() / 31)} x2={X(bugunAy - 1 + new Date().getDate() / 31)} y1={KENAR.ust} y2={KENAR.ust + ih} stroke="var(--color-app-border-strong)" strokeWidth={1} />
            {egri && <path d={egri} fill="none" stroke="var(--color-app-text)" strokeWidth={1.8} strokeLinejoin="round" data-testid="sezon-yili-egrisi" />}
            {noktalar.map((n) => <circle key={n.tarih} cx={X(n.x)} cy={Y(n.deger)} r={2.2} fill="var(--color-app-text)" />)}
            {son && (
              <text x={Math.min(X(son.x) + 6, w - 40)} y={Y(son.deger) - 6} fontSize={11} fontWeight={700} fill="var(--color-app-text)" className="num" data-testid="sezon-son-deger">{yil} · {sayi(son.deger, gosterge === 'lai' ? 1 : 2)}</text>
            )}
            {koyu.length === 0 && !dolduruluyor && (
              <text x={KENAR.sol + 6} y={KENAR.ust + 12} fontSize={11} fill="var(--color-app-text-muted)" data-testid="sezon-yetersiz-gecmis">Normal bant için yetersiz geçmiş (en az {bantlar.data?.asgari_yil_ceyrek ?? 5} yıl gerekir)</text>
            )}
            {dar && CEYREK_AYLAR.map((i) => <text key={AY_KISA[i]} x={X(i + 0.5)} y={YUKSEKLIK + 10} textAnchor="middle" fontSize={10} fill="var(--color-app-text-muted)" data-testid="eksen-ay">{AY_KISA[i]}</text>)}
          </svg>
        )}
        {dar && noktalar.length + koyu.length > 0 && (
          <div
            aria-hidden
            data-testid="sezon-dokunma"
            className="absolute top-0 cursor-pointer"
            style={{ left: KENAR.sol, width: iw, height: yukseklik }}
            onClick={(e) => {
              const kutu = e.currentTarget.getBoundingClientRect()
              aya(Math.min(12, Math.max(1, Math.floor(((e.clientX - kutu.left) / kutu.width) * 12) + 1)))
            }}
          />
        )}
        {dolduruluyor && noktalar.length > 0 && <p className="mt-1 text-[11.5px] text-app-text-muted" data-testid="sezon-doluyor">Geçmiş çekiliyor · %{gecmis?.yuzde}: bant tamamlanana kadar eksik olabilir.</p>}
      </div>
      <Fenoloji evreler={fenoloji?.evreler ?? []} yil={yil} genislik={w} />
      <div className="relative min-[480px]:mt-0.5 min-[480px]:ml-[34px] min-[480px]:grid min-[480px]:w-[var(--iw)] min-[480px]:grid-cols-12 min-[480px]:gap-0" style={{ '--iw': `${iw}px` } as CSSProperties} role="group" aria-label="Aya git (eksen)">
        {AY_KISA.map((a, i) => (
          <button key={a} type="button" onClick={() => aya(i + 1)} data-testid={`ay-${i + 1}`} className="sr-only min-[480px]:not-sr-only min-h-9 rounded text-[11px] font-medium text-app-text-muted hover:bg-app-card-hover hover:text-app-text">{a}</button>
        ))}
      </div>
      <p className="mt-1 text-[11.5px] text-app-text-dim">Açık bant: p10–p90 · koyu bant: p25–p75 · kesikli: geçmiş yılların ortancası · çizgi: {yil}. Grafiğe ya da aya dokununca harita o aya geçer.</p>
    </section>
  )
}

/** Evrelerin kısa adları (şerit etiketi için); katalog adı title'da kalır. */
const KISA_AD: Record<string, string> = { kis_dinlenme: 'Dinlenme', tomurcuklanma: 'Tomurcuk', ciceklenme: 'Çiçek', meyve_tutumu: 'Tutum', meyve_gelisimi: 'Büyüme', olgunlasma: 'Olgunlaşma' }

/** Fenoloji şeridi: katalogdaki TÜM evreler takvim yılına kırpılarak yerleştirilir; etiketler iki satıra dağıtılır (üst üste binmez). */
function Fenoloji({ evreler, yil, genislik }: { evreler: { kod: string; ad: string; baslangic: string; bitis: string }[]; yil: number; genislik: number }) {
  if (!evreler.length) return null
  const iw = genislik - KENAR.sol - KENAR.sag
  const parcalar = evreler
    .flatMap((e) => {
      const aralik = evreAraligi(e.baslangic, e.bitis, yil)
      return aralik ? [{ ...e, x0: aralik[0], x1: aralik[1] }] : []
    })
    .sort((p, q) => p.x0 - q.x0)
  const etiketli = parcalar.filter((e) => (e.x1 - e.x0) * (iw / 12) >= 30)
  return (
    <div className="relative mt-1 h-[46px]" style={{ marginLeft: KENAR.sol, width: iw }} data-testid="fenoloji-seridi" aria-label="Fenoloji evreleri (ön değer)" role="img">
      {parcalar.map((e, i) => (
        <span key={e.kod + i} title={`${e.ad} (ön değer)`} data-testid="fenoloji-evre" className="absolute top-0 h-2.5 border-l border-app-card" style={{ left: `${(e.x0 / 12) * 100}%`, width: `${((e.x1 - e.x0) / 12) * 100}%`, background: `color-mix(in srgb, var(--color-app-accent) ${14 + (i % 2) * 14}%, transparent)` }} />
      ))}
      {etiketli.map((e, i) => {
        const ad = KISA_AD[e.kod] ?? e.ad
        const yaklasik = ad.length * 5.6
        const sol = Math.min(Math.max(((e.x0 + e.x1) / 2 / 12) * iw - yaklasik / 2, 0), iw - yaklasik)
        return (
          <span key={e.kod + 'e' + i} data-testid="fenoloji-etiket" className="absolute whitespace-nowrap text-[10px] leading-3 text-app-text-muted" style={{ left: sol, top: 13 + (i % 2) * 13 }}>
            {ad}
          </span>
        )
      })}
    </div>
  )
}
