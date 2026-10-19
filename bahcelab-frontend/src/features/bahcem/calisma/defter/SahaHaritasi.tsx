import { useEffect, useMemo } from 'react'
import { useAuth } from '@/features/auth/useAuth'
import type { Garden } from '../../api/types'
import { KAYIT_TUR_AD, KAYIT_TUR_ISARET, type Kayit, type SahaTuru } from '../../api/sahaApi'
import { MapProvider } from '../../map/MapProvider'
import { useMap } from '../../map/useMap'
import { gunAy } from '../../lib/format'
import { noktaMi, temsilNoktasi } from '../../lib/saha'
import { BahceSiniri } from '../harita/BahceSiniri'
import { HaritaIsaretleri, type Isaret } from './HaritaIsaretleri'
import { SahaCizgileri } from './SahaCizgileri'
import type { KonumSecimi } from './useKonumSecimi'

/** Haritaya dokunma: yalnız konum seçimi açıkken (nokta/alan) boylam-enlem bildirir. */
function Dokunma({ konum }: { konum: KonumSecimi }) {
  const { map } = useMap()
  useEffect(() => {
    if (!map) return
    const tikla = (e: { lngLat: { lng: number; lat: number } }) => konum.haritaTikla(e.lngLat.lng, e.lngLat.lat)
    map.on('click', tikla)
    map.getCanvas().style.cursor = konum.mod === 'yok' ? '' : 'crosshair'
    return () => {
      map.off('click', tikla)
      map.getCanvas().style.cursor = ''
    }
  }, [map, konum.mod, konum.haritaTikla]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

/** Saha Defteri haritası: bahçe sınırı, saha kayıtları (ayrı katman), tur noktaları ve rota, taslak konum. */
export function SahaHaritasi({ garden, kayitlar, tur, konum, secili, sec, kayitlarGorunur }: {
  garden: Garden
  kayitlar: Kayit[]
  tur: SahaTuru | undefined
  konum: KonumSecimi
  secili: string | null
  sec: (id: string) => void
  kayitlarGorunur: boolean
}) {
  const { user } = useAuth()
  const isaretler = useMemo<Isaret[]>(() => {
    const k: Isaret[] = kayitlarGorunur
      ? kayitlar.flatMap((r) => {
          if (!r.konum) return []
          const [lng, lat] = temsilNoktasi(r.konum)
          return [{ id: r.id, lng, lat, etiket: KAYIT_TUR_ISARET[r.tur], baslik: `${KAYIT_TUR_AD[r.tur]}, ${gunAy(r.tarih, 'always')}${r.aciklama ? `: ${r.aciklama.slice(0, 60)}` : ''}`, stil: noktaMi(r.konum) ? ('kayit' as const) : ('alan' as const), secili: secili === r.id }]
        })
      : []
    const t: Isaret[] = (tur?.noktalar ?? []).map((n) => ({ id: n.anahtar, lng: n.lng, lat: n.lat, etiket: String(n.sira), baslik: `Tur noktası ${n.sira}: ${n.baslik}${n.ziyaret_edildi ? ' (ziyaret edildi)' : ''}`, stil: n.ziyaret_edildi ? ('tur-bitti' as const) : ('tur' as const), secili: secili === n.anahtar }))
    const taslak: Isaret[] = konum.mod === 'nokta' && konum.nokta ? [{ id: 'taslak-nokta', lng: konum.nokta[0], lat: konum.nokta[1], etiket: '+', baslik: 'Seçilen nokta', stil: 'kayit' as const }] : konum.koseler.map((c, i) => ({ id: `taslak-${i}`, lng: c[0], lat: c[1], etiket: String(i + 1), baslik: `Köşe ${i + 1}`, stil: 'kayit' as const }))
    return [...k, ...t, ...taslak]
  }, [kayitlar, tur, konum.mod, konum.nokta, konum.koseler, secili, kayitlarGorunur])
  const alanlar = useMemo(() => (kayitlarGorunur ? kayitlar.flatMap((r) => (r.konum?.type === 'Polygon' ? [r.konum] : [])) : []), [kayitlar, kayitlarGorunur])
  if (!user) return null
  return (
    <div className="relative h-full w-full overflow-hidden" data-testid="defter-haritasi">
      <MapProvider userId={user.id}>
        <BahceSiniri garden={garden} others={[]} />
        <SahaCizgileri rota={(tur?.rota ?? []) as [number, number][]} alanlar={alanlar} taslak={konum.mod === 'alan' ? konum.koseler : []} />
        <HaritaIsaretleri isaretler={isaretler} onSec={(id) => !id.startsWith('taslak') && sec(id)} />
        <Dokunma konum={konum} />
      </MapProvider>
    </div>
  )
}
