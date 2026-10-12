import { TriangleAlert } from 'lucide-react'
import { useMemo } from 'react'
import type { GardenGeometry } from '../../api/types'
import { useGardens } from '../../api/useGardens'
import { largestOuterRing } from '../../lib/geo'
import { ORTUSME_ESIGI, overlapShare } from '../../lib/overlap'

/** Sınır başka bir bahçenin sınırıyla örtüşüyorsa uyarır (engellemez): çift sayım ve karışık uydu verisi olmasın. */
export function OverlapWarning({ geometry, ignoreId }: { geometry: GardenGeometry | null; ignoreId?: string | null }) {
  const { data: gardens } = useGardens()
  const hits = useMemo(() => {
    if (!geometry || !gardens) return []
    const ring = largestOuterRing(geometry)
    return gardens
      .filter((g) => g.id !== ignoreId)
      .map((g) => ({ ad: g.ad, pay: overlapShare(ring, largestOuterRing(g.geometry)) }))
      .filter((h) => h.pay > ORTUSME_ESIGI)
  }, [geometry, gardens, ignoreId])
  if (hits.length === 0) return null
  return (
    <p role="alert" data-testid="ortusme-uyarisi" className="flex items-start gap-2 rounded-md bg-app-warn/10 px-3 py-2.5 text-small text-app-warn">
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>
        Bu sınır {hits.map((h) => `“${h.ad}” bahçesiyle (≈ %${Math.max(1, Math.round(h.pay * 100))})`).join(' ve ')} örtüşüyor. Aynı alan iki bahçede sayılır; sınırı kontrol edin.
      </span>
    </p>
  )
}
