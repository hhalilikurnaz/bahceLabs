import { useNdviView } from '../../hooks/useNdviView'
import { NDVI_MAX, NDVI_MIN, ndviGradient } from '../../lib/ndvi'
import { useBahcemStore } from '../../stores/bahcemStore'

const TICKS = [0, 0.3, 0.6, 0.9]

/** Haritada NDVI görünürken renk lejantı (tarih şeridinin üstünde). */
export function NdviLegend() {
  const { shown } = useNdviView()
  const panelOpen = useBahcemStore((s) => s.leftPanelOpen)
  if (!shown) return null

  return (
    <div
      className={`absolute bottom-[7.75rem] left-[4.25rem] z-20 w-56 rounded-xl border border-app-border bg-app-panel px-3 py-2.5 shadow-xl transition-[left] duration-300 ease-out ${
        panelOpen ? 'md:left-[27.5rem]' : 'md:left-[4.25rem]'
      }`}
      role="img"
      aria-label="NDVI renk lejantı: kırmızı düşük, yeşil yüksek"
    >
      <div className="mb-1.5 flex items-center justify-between text-[11px] text-app-text-muted">
        <span className="font-medium text-app-text">NDVI</span>
        <span>bitki canlılığı</span>
      </div>
      <div className="h-2.5 rounded-full" style={{ background: ndviGradient() }} />
      <div className="relative mt-1 h-3 text-[10px] text-app-text-dim">
        {TICKS.map((tick) => (
          <span
            key={tick}
            className="absolute -translate-x-1/2"
            style={{ left: `${((tick - NDVI_MIN) / (NDVI_MAX - NDVI_MIN)) * 100}%` }}
          >
            {tick.toLocaleString('tr-TR', { minimumFractionDigits: 1 })}
          </span>
        ))}
      </div>
    </div>
  )
}
