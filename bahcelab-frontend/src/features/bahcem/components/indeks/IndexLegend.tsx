import { useIndexView } from '../../hooks/useIndexView'
import { usePanelLayout } from '../../hooks/usePanelLayout'
import { formatDate } from '../../lib/dates'
import { INDEX_DEFS, formatIndexValue, gradientCss, layerName, TRUE_COLOR } from '../../lib/indices'
import { legendHint, legendTitle } from '../../lib/raster'
import { useBahcemStore } from '../../stores/bahcemStore'

/** Haritadaki görüntünün lejantı: görünümü adlandırır, parametre ve tarihi söyler, renk skalasını gösterir. */
export function IndexLegend() {
  const { shown, katman } = useIndexView()
  const info = useBahcemStore((s) => s.renderInfo)
  const { listOpen, detailOpen } = usePanelLayout()
  if (!shown || !info) return null

  const def = info.indeks ? INDEX_DEFS[info.indeks] : null
  const showScale = info.kind !== 'gercek' && def !== null && info.colormap !== null
  const own = info.kind === 'kendi'
  const fmt = (v: number) =>
    info.kind === 'fark' ? `${v > 0 ? '+' : ''}${v.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}` : formatIndexValue(info.indeks ?? 'ndvi', v)
  const ticks = own && !info.homogeneous ? [['En zayıf kesim', info.vmin], ['En güçlü kesim', info.vmax]] as const : null

  return (
    <div
      className={`surface-dark absolute bottom-[4.25rem] left-[var(--map-left)] z-20 w-72 rounded-md border border-app-border bg-app-panel px-3 py-2.5 shadow-e2 ${listOpen || detailOpen ? 'hidden md:block' : ''}`}
      role="group"
      aria-label="Harita lejantı"
      data-testid="map-legend"
    >
      <p className="text-small font-semibold text-app-text">{legendTitle(info)}</p>
      <p className="text-caption text-app-text-muted" data-testid="map-date-label">
        {katman === TRUE_COLOR ? layerName(TRUE_COLOR) : def?.ad} · {formatDate(info.tarih)}
      </p>
      {showScale && info.colormap && (
        <>
          <div className="mt-2 h-2.5 rounded-full" style={{ background: gradientCss(info.colormap) }} />
          <div className="tabular mt-1 flex justify-between text-caption text-app-text-dim">
            {ticks ? (
              ticks.map(([label, value]) => (
                <span key={label}>
                  {label} ({fmt(value)})
                </span>
              ))
            ) : (
              <>
                <span>{fmt(info.vmin)}</span>
                <span>{fmt(info.vmax)}</span>
              </>
            )}
          </div>
        </>
      )}
      <p className="mt-2 text-caption text-app-text-muted" data-testid="legend-hint">
        {legendHint(info)}
      </p>
    </div>
  )
}
