import { Archive, Settings2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Segmented, SelectField, Switch } from '@/components/ui'
import { useIndexView } from '../../hooks/useIndexView'
import { usePanelLayout } from '../../hooks/usePanelLayout'
import { formatDate } from '../../lib/dates'
import { LAYER_OPTIONS, type LayerId } from '../../lib/indices'
import { archivePath } from '../../lib/archive'
import { IndexLegend } from '../indeks/IndexLegend'
import { useBahcemStore } from '../../stores/bahcemStore'

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

  if (!gardenId || mode !== 'idle') return null
  const hasImages = (scenes ?? []).some((s) => s.durum === 'tamam')
  const processing = data?.isleme?.durum === 'bekliyor' || data?.isleme?.durum === 'isleniyor'
  if (!hasImages) {
    return (
      <div className="surface-dark pointer-events-none absolute bottom-[calc(var(--sheet-h)+0.75rem)] left-[var(--map-left)] md:bottom-10 right-[calc(var(--map-right)+3.75rem)] z-20 flex justify-center" data-testid="map-capsule">
        <p className="pointer-events-auto rounded-full border border-app-border bg-app-panel px-4 py-2 text-small text-app-text-muted shadow-e2">
          {processing ? 'Uydu görüntüleri hazırlanıyor…' : 'Bu bahçe için henüz kullanılabilir uydu görüntüsü yok.'}
        </p>
      </div>
    )
  }

  return (
    <div
      className={`surface-dark pointer-events-none absolute bottom-[calc(var(--sheet-h)+0.75rem)] left-[var(--map-left)] md:bottom-9 right-[calc(var(--map-right)+3.75rem)] z-20 flex-col items-center gap-2 ${
        !desktop && (listOpen || (detailOpen && sheet !== 'peek')) && !fullMap ? 'hidden' : 'flex'
      }`}
      data-testid="map-toolbar-wrap"
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
        className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-x-2 gap-y-1.5 rounded-lg border border-app-border bg-app-panel p-2 shadow-e2"
        role="toolbar"
        aria-label="Harita görünümü"
        data-testid="map-toolbar"
      >
        {shown && active && (
          <p className="px-2 text-small text-app-text" data-testid="map-capsule">
            En güncel: <strong>{formatDate(active.tarih)}</strong>
            {active.bulutOrani != null && <span className="text-app-text-muted"> · bulut %{Math.round(active.bulutOrani)}</span>}
          </p>
        )}
        <SelectField label="Parametre" hideLabel value={katman} onChange={(e) => setKatman(e.target.value as LayerId)} className="w-40">
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
        />
        <button
          type="button"
          aria-label="Görünüm ayarları"
          aria-expanded={settingsOpen}
          onClick={() => setSettingsOpen((v) => !v)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-app-text-muted hover:bg-app-card-hover hover:text-app-text"
        >
          <Settings2 className="h-5 w-5" aria-hidden />
        </button>
        <Link
          to={archivePath(gardenId, { parametre: katman, tarih: active?.tarih ?? null })}
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md bg-app-primary px-3 text-body font-semibold text-app-on-primary hover:bg-app-primary-hover"
        >
          <Archive className="h-4 w-4" aria-hidden />
          Tüm görüntüler
        </Link>
      </div>
    </div>
  )
}
