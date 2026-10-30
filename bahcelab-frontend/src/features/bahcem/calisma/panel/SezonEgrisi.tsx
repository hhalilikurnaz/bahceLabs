import { useMemo, useState } from 'react'
import { BandLine, ChartFrame, ChartState, TimeDomainProvider, type BandAy, type EgriNoktasi, type Gozlem } from '@/components/chart'
import { useCanlilikEgrisi } from '../../api/egriApi'
import { useEdinimler, type GostergeId } from '../../api/edinimApi'
import { useNormalBantlar } from '../../api/normalBantApi'
import { useElementWidth } from '../../hooks/useElementWidth'
import { sezonNoktalari } from '../../lib/sezon'
import { useCalismaStore } from '../calismaStore'
import { GOSTERGE_KATMAN, KATMANLAR, KATMAN_KISA_AD, type KatmanId } from '../katmanlar'

const SECENEKLER: GostergeId[] = ['ndvi', 'ndre', 'lai', 'ndmi', 'msavi']

/**
 * «Bu yıl, önceki yıllara göre»: bu yılın çizgisi + bahçenin kendi normal aralığı (tek bileşen: BandLine). Gösterge sekmeleri yalnız seçim.
 * Canlılık kesintisiz eğriyle (gözlem dolu, tahmin taralı); diğer göstergeler net görüntü noktalarıyla. Üzerinde gezinince dikey imleç ve değer kutusu,
 * harita tarih kutusu senkron vurgulanır; Sentinel-2 noktasına tıklayınca harita o görüntüye geçer.
 */
