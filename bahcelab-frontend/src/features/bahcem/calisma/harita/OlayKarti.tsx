import { X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { gunAy } from '../../lib/format'
import { gardenPath } from '../../lib/routes'
import { useCalismaStore } from '../calismaStore'

/** Haritada odaklanılan olay: ad + tarih aralığı; hava kaynaklı olaylarda Hava sekmesine, her olayda zaman çizelgesine bağlantı. Kapatılabilir. */
export function OlayKarti({ gardenId }: { gardenId: string }) {
  const olay = useCalismaStore((s) => s.olay)
  const setOlay = useCalismaStore((s) => s.setOlay)
  if (!olay) return null
  const ayni = olay.baslangic === olay.bitis
  return (
    <div role="status" className="glass absolute left-1/2 top-[116px] z-10 flex w-[min(380px,calc(100%-28px))] -translate-x-1/2 items-start gap-2 px-3 py-2 max-[1279px]:top-[124px]" data-testid="olay-karti" data-olay={olay.id}>
      <div className="min-w-0 flex-1 text-[12.5px] leading-snug">
        <b className="block">{olay.ad}</b>
        <span className="num text-app-text-muted">{ayni ? gunAy(olay.baslangic, 'always') : `${gunAy(olay.baslangic, 'always')} – ${gunAy(olay.bitis, 'always')}`} · harita olayın görüldüğü ilk net görüntüde</span>
        <Link to={gardenPath(gardenId, 'hava')} className="mt-0.5 block font-semibold text-app-accent underline-offset-2 hover:underline">Hava sekmesinde ayrıntı</Link>
      </div>
      <button type="button" aria-label="Olay kartını kapat" onClick={() => setOlay(null)} className="grid h-9 w-9 shrink-0 place-items-center rounded-md hover:bg-app-card-hover max-[560px]:h-11 max-[560px]:w-11">
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  )
}
