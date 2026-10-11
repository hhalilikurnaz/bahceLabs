import { useIndexView } from '../../hooks/useIndexView'
import { useBahcemStore } from '../../stores/bahcemStore'
import { LegendCard } from './LegendCard'

/** Haritadaki (en güncel) görüntünün lejantı; araç çubuğunun üstünde, aynı sütunda durur. */
export function IndexLegend() {
  const { shown } = useIndexView()
  const info = useBahcemStore((s) => s.renderInfo)
  if (!shown || !info) return null
  return <LegendCard info={info} className="pointer-events-auto w-72 max-w-full" />
}
