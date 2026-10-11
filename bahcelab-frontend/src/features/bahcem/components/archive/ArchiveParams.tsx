import { Sparkline, Segmented, Switch, cx } from '@/components/ui'
import type { Scene } from '../../api/indeksApi'
import { TREND } from '../../lib/config'
import { INDEX_DEFS, INDEX_IDS, TRUE_COLOR, TRUE_COLOR_LABEL, formatIndexValue, type LayerId } from '../../lib/indices'
import { changeAt, seriesUpTo } from '../../lib/scenes'
import { useBahcemStore } from '../../stores/bahcemStore'

interface Props {
  scenes: Scene[]
  /** Değerlerin okunduğu tarih (seçili görüntü) */
  date: string | null
  value: LayerId
  onChange: (layer: LayerId) => void
  /** Yatay sekme (mobil) ya da dikey liste (masaüstü) */
  layout: 'list' | 'tabs'
}

function changeText(scenes: Scene[], id: (typeof INDEX_IDS)[number], date: string): string {
  const change = changeAt(scenes, id, date, TREND.compareDays, TREND.toleranceDays)
  if (change?.percent == null) return `${TREND.compareDays} gün önce yok`
  const rounded = Math.round(change.percent * 10) / 10
  const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : ''
  return `${sign}%${Math.abs(rounded).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} / ${TREND.compareDays} gün`
}

/** Parametre listesi: seçili tarihteki değer, 14 günlük değişim ve mini grafik (renk yok: değişim nötr gösterilir). */
export function ArchiveParams({ scenes, date, value, onChange, layout }: Props) {
  if (layout === 'tabs') {
    return (
      <div role="tablist" aria-label="Parametre" className="flex gap-2 overflow-x-auto pb-1">
        {[...INDEX_IDS, TRUE_COLOR].map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={value === id}
            onClick={() => onChange(id)}
            className={cx(
              'min-h-11 shrink-0 rounded-full border px-4 text-small font-semibold',
              value === id ? 'border-app-accent bg-app-accent-soft text-app-accent' : 'border-app-border bg-app-card text-app-text-muted',
            )}
          >
            {id === TRUE_COLOR ? TRUE_COLOR_LABEL.ad : INDEX_DEFS[id].ad}
          </button>
        ))}
      </div>
    )
  }
  return (
    <div className="space-y-3">
      <ul className="space-y-2" aria-label="Parametreler">
        {INDEX_IDS.map((id) => {
          const def = INDEX_DEFS[id]
          const summary = date ? scenes.find((s) => s.tarih === date)?.indeksler[id] : undefined
          const series = date ? seriesUpTo(scenes, id, date, 12) : []
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onChange(id)}
                aria-pressed={value === id}
                data-testid={`param-${id}`}
                className={cx(
                  'block w-full rounded-md border bg-app-card p-3 text-left shadow-e1 transition-colors hover:bg-app-card-hover',
                  value === id ? 'border-app-accent ring-1 ring-app-accent' : 'border-app-border',
                )}
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-small font-semibold text-app-text">{def.ad}</span>
                  <span className="text-caption text-app-text-dim">{def.teknik}</span>
                </span>
                <span className="mt-1 flex items-end justify-between gap-2">
                  <span>
                    <span className="tabular font-display text-h2 text-app-text">{summary ? formatIndexValue(id, summary.ortalama) : '—'}</span>
                    <span className="tabular block text-caption text-app-text-muted">{date && summary ? changeText(scenes, id, date) : ''}</span>
                  </span>
                  {series.length > 1 && <Sparkline values={series} width={72} height={28} className="text-app-accent" />}
                </span>
              </button>
            </li>
          )
        })}
        <li>
          <button
            type="button"
            onClick={() => onChange(TRUE_COLOR)}
            aria-pressed={value === TRUE_COLOR}
            className={cx(
              'block w-full rounded-md border bg-app-card p-3 text-left shadow-e1 hover:bg-app-card-hover',
              value === TRUE_COLOR ? 'border-app-accent ring-1 ring-app-accent' : 'border-app-border',
            )}
          >
            <span className="text-small font-semibold text-app-text">{TRUE_COLOR_LABEL.ad}</span>
            <span className="block text-caption text-app-text-muted">{TRUE_COLOR_LABEL.kisa}</span>
          </button>
        </li>
      </ul>
      <DisplaySettings />
    </div>
  )
}

/** Görüntü ayarları: renk skalası görünümü, ham/yumuşatılmış, renk körlüğü. */
export function DisplaySettings() {
  const skala = useBahcemStore((s) => s.skala)
  const cizim = useBahcemStore((s) => s.cizim)
  const renkKorlugu = useBahcemStore((s) => s.renkKorlugu)
  const setSkala = useBahcemStore((s) => s.setSkala)
  const setCizim = useBahcemStore((s) => s.setCizim)
  const setRenkKorlugu = useBahcemStore((s) => s.setRenkKorlugu)
  return (
    <fieldset className="space-y-2 rounded-md border border-app-border bg-app-card p-3" data-testid="display-settings">
      <legend className="px-1 text-caption font-semibold uppercase tracking-wide text-app-text-dim">Görüntü ayarları</legend>
      <Segmented
        label="Görünüm"
        value={skala}
        onChange={setSkala}
        options={[
          { value: 'kendi', label: 'Bahçenin kendi farkları' },
          { value: 'genel', label: 'Genel skala' },
        ]}
        className="w-full"
      />
      <Segmented
        label="Çizim"
        value={cizim}
        onChange={setCizim}
        options={[
          { value: 'ham', label: 'Ham' },
          { value: 'yumusak', label: 'Yumuşatılmış' },
        ]}
        className="w-full"
      />
      <Switch label="Renk körlüğüne uygun skala" checked={renkKorlugu} onChange={setRenkKorlugu} />
    </fieldset>
  )
}
