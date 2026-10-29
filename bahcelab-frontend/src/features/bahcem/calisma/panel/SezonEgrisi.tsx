import { useMemo, useState, type CSSProperties } from 'react'
import { useEdinimler, type GostergeId } from '../../api/edinimApi'
import { useCanlilikEgrisi } from '../../api/egriApi'
import { bantYolu, cizgiYolu, parcala, radarAraliklari, tahminEtiketi, yilNoktalari } from '../../lib/canlilikEgrisi'
import { usePhenology } from '../../api/agroApi'
import { useGecmisDoldurma } from '../../api/gecmisApi'
import { useNormalBantlar } from '../../api/normalBantApi'
import { useDarEkran } from '../../hooks/useDarEkran'
import { useElementWidth } from '../../hooks/useElementWidth'
import { sayi } from '../../lib/format'
import { AY_ADI, AY_KISA, ayTarihi, bandAylari, evreAraligi, sezonNoktalari, yilIciKonum } from '../../lib/sezon'
import { useCalismaStore } from '../calismaStore'
import { GOSTERGE_KATMAN, KATMAN_KISA_AD, KATMANLAR, type KatmanId } from '../katmanlar'

const SECENEKLER: GostergeId[] = ['ndvi', 'ndre', 'lai', 'ndmi', 'msavi']
const YUKSEKLIK = 170
const KENAR = { sol: 34, sag: 10, ust: 14, alt: 6 }
const DAR_ALT = 18 // telefonda eksen etiketleri (çeyrek aylar) çizimin altında
const CEYREK_AYLAR = [0, 3, 6, 9]

/**
 * «Bu sezon, kendi geçmişine göre»: bu yılın eğrisi, bahçenin kendi normal bandı (p10–p90 açık, p25–p75 koyu, ortanca kesikli),
 * fenoloji şeridi. Aya dokununca harita o aya (ve göstergenin katmanına) geçer. Band/geçmiş yoksa uydurma yok: boş durum.
 */
