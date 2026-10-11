import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button, IconButton, Segmented, Skeleton } from '@/components/ui'
import type { Garden } from '../../api/types'
import type { Scene } from '../../api/indeksApi'
import { useRasterResult } from '../../hooks/useRasterResult'
import { ARCHIVE } from '../../lib/config'
import { formatDate, nearestDate, shiftDays } from '../../lib/dates'
import { INDEX_DEFS, formatIndexValue, isIndexId, layerName, type IndexId } from '../../lib/indices'
import { stepDate, type ArchiveState, COMPARE_STYLES } from '../../lib/archive'
import type { ViewSettings } from '../../lib/raster'
import { renderDifference, type Rings, type RasterResult } from '../../lib/rasterRender'
import { useGrid } from '../../api/indeksApi'
import { LegendCard } from '../indeks/LegendCard'
import { RasterCanvas } from './RasterCanvas'

interface ViewerProps {
  garden: Garden
  rings: Rings
  scenes: Scene[]
  /** Seçilebilir (kullanılabilir) tarihler, eskiden yeniye */
  dates: string[]
  state: ArchiveState
  settings: ViewSettings
  onChange: (patch: Partial<ArchiveState>) => void
}

const sceneOn = (scenes: Scene[], date: string | null): Scene | null => (date ? (scenes.find((s) => s.tarih === date) ?? null) : null)

function Frame({ state, label, children }: { state: { loading: boolean; failed: boolean; hasImage: boolean }; label: string; children: React.ReactNode }) {
  return (
    <div className="relative flex h-full min-h-[220px] w-full items-center justify-center overflow-hidden rounded-lg bg-thumb" aria-label={label}>
      {state.hasImage ? children : state.loading ? <Skeleton className="h-3/4 w-3/4 opacity-40" /> : <p className="px-6 text-center text-body text-white/80">{state.failed ? 'Bu tarihin görüntüsü çizilemedi.' : 'Görüntü seçin.'}</p>}
    </div>
  )
}

