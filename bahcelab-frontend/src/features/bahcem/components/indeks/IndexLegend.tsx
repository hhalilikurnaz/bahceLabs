import { useIndexView } from '../../hooks/useIndexView'
import { usePanelLayout } from '../../hooks/usePanelLayout'
import { useBahcemStore } from '../../stores/bahcemStore'
import { LegendCard } from './LegendCard'

/** Haritadaki (en güncel) görüntünün lejantı. */
export function IndexLegend() {
  const { shown } = useIndexView()
  const info = useBahcemStore((s) => s.renderInfo)
  const { listOpen, detailOpen } = usePanelLayout()
  if (!shown || !info) return null
  return (
    <LegendCard
      info={info}
      className={`surface-dark absolute bottom-[4.25rem] left-[var(--map-left)] z-20 w-72 ${listOpen || detailOpen ? 'hidden md:block' : ''}`}
    />
  )
}
