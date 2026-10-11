import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Sparkline, TextField, cx } from '@/components/ui'
import type { GardenOverview } from '../../api/overviewApi'
import type { Garden } from '../../api/types'
import { PRODUCTS } from '../../api/types'
import { WeatherIcon } from '../hava/WeatherIcon'
import { formatTemp } from '../../lib/weather'
import { formatDecare, largestOuterRing, silhouettePath } from '../../lib/geo'
import { gardenPath } from '../../lib/routes'
import { LIST } from '../../lib/config'
import { STATUS_META } from '../../lib/status'
import { GardenActionsMenu } from './GardenActionsMenu'
import { StatusBadge } from './StatusBadge'

interface GardenCardProps {
  overview: GardenOverview
  /** Silüet ve bahçe işlemleri için tam bahçe kaydı */
  garden: Garden
  selected: boolean
  onRename: (garden: Garden, name: string) => Promise<void>
  onEditBoundary: (garden: Garden) => void
  onDelete: (garden: Garden) => void
}

const productLabel = (value: string): string => PRODUCTS.find((p) => p.value === value)?.label ?? value

function Thumb({ overview, garden }: { overview: GardenOverview; garden: Garden }) {
  const [failed, setFailed] = useState(false)
  const image = overview.sonGoruntu
  const size = LIST.thumbPx
  if (image && !failed) {
    return (
      <img
        src={image.kucukResimUrl}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="ndvi-pixelated shrink-0 rounded-sm bg-app-bg object-contain"
        style={{ width: size, height: size }}
      />
    )
  }
  const path = silhouettePath(largestOuterRing(garden.geometry))
  return (
    <svg viewBox="0 0 40 40" className="shrink-0 rounded-sm bg-app-bg" style={{ width: size, height: size }} aria-hidden>
      {path && <path d={path} className="fill-app-text-dim/20 stroke-app-text-dim" strokeWidth={1.5} strokeLinejoin="round" />}
    </svg>
  )
}

/** Bahçe listesi kartı: küçük resim, ad, ürün·dekar, durum, sparkline, uyarılar, bugünkü hava. Tüm kart bağlantıdır. */
export function GardenCard({ overview, garden, selected, onRename, onEditBoundary, onDelete }: GardenCardProps) {
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(garden.ad)
  const [saving, setSaving] = useState(false)
  const meta = STATUS_META[overview.durum]
  const where = [garden.ilce, garden.il].filter(Boolean).join(', ')

  async function commitRename() {
    const name = draft.trim()
    if (!name || name === garden.ad) {
      setRenaming(false)
      setDraft(garden.ad)
      return
    }
    setSaving(true)
    try {
      await onRename(garden, name)
      setRenaming(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <li
      data-testid="garden-card"
      data-status={overview.durum}
      className={cx(
        '@container relative rounded-md border bg-app-card shadow-e1 transition-colors duration-[var(--duration-fast)] hover:bg-app-card-hover',
        selected ? 'border-app-accent ring-1 ring-app-accent' : 'border-app-border',
      )}
    >
      {!renaming && (
        <Link to={gardenPath(garden.id)} aria-label={`${garden.ad} bahçesini aç`} className="absolute inset-0 rounded-md" />
      )}
      <div className="pointer-events-none relative flex gap-3 p-3">
        <Thumb overview={overview} garden={garden} />
        <div className="min-w-0 flex-1">
          {renaming ? (
            <div className="pointer-events-auto">
              <TextField
                label="Bahçe adı"
                hideLabel
                autoFocus
                value={draft}
                maxLength={120}
                disabled={saving}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={() => void commitRename()}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void commitRename()
                  if (event.key === 'Escape') {
                    setRenaming(false)
                    setDraft(garden.ad)
                  }
                }}
              />
            </div>
          ) : (
            <h3 className="truncate pr-11 font-display text-lead text-app-text">{garden.ad}</h3>
          )}
          <p className="truncate text-caption text-app-text-muted">
            {productLabel(garden.urun)} · {formatDecare(overview.dekar)}
            {where && ` · ${where}`}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <StatusBadge status={overview.durum} />
            {overview.hava && (
              <span className="tabular inline-flex items-center gap-1 text-small font-semibold text-app-text" title={overview.hava.aciklama}>
                <WeatherIcon name={overview.hava.ikon} className="h-4 w-4 text-app-text-muted" aria-hidden />
                {formatTemp(overview.hava.sicaklik)}
                <span className="sr-only">{overview.hava.aciklama}</span>
              </span>
            )}
          </div>
          <p className="mt-1 truncate text-caption text-app-text-dim">{overview.durumNedeni ?? meta.hint}</p>
        </div>
        {overview.seri.length > 1 && (
          <Sparkline
            values={overview.seri.map((p) => p.deger)}
            width={LIST.sparkWidthPx}
            height={LIST.sparkHeightPx}
            className="hidden shrink-0 self-end text-app-accent @xs:block"
            label={`Son ${overview.seri.length} görüntünün canlılık eğilimi`}
          />
        )}
      </div>
      <GardenActionsMenu
        className="absolute right-1 top-1"
        garden={garden}
        onRename={() => {
          setDraft(garden.ad)
          setRenaming(true)
        }}
        onEditBoundary={() => onEditBoundary(garden)}
        onDelete={() => onDelete(garden)}
      />
    </li>
  )
}