/** Büyük görüntüleyici: tek görüntü, iki tarihi karşılaştırma (kaydırıcı / yan yana), değişim haritası, zaman atlaması. */
export function ArchiveViewer({ garden, rings, scenes, dates, state, settings, onChange }: ViewerProps) {
  const layer = state.parametre
  const selected = state.tarih && dates.includes(state.tarih) ? state.tarih : (dates[dates.length - 1] ?? null)
  const [frame, setFrame] = useState<string | null>(null)
  const [playRequested, setPlaying] = useState(false)
  const playing = playRequested && state.mod === 'zaman'
  const [split, setSplit] = useState<number>(ARCHIVE.compareStart)

  // B tarihi: seçilmemişse karşılaştırma için bir önceki, değişim için ~14 gün önceki görüntü
  const other = useMemo(() => {
    if (state.b && dates.includes(state.b)) return state.b
    if (!selected) return null
    const earlier = dates.filter((d) => d < selected)
    if (state.mod === 'degisim') return nearestDate(shiftDays(selected, -14), earlier, 30) ?? earlier[earlier.length - 1] ?? null
    return earlier[earlier.length - 1] ?? null
  }, [state.b, state.mod, selected, dates])

  const shownDate = state.mod === 'zaman' ? (frame ?? selected) : selected
  const sceneA = sceneOn(scenes, shownDate)
  const sceneB = sceneOn(scenes, other)
  const a = useRasterResult(garden.id, sceneA, layer, settings, rings)
  const needsB = state.mod === 'karsilastir' || state.mod === 'degisim'
  const b = useRasterResult(garden.id, needsB ? sceneB : null, layer, settings, rings)
  const gridLayer: IndexId | null = isIndexId(layer) ? layer : null
  const gridA = useGrid(garden.id, state.mod === 'degisim' ? sceneA : null, gridLayer).data
  const gridB = useGrid(garden.id, state.mod === 'degisim' ? sceneB : null, gridLayer).data

  const diff: RasterResult | null = useMemo(() => {
    if (state.mod !== 'degisim' || !sceneA || !sceneB || !gridA || !gridB || !gridLayer) return null
    return renderDifference({ toScene: sceneA, fromScene: sceneB, toGrid: gridA, fromGrid: gridB, indeks: gridLayer, settings, rings })
  }, [state.mod, sceneA, sceneB, gridA, gridB, gridLayer, settings, rings])

  // Zaman atlaması: seçili sezonun görüntüleri sırayla
  useEffect(() => {
    if (!playing || state.mod !== 'zaman') return
    const timer = window.setInterval(() => {
      setFrame((current) => {
        const index = current ? dates.indexOf(current) : -1
        return dates[(index + 1) % dates.length]
      })
    }, ARCHIVE.timelapseFrameMs)
    return () => window.clearInterval(timer)
  }, [playing, state.mod, dates])

  const go = (step: -1 | 1) => onChange({ tarih: stepDate(selected, dates, step) })
  const onKey = (event: React.KeyboardEvent) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return
    if (event.key === 'ArrowLeft') go(-1)
    else if (event.key === 'ArrowRight') go(1)
    else return
    event.preventDefault()
  }

  const main = state.mod === 'degisim' ? diff : a.result
  const info = main?.info ?? null
  const def = gridLayer ? INDEX_DEFS[gridLayer] : null
  const value = sceneA && gridLayer ? sceneA.indeksler[gridLayer]?.ortalama : undefined
  const loading = state.mod === 'degisim' ? !diff && (a.loading || b.loading || !gridA || !gridB) : a.loading
  const labelA = `${layerName(layer)} · ${formatDate(shownDate ?? '')}`

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-3" aria-label="Görüntüleyici" onKeyDown={onKey} data-testid="archive-viewer" data-mode={state.mod}>
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          label="Görüntüleme biçimi"
          value={state.mod}
          onChange={(mod) => onChange({ mod })}
          options={[
            { value: 'tek', label: 'Tek görüntü' },
            { value: 'karsilastir', label: 'İki tarihi karşılaştır' },
            { value: 'degisim', label: 'Değişim haritası' },
            { value: 'zaman', label: 'Zaman atlaması' },
          ]}
          className="max-w-full min-w-0 overflow-x-auto"
        />
        {state.mod === 'karsilastir' && (
          <Segmented
            label="Karşılaştırma biçimi"
            value={state.stil}
            onChange={(stil) => onChange({ stil })}
            options={COMPARE_STYLES.map((value) => ({ value, label: value === 'kaydirici' ? 'Kaydırıcı' : 'Yan yana' }))}
          />
        )}
      </div>

      <div className="relative min-h-[260px] flex-1" tabIndex={0} aria-label="Görüntü alanı; sol ve sağ ok tuşları önceki ve sonraki görüntüye geçer">
        <Frame state={{ loading, failed: a.failed, hasImage: Boolean(main) }} label={labelA}>
          {state.mod === 'karsilastir' && a.result && b.result && state.stil === 'kaydirici' ? (
            <div className="relative flex h-full w-full items-center justify-center">
              <div className="relative max-h-full max-w-full" style={{ aspectRatio: `${a.result.image.width} / ${a.result.image.height}`, height: '100%' }}>
                <RasterCanvas image={a.result.image} label={`Sol: ${labelA}`} className="absolute inset-0 h-full w-full" />
                <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${split * 100}%)` }}>
                  <RasterCanvas image={b.result.image} label={`Sağ: ${layerName(layer)} · ${formatDate(other ?? '')}`} className="absolute inset-0 h-full w-full" />
                </div>
                <span className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-e2" style={{ left: `${split * 100}%` }} aria-hidden />
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(split * 100)}
                  onChange={(e) => setSplit(Number(e.target.value) / 100)}
                  aria-label="Karşılaştırma ayırıcısı"
                  className="absolute inset-x-0 bottom-2 h-11 w-full cursor-ew-resize opacity-80"
                  data-testid="compare-slider"
                />
              </div>
            </div>
          ) : state.mod === 'karsilastir' && a.result && b.result ? (
            <div className="grid h-full w-full grid-cols-2 gap-2 p-2" data-testid="compare-side">
              <figure className="flex min-h-0 flex-col items-center gap-1">
                <RasterCanvas image={a.result.image} label={labelA} />
                <figcaption className="text-caption text-white/80">{formatDate(shownDate ?? '')}</figcaption>
              </figure>
              <figure className="flex min-h-0 flex-col items-center gap-1">
                <RasterCanvas image={b.result.image} label={`${layerName(layer)} · ${formatDate(other ?? '')}`} />
                <figcaption className="text-caption text-white/80">{formatDate(other ?? '')}</figcaption>
              </figure>
            </div>
          ) : main ? (
            <RasterCanvas image={main.image} label={state.mod === 'degisim' ? `Değişim haritası: ${formatDate(shownDate ?? '')} − ${formatDate(other ?? '')}` : labelA} />
          ) : null}
        </Frame>
        {state.mod === 'degisim' && !other && <p className="mt-2 text-small text-app-text-muted">Değişim için daha eski bir görüntü gerekiyor.</p>}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-app-border bg-app-card p-2.5">
        <div className="flex items-center gap-1">
          <IconButton label="Önceki görüntü" onClick={() => go(-1)}>
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </IconButton>
          <IconButton label="Sonraki görüntü" onClick={() => go(1)}>
            <ChevronRight className="h-5 w-5" aria-hidden />
          </IconButton>
          {state.mod === 'zaman' && (
            <Button icon={playing ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />} onClick={() => setPlaying((p) => !p)}>
              {playing ? 'Durdur' : 'Oynat'}
            </Button>
          )}
        </div>
        <p className="tabular text-small text-app-text" data-testid="archive-selected" aria-live="polite">
          <strong>{formatDate(shownDate ?? '')}</strong>
          {state.mod === 'karsilastir' || state.mod === 'degisim' ? ` ↔ ${other ? formatDate(other) : '—'}` : ''}
          {def && value !== undefined && ` · ${def.ad} ${formatIndexValue(def.id, value)}`}
          {sceneA?.bulutOrani != null && ` · bulut %${Math.round(sceneA.bulutOrani)}`}
        </p>
      </div>

      {info && <LegendCard info={info} className="max-w-md" />}
    </section>
  )
}
