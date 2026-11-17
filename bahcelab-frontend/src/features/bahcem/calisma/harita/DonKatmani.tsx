import { useEffect } from 'react'
import { useGoreliSoguk } from '../../api/donApi'
import { HARITA } from '../../map/haritaRenkleri'
import { useMap } from '../../map/useMap'
import { useCalismaStore } from '../calismaStore'

const KAYNAK = 'don-goreli'

/** Bahçe içi göreli soğuk nokta katmanı (ADIM 10): 30 m AYRIK hücreler; renk = göreli sıralama (açık = daha ılık, koyu = daha soğuk), °C DEĞİL. Yalnız rölyef ≥ 10 m ve eğim ≥ 3° ise (API `uygun`) ve kullanıcı açtıysa çizilir. */
export function DonKatmani({ gardenId }: { gardenId: string }) {
  const { map, styleVersion } = useMap()
  const don = useCalismaStore((s) => s.don)
  const goreli = useGoreliSoguk(gardenId).data
  const fc = goreli?.uygun ? goreli.geojson : null
  const goster = don && fc !== null

  useEffect(() => {
    if (!map || styleVersion === 0) return
    for (const id of [`${KAYNAK}-dolgu`, `${KAYNAK}-cizgi`]) if (map.getLayer(id)) map.removeLayer(id)
    if (map.getSource(KAYNAK)) map.removeSource(KAYNAK)
    if (!goster || !fc) return
    map.addSource(KAYNAK, { type: 'geojson', data: fc })
    map.addLayer({ id: `${KAYNAK}-dolgu`, type: 'fill', source: KAYNAK, paint: { 'fill-color': ['interpolate', ['linear'], ['get', 'goreli_soguk'], 0, HARITA.rf6f5f0, 1, HARITA.r2a78d6], 'fill-opacity': 0.7 } })
    map.addLayer({ id: `${KAYNAK}-cizgi`, type: 'line', source: KAYNAK, paint: { 'line-color': HARITA.rffffff, 'line-width': 1.2 } })
  }, [map, styleVersion, goster, fc])

  if (!goster) return null
  return (
    <div className="glass absolute bottom-3.5 right-3.5 z-10 max-w-[260px] px-3 py-2 text-caption max-[900px]:bottom-auto max-[900px]:top-[74px]" data-testid="don-lejant" role="note">
      <b className="block text-small">Bahçe içi soğuk nokta · göreli, °C değil</b>
      <span aria-hidden className="mt-1 block h-2.5 w-full rounded-[3px] border border-black/10" style={{ background: `linear-gradient(90deg, ${HARITA.rf6f5f0}, ${HARITA.r2a78d6})` }} />
      <span className="mt-0.5 flex justify-between"><span>daha ılık</span><span>daha soğuk</span></span>
      <span className="mt-0.5 block text-app-text-muted">30 m hücreler · varsayım: soğuk hava alçak kısımda birikir</span>
    </div>
  )
}
