import { Archive, Contrast, Leaf, Settings2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Segmented, SelectField, Switch, Tooltip, cx } from '@/components/ui'
import { useElementWidth } from '../../hooks/useElementWidth'
import { TOOLBAR } from '../../lib/config'
import { viewLabel } from '../../lib/raster'
import { useIndexView } from '../../hooks/useIndexView'
import { usePanelLayout } from '../../hooks/usePanelLayout'
import { formatDate } from '../../lib/dates'
import { LAYER_OPTIONS, type LayerId } from '../../lib/indices'
import { archivePath } from '../../lib/archive'
import { IndexLegend } from '../indeks/IndexLegend'
import { useBahcemStore } from '../../stores/bahcemStore'

/** Simge modunda parametre seçici: düğme + menü (etiket ipucunda ve erişilebilir adda). */
function ParameterMenu({ value, onChange }: { value: LayerId; onChange: (id: LayerId) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = LAYER_OPTIONS.find((o) => o.id === value)
  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  return (
    <div ref={ref} className="relative">
      <Tooltip label={`Parametre: ${current?.ad ?? ''}`} side="top">
        <button
          type="button"
          aria-label={`Parametre: ${current?.ad ?? ''}`}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-app-text hover:bg-app-card-hover"
        >
          <Leaf className="h-5 w-5" aria-hidden />
        </button>
      </Tooltip>
      {open && (
        <div role="menu" className="absolute bottom-full left-0 z-30 mb-2 w-56 rounded-lg border border-app-border bg-app-panel p-1.5 shadow-e3">
          {LAYER_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              role="menuitemradio"
              aria-checked={o.id === value}
              onClick={() => {
                onChange(o.id)
                setOpen(false)
              }}
              className={cx('flex min-h-11 w-full items-center rounded-sm px-3 text-left text-body hover:bg-app-card-hover', o.id === value ? 'font-semibold text-app-accent' : 'text-app-text')}
            >
              {o.ad}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Haritanın altındaki araç çubuğu: tek parametre seçici, görünüm (Bahçenin kendi farkları / Genel skala),
 * ayarlar ve «Tüm görüntüler». Üstteki kapsül her zaman EN GÜNCEL geçerli görüntünün tarihini söyler.
 */
export function MapToolbar() {
  const { gardenId, katman, active, scenes, data, shown } = useIndexView()
  const { listOpen, detailOpen, desktop } = usePanelLayout()
  const sheet = useBahcemStore((s) => s.sheet)
  const mode = useBahcemStore((s) => s.mode)
  const skala = useBahcemStore((s) => s.skala)
  const cizim = useBahcemStore((s) => s.cizim)
  const renkKorlugu = useBahcemStore((s) => s.renkKorlugu)
  const setKatman = useBahcemStore((s) => s.setKatman)
  const setSkala = useBahcemStore((s) => s.setSkala)
  const setCizim = useBahcemStore((s) => s.setCizim)
  const setRenkKorlugu = useBahcemStore((s) => s.setRenkKorlugu)
  const fullMap = useBahcemStore((s) => s.fullMap)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [wrapRef, wrapWidth] = useElementWidth<HTMLDivElement>(TOOLBAR.iconModeBelowPx)
  const iconMode = wrapWidth < TOOLBAR.iconModeBelowPx

  if (!gardenId || mode !== 'idle') return null
  const hasImages = (scenes ?? []).some((s) => s.durum === 'tamam')
  const processing = data?.isleme?.durum === 'bekliyor' || data?.isleme?.durum === 'isleniyor'
  if (!hasImages) {
    return (
      <div className="surface-dark pointer-events-none absolute bottom-[calc(var(--sheet-h)+0.75rem)] left-[var(--map-left)] min-[1180px]:bottom-10 right-[calc(var(--map-right)+3.75rem)] z-20 flex justify-center" data-testid="map-capsule">
        <p className="pointer-events-auto rounded-full border border-app-border bg-app-panel px-4 py-2 text-small text-app-text-muted shadow-e2">
          {processing ? 'Uydu görüntüleri hazırlanıyor…' : 'Bu bahçe için henüz kullanılabilir uydu görüntüsü yok.'}
        </p>
      </div>
    )
  }

  return (
    <div
      className={`surface-dark pointer-events-none absolute bottom-[calc(var(--sheet-h)+0.75rem)] left-[var(--map-left)] min-[1180px]:bottom-9 right-[calc(var(--map-right)+3.75rem)] z-20 @container flex-col items-center gap-2 ${
        !desktop && (listOpen || (detailOpen && sheet !== 'peek')) && !fullMap ? 'hidden' : 'flex'
      }`}
      data-testid="map-toolbar-wrap"
      ref={wrapRef}
    >
      <IndexLegend />
      {settingsOpen && (
        <div className="pointer-events-auto w-72 space-y-3 rounded-md border border-app-border bg-app-panel p-3 shadow-e3" role="group" aria-label="Görünüm ayarları">
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
        </div>
      )}
      <div
        className="pointer-events-auto flex max-w-full flex-nowrap items-center justify-center gap-x-2 rounded-lg border border-app-border bg-app-panel p-2 shadow-e2"
        role="toolbar"
        aria-label="Harita görünümü"
        data-testid="map-toolbar"
        data-mode={iconMode ? 'icons' : 'full'}
      >
        {!iconMode && wrapWidth >= TOOLBAR.capsuleMinPx && shown && active && (
          <p className="whitespace-nowrap px-2 text-small text-app-text" data-testid="map-capsule">
            En güncel: <strong>{formatDate(active.tarih)}</strong>
            {active.bulutOrani != null && <span className="text-app-text-muted"> · bulut %{Math.round(active.bulutOrani)}</span>}
          </p>
        )}
        {iconMode ? (
          <>
            <ParameterMenu value={katman} onChange={setKatman} />
            <Tooltip label={`Görünüm: ${viewLabel(skala)} (değiştirmek için basın)`} side="top">
              <button
                type="button"
                aria-label={`Görünüm: ${viewLabel(skala)} (değiştirmek için basın)`}
                onClick={() => setSkala(skala === 'kendi' ? 'genel' : 'kendi')}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-app-text hover:bg-app-card-hover"
              >
                <Contrast className="h-5 w-5" aria-hidden />
              </button>
            </Tooltip>
          </>
        ) : (
          <>
            <SelectField label="Parametre" hideLabel value={katman} onChange={(e) => setKatman(e.target.value as LayerId)} className="w-36 shrink-0">
              {LAYER_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.ad}
                </option>
              ))}
            </SelectField>
            <Segmented
              label="Görünüm"
              value={skala}
              onChange={setSkala}
              options={[
                { value: 'kendi', label: 'Bahçenin kendi farkları' },
                { value: 'genel', label: 'Genel skala' },
              ]}
              className="shrink-0 whitespace-nowrap"
            />
          </>
        )}
        <Tooltip label="Görünüm ayarları" side="top">
          <button
            type="button"
            aria-label="Görünüm ayarları"
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen((v) => !v)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-app-text-muted hover:bg-app-card-hover hover:text-app-text"
          >
            <Settings2 className="h-5 w-5" aria-hidden />
          </button>
        </Tooltip>
        <Tooltip label="Tüm görüntüler" side="top">
          <Link
            to={archivePath(gardenId, { parametre: katman, tarih: active?.tarih ?? null })}
            aria-label="Tüm görüntüler"
            className={cx(
              'inline-flex min-h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-app-primary font-semibold text-app-on-primary hover:bg-app-primary-hover',
              iconMode ? 'w-11' : 'px-3 text-body',
            )}
          >
            <Archive className="h-4 w-4" aria-hidden />
            {!iconMode && 'Tüm görüntüler'}
          </Link>
        </Tooltip>
      </div>
    </div>
  )
}