export function SezonEgrisi({ gardenId, gostergeler = SECENEKLER, onAy, baslikSezonSayili = false }: { gardenId: string; gostergeler?: GostergeId[]; baslikSezonSayili?: boolean; onAy?: (katman: KatmanId, tarih: string | null, ay: number) => void }) {
  const [gosterge, setGosterge] = useState<GostergeId>(gostergeler[0] ?? 'ndvi')
  const [notAcik, setNotAcik] = useState(false)
  const [ref, genislik] = useElementWidth<HTMLDivElement>()
  const edinim = useEdinimler(gardenId)
  const bantlar = useNormalBantlar(gardenId)
  const gecmis = useGecmisDoldurma(gardenId).data
  const fenoloji = usePhenology(gardenId).data
  const setKatman = useCalismaStore((s) => s.setKatman)
  const setTarih = useCalismaStore((s) => s.setTarih)
  const yil = new Date().getFullYear()
  const egriSorgu = useCanlilikEgrisi(gardenId)
  const kesintisiz = gosterge === 'ndvi' && egriSorgu.data?.yeterli ? egriSorgu.data : null // yalnız canlılık (NDVI) için: HLS + Sentinel-2 gözlemlerinden
  const egriNoktalari = useMemo(() => (kesintisiz ? yilNoktalari(kesintisiz.noktalar, yil) : []), [kesintisiz, yil])
  const gozlemler = useMemo(() => (kesintisiz ? yilNoktalari(kesintisiz.gozlemler, yil) : []), [kesintisiz, yil])
  const radarIsaretleri = useMemo(() => (kesintisiz ? radarAraliklari(yilNoktalari(kesintisiz.radar_isaretleri, yil)) : []), [kesintisiz, yil])
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
    const vals = [...noktalar.map((n) => n.deger), ...egriNoktalari.flatMap((n) => [n.alt, n.ust]), ...acik.flatMap((b) => [b.p10!, b.p90!]), ...koyu.flatMap((b) => [b.p25!, b.p75!])]
    if (!vals.length) return [0, 1] as const
    const a = Math.min(...vals)
    const b = Math.max(...vals)
    const pay = (b - a) * 0.12 || 0.05
    return [a - pay, b + pay] as const
  }, [noktalar, egriNoktalari, acik, koyu])
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
    if (onAy) return onAy(GOSTERGE_KATMAN[gosterge], tarih, ay)
    setKatman(GOSTERGE_KATMAN[gosterge])
    if (tarih) setTarih(tarih)
  }

  return (
    <section aria-label="Bu sezon, kendi geçmişine göre" className="rounded-md border border-app-border bg-app-card p-3.5" data-testid="sezon-egrisi">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[13px] font-semibold">{baslikSezonSayili && yillar ? `Bu sezon, önceki ${yillar.length} sezon içinde` : 'Bu sezon, kendi geçmişine göre'}</h3>
        {yillar && <span className="num text-[11.5px] text-app-text-muted">{yillar.length} yıl · {Math.min(...yillar)}–{Math.max(...yillar)}</span>}
      </div>
      <div role="tablist" aria-label="Gösterge" className="mt-2 flex flex-nowrap gap-1 overflow-x-auto [scrollbar-width:none]" data-testid="sezon-sekmeleri">
        {gostergeler.map((g) => (
          <button key={g} role="tab" type="button" aria-selected={gosterge === g} aria-label={KATMANLAR[GOSTERGE_KATMAN[g]].ad} title={KATMANLAR[GOSTERGE_KATMAN[g]].ad} onClick={() => setGosterge(g)} data-testid={`sezon-${g}`} className={`min-h-9 shrink-0 whitespace-nowrap rounded-md px-2.5 text-[12px] font-semibold max-[560px]:min-h-11 max-[560px]:min-w-11 max-[560px]:px-2 ${gosterge === g ? 'bg-app-text text-app-panel' : 'text-app-text-muted hover:bg-app-card-hover'}`}>
            <span aria-hidden className="max-[560px]:hidden">{KATMANLAR[GOSTERGE_KATMAN[g]].ad}</span>
            <span aria-hidden className="min-[561px]:hidden">{KATMAN_KISA_AD[GOSTERGE_KATMAN[g]] ?? KATMANLAR[GOSTERGE_KATMAN[g]].ad}</span>
          </button>
        ))}
      </div>
      <div ref={ref} className="relative mt-2">
        {edinim.isLoading || bantlar.isLoading ? (
          <div role="status" className="h-[170px] animate-pulse rounded bg-app-card-hover" aria-label="Sezon eğrisi yükleniyor" />
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
            {egriNoktalari.length > 0 ? (
              <g data-testid="kesintisiz-egri">
                {/* Belirsizlik bandı TEK sürekli soluk alan: gözlem noktalarında daralır, tahmini aralıklarda genişler (parça parça kıymık yok). */}
                {egriNoktalari.some((n) => n.tahmini) && <path d={bantYolu(egriNoktalari, X, Y)} fill="var(--color-app-text)" opacity={0.09} data-testid="egri-belirsizlik-bandi" />}
                {parcala(egriNoktalari).map((p, i) => (
                  <path key={`c${i}`} d={cizgiYolu(p.noktalar, X, Y)} fill="none" stroke="var(--color-app-text)" strokeWidth={p.tahmini ? 1.4 : 1.9} strokeDasharray={p.tahmini ? '4 3' : undefined} strokeLinejoin="round" opacity={p.tahmini ? 0.75 : 1} data-testid={p.tahmini ? 'egri-tahmini-parca' : 'egri-gozlem-parca'} />
                ))}
                {gozlemler.map((g) => <circle key={`${g.tarih}${g.kaynak}`} cx={X(yilIciKonum(g.tarih))} cy={Y(g.deger)} r={g.kaynak === 's2' ? 2.7 : 2.2} fill="var(--color-app-text)" opacity={g.kaynak === 's2' ? 1 : 0.7} data-testid="egri-gozlem" data-kaynak={g.kaynak}><title>{`${g.tarih} · ${g.kaynak === 's2' ? 'Sentinel-2' : 'HLS'} · ${sayi(g.deger, 2)}`}</title></circle>)}
                {radarIsaretleri.map((r) => {
                  const x0 = X(yilIciKonum(r.baslangic))
                  const x1 = Math.max(X(yilIciKonum(r.bitis)), x0 + 4)
                  const y = KENAR.ust + ih - 4
                  return (
                    <g key={r.baslangic} data-testid="radar-izleme" data-gecis={r.gecis} data-degisim={r.degisimler.length}>
                      <path d={`M${x0},${y - 3} V${y + 3} M${x0},${y} H${x1} M${x1},${y - 3} V${y + 3}`} fill="none" stroke="var(--color-app-text-muted)" strokeWidth={1.2} />
                      <title>{`radar izleme · ${r.baslangic} – ${r.bitis} · ${r.gecis} geçiş · ${r.degisimler.length ? `değişim var: ${r.degisimler.join(', ')}` : 'değişim yok'} (NDVI değildir)`}</title>
                      {r.degisimler.map((d) => <path key={d} d={`M${X(yilIciKonum(d)) - 3.5},${y - 4} l3.5,-6.5 l3.5,6.5 z`} fill="var(--color-app-text)" data-testid="radar-degisim-isareti" />)}
                    </g>
                  )
                })}
                {tahminEtiketi(egriNoktalari) && (() => {
                  const son = egriNoktalari[egriNoktalari.length - 1]
                  return <text x={Math.min(X(yilIciKonum(son.tarih)) + 4, w - 44)} y={Y(son.deger) + 14} fontSize={10} fontStyle="italic" fill="var(--color-app-text-muted)" data-testid="egri-tahmini-etiket">tahmini</text>
                })()}
              </g>
            ) : (
              <>
                {egri && <path d={egri} fill="none" stroke="var(--color-app-text)" strokeWidth={1.8} strokeLinejoin="round" data-testid="sezon-yili-egrisi" />}
                {noktalar.map((n) => <circle key={n.tarih} cx={X(n.x)} cy={Y(n.deger)} r={2.2} fill="var(--color-app-text)" />)}
              </>
            )}
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
          <button key={a} type="button" onClick={() => aya(i + 1)} data-testid={`ay-${i + 1}`} title={AY_ADI[i]} aria-label={`${AY_ADI[i]} ayına git`} className="sr-only min-[480px]:not-sr-only min-h-9 rounded text-[11px] font-medium text-app-text-muted hover:bg-app-card-hover hover:text-app-text">{iw / 12 < 30 ? a.slice(0, 1) : a}</button>
        ))}
      </div>
      {kesintisiz && (
        <div className="mt-1">
          <p className={`text-[11.5px] text-app-text-muted ${dar && !notAcik ? 'line-clamp-2' : ''}`} data-testid="egri-notu">Kesintisiz eğri: Sentinel-2 + HLS gözlemlerinden yumuşatılmıştır (dolu nokta = gerçek gözlem; kesikli çizgi ve soluk bant = tahmin; alt çubuk = bulutlu dönemde «radar izleme» aralığı (ardışık geçişler tek çubukta), dolu üçgen = o aralıkta radarın gördüğü değişim; radar NDVI üretmez). Kademe yalnız gerçek gözleme dayanır.</p>
          {dar && <button type="button" onClick={() => setNotAcik(!notAcik)} aria-expanded={notAcik} data-testid="egri-notu-ayrinti" className="min-h-11 min-w-11 text-[12px] font-semibold text-app-text underline-offset-2 hover:underline">{notAcik ? 'daha az' : 'ayrıntı'}</button>}
        </div>
      )}
      <p className="mt-1 text-[11.5px] text-app-text-dim">Açık bant: p10–p90 · koyu bant: p25–p75 · kesikli: geçmiş yılların ortancası · çizgi: {yil}. Grafiğe ya da aya dokununca harita o aya geçer.</p>
    </section>
  )
}

/** Evrelerin kısa adları (şerit etiketi için); katalog adı title'da kalır. */
const KISA_AD: Record<string, string> = { kis_dinlenme: 'Dinlenme', tomurcuklanma: 'Tomurcuk', ciceklenme: 'Çiçek', meyve_tutumu: 'Tutum', meyve_gelisimi: 'Büyüme', olgunlasma: 'Olgunlaşma' }

/** Fenoloji şeridi: katalogdaki TÜM evreler takvim yılına kırpılarak yerleştirilir; etiketler iki satıra dağıtılır (üst üste binmez). */
export function Fenoloji({ evreler, yil, genislik }: { evreler: { kod: string; ad: string; baslangic: string; bitis: string }[]; yil: number; genislik: number }) {
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
