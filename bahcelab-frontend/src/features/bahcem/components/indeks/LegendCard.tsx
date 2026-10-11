import { InfoHint } from '@/components/ui'
import { formatDate } from '../../lib/dates'
import { INDEX_DEFS, formatIndexValue, gradientCss, layerName, TRUE_COLOR } from '../../lib/indices'
import { legendHint, legendTitle, type RenderInfo } from '../../lib/raster'

/**
 * Kompakt lejant (harita ve arşiv ortak): görünüm adı, renk çubuğu ve iki uç değer.
 * Açıklama metni "?" ile açılır.
 */
export function LegendCard({ info, className = '' }: { info: RenderInfo; className?: string }) {
  const def = info.indeks ? INDEX_DEFS[info.indeks] : null
  const showScale = info.kind !== 'gercek' && def !== null && info.colormap !== null
  const fmt = (v: number) =>
    info.kind === 'fark' ? `${v > 0 ? '+' : ''}${v.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}` : formatIndexValue(info.indeks ?? 'ndvi', v)
  const ends: [string, string] =
    info.kind === 'kendi' && !info.homogeneous ? ['Zayıf', 'Güçlü'] : info.kind === 'fark' ? ['Düşüş', 'Artış'] : ['', '']

  return (
    <div className={`rounded-md border border-app-border bg-app-panel py-1.5 pl-3 pr-1 shadow-e2 ${className}`} role="group" aria-label="Lejant" data-testid="map-legend">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 text-small font-semibold text-app-text">
          {legendTitle(info)}
          <span className="font-normal text-app-text-muted" data-testid="map-date-label">
            {' '}
            · {def ? def.ad : layerName(TRUE_COLOR)} · {formatDate(info.tarih)}
          </span>
        </p>
        <InfoHint label="Lejant ne anlatıyor?" text={legendHint(info)} placement="top" className="shrink-0" />
      </div>
      {showScale && info.colormap && (
        <div className="pb-1 pr-2">
          <div className="h-2.5 rounded-full" style={{ background: gradientCss(info.colormap) }} />
          <div className="tabular mt-1 flex justify-between text-caption text-app-text-dim">
            <span>
              {ends[0] && `${ends[0]} `}
              {fmt(info.vmin)}
            </span>
            <span>
              {ends[1] && `${ends[1]} `}
              {fmt(info.vmax)}
            </span>
          </div>
        </div>
      )}
      <p className="sr-only" data-testid="legend-hint">
        {legendHint(info)}
      </p>
    </div>
  )
}
