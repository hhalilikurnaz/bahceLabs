import { formatDate } from '../../lib/dates'
import { INDEX_DEFS, formatIndexValue, gradientCss, layerName, TRUE_COLOR } from '../../lib/indices'
import { legendHint, legendTitle, type RenderInfo } from '../../lib/raster'

/** Lejant kartı (harita ve arşiv ortak): görünümü adlandırır, parametre ve tarihi söyler, renk skalasını gösterir. */
export function LegendCard({ info, className = '' }: { info: RenderInfo; className?: string }) {
  const def = info.indeks ? INDEX_DEFS[info.indeks] : null
  const showScale = info.kind !== 'gercek' && def !== null && info.colormap !== null
  const own = info.kind === 'kendi'
  const fmt = (v: number) =>
    info.kind === 'fark' ? `${v > 0 ? '+' : ''}${v.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}` : formatIndexValue(info.indeks ?? 'ndvi', v)
  const ticks = own && !info.homogeneous ? ([['En zayıf kesim', info.vmin], ['En güçlü kesim', info.vmax]] as const) : null

  return (
    <div className={`rounded-md border border-app-border bg-app-panel px-3 py-2.5 shadow-e2 ${className}`} role="group" aria-label="Lejant" data-testid="map-legend">
      <p className="text-small font-semibold text-app-text">{legendTitle(info)}</p>
      <p className="text-caption text-app-text-muted" data-testid="map-date-label">
        {def ? def.ad : layerName(TRUE_COLOR)} · {formatDate(info.tarih)}
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