export function SezonEgrisi({ gardenId, gostergeler = SECENEKLER, onAy, baslik = 'Bu yıl, önceki yıllara göre', ayrintili = false, yukseklik = 230 }: {
  gardenId: string; gostergeler?: GostergeId[]; baslik?: string; ayrintili?: boolean; yukseklik?: number
  /** Geçmiş sayfası: haritayı başka sayfada açar */
  onAy?: (katman: KatmanId, tarih: string | null, ay: number) => void
}) {
  const [gosterge, setGosterge] = useState<GostergeId>(gostergeler[0] ?? 'ndvi')
  const [ref, genislik] = useElementWidth<HTMLDivElement>()
  const edinim = useEdinimler(gardenId)
  const bantlar = useNormalBantlar(gardenId)
  const egri = useCanlilikEgrisi(gardenId)
  const imlec = useCalismaStore((s) => s.imlecTarih)
  const setImlec = useCalismaStore((s) => s.setImlecTarih)
  const setKatman = useCalismaStore((s) => s.setKatman)
  const setTarih = useCalismaStore((s) => s.setTarih)
  const secili = useCalismaStore((s) => s.tarih)
  const yil = new Date().getFullYear()
  const bugun = new Date().toISOString().slice(0, 10)
  const kesintisiz = gosterge === 'ndvi' && egri.data?.yeterli ? egri.data : null
  const bant = useMemo(() => {
    const r: Record<number, BandAy> = {}
    for (const b of bantlar.data?.gostergeler[gosterge] ?? []) if (b.ceyrek_yeterli && b.onluk_yeterli && b.p10 !== null && b.p25 !== null && b.p50 !== null && b.p75 !== null && b.p90 !== null) r[b.ay] = { p10: b.p10, p25: b.p25, p50: b.p50, p75: b.p75, p90: b.p90 }
    return r
  }, [bantlar.data, gosterge])
  const noktalar = useMemo<EgriNoktasi[]>(() => {
    if (kesintisiz) return kesintisiz.noktalar.filter((n) => n.tarih.startsWith(`${yil}-`))
    return sezonNoktalari(edinim.data?.edinimler ?? [], gosterge, yil).map((n) => ({ tarih: n.tarih, deger: n.deger, alt: n.deger, ust: n.deger, tahmini: false }))
  }, [kesintisiz, edinim.data, gosterge, yil])
  const gozlemler = useMemo<Gozlem[]>(() => {
    if (kesintisiz) return kesintisiz.gozlemler.filter((g) => g.tarih.startsWith(`${yil}-`)).map((g) => ({ tarih: g.tarih, deger: g.deger, kaynak: g.kaynak }))
    return noktalar.map((n) => ({ tarih: n.tarih, deger: n.deger, kaynak: 's2' as const }))
  }, [kesintisiz, noktalar, yil])
  const w = Math.max(280, genislik)
  const katman = GOSTERGE_KATMAN[gosterge]
  const sec = (t: string) => (onAy ? onAy(katman, t, Number(t.slice(5, 7))) : (setKatman(katman), setTarih(t)))
  const yilSayisi = Object.values(bantlar.data?.gostergeler[gosterge] ?? []).find((b) => b.ceyrek_yeterli)?.yil_sayisi
  const durum: 'yukleniyor' | 'hata' | 'yok' | null = edinim.isLoading || bantlar.isLoading ? 'yukleniyor' : edinim.isError && !edinim.data ? 'hata' : noktalar.length === 0 ? 'yok' : null
  return (
    <ChartFrame mesaj={baslik} testId="sezon-egrisi" ayrinti={<><p>Çizgi bu yılın canlılığı; yeşil alan bahçenin kendi önceki yıllarındaki olağan aralığı{yilSayisi ? ` (${yilSayisi} yıl)` : ''}. Taralı bölge tahmindir, noktalar gerçek uydu görüntüleridir.</p>{kesintisiz && <p data-testid="egri-notu">Dolu nokta Sentinel-2, boş nokta HLS (30 m). Eğri yumuşatılmıştır. Kademe yalnız gerçek gözleme dayanır; taralı kısım tahmindir.</p>}</>}>
      <div role="tablist" aria-label="Gösterge" className="mb-2 flex flex-nowrap gap-1 overflow-x-auto [scrollbar-width:none]" data-testid="sezon-sekmeleri">
        {gostergeler.map((g) => (
          <button key={g} role="tab" type="button" aria-selected={gosterge === g} aria-label={KATMANLAR[GOSTERGE_KATMAN[g]].ad} onClick={() => setGosterge(g)} data-testid={`sezon-${g}`}
            className={`min-h-9 shrink-0 whitespace-nowrap rounded-md px-2.5 text-small font-semibold max-[560px]:min-h-11 max-[560px]:min-w-11 ${gosterge === g ? 'bg-app-primary text-app-on-primary' : 'text-app-text-muted hover:bg-app-card-hover'}`}>
            <span className="max-[560px]:hidden">{KATMANLAR[GOSTERGE_KATMAN[g]].ad}</span>
            <span aria-hidden className="min-[561px]:hidden">{KATMAN_KISA_AD[GOSTERGE_KATMAN[g]] ?? KATMANLAR[GOSTERGE_KATMAN[g]].ad}</span>
          </button>
        ))}
      </div>
      <div ref={ref}>
        {durum === 'yukleniyor' ? <ChartState tur="yukleniyor" yukseklik={yukseklik} />
          : durum === 'hata' ? <ChartState tur="hata" error={edinim.error} onRetry={() => void edinim.refetch()} retrying={edinim.isFetching} />
          : durum === 'yok' ? <div data-testid="sezon-bos"><ChartState tur="yok" neden="Bu gösterge için bu yıl net görüntü yok." nezaman="Yeni görüntü geldikçe dolar." yukseklik={yukseklik} /></div>
          : (
            <TimeDomainProvider imlec={imlec} setImlec={setImlec} sec={sec}>
              <BandLine yil={yil} genislik={w} yukseklik={yukseklik} noktalar={noktalar} gozlemler={gozlemler} bant={bant} bugun={bugun} vurguTarih={secili} ayrintili={ayrintili} kesintisiz={!!kesintisiz} bandAdi="normal aralık" bandAlt={yilSayisi ? `önceki ${yilSayisi} yıl` : undefined} basamak={gosterge === 'lai' ? 1 : 2} />
              {Object.keys(bant).length === 0 && <p className="mt-1 text-small text-app-text-muted" data-testid={bantlar.isError ? 'sezon-bant-alinamadi' : 'sezon-yetersiz-gecmis'}>{bantlar.isError ? 'Normal aralık alınamadı (veri hatası; geçmiş yetersiz değil).' : `Normal aralık için en az ${bantlar.data?.asgari_yil_onluk ?? 8} yıllık görüntü gerekir.`}</p>}
            </TimeDomainProvider>
          )}
      </div>
    </ChartFrame>
  )
}
