import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, MoreHorizontal, Pencil, Spline, Trash2 } from 'lucide-react'
import { describeError } from '../../api/gardensApi'
import { PRODUCTS, type Garden } from '../../api/types'
import { useRefreshIndices } from '../../api/indeksApi'
import { useWeatherHistory } from '../../api/weatherApi'
import { IconButton, Skeleton, Tabs } from '@/components/ui'
import { useBahcemRoute } from '../../hooks/useBahcemRoute'
import { useGardenNav } from '../../hooks/useGardenNav'
import { GARDEN_TABS, GARDEN_TAB_LABELS, gardenPath } from '../../lib/routes'
import { ComingSoon } from './ComingSoon'
import { useIndexView } from '../../hooks/useIndexView'
import { formatDecare } from '../../lib/geo'
import { formatDate, shiftDays, todayIstanbul } from '../../lib/dates'
import { INDEX_DEFS, TRUE_COLOR, formatIndexValue, indexColor, layerName, vigorLabel } from '../../lib/indices'
import { latestIndexValue } from '../../lib/scenes'
import { useBahcemStore } from '../../stores/bahcemStore'
import { AlertsCard } from '../indeks/AlertsCard'
import { IndexChart } from '../indeks/IndexChart'
import { StatusCard } from '../indeks/StatusCard'
import { ViewPanel } from '../indeks/ViewPanel'
import { YieldCard } from '../indeks/YieldCard'
import { WeatherTab } from '../hava/WeatherTab'
import { useGardenActions } from './useGardenActions'

const productLabel = (value: string) => PRODUCTS.find((p) => p.value === value)?.label ?? value

type Actions = ReturnType<typeof useGardenActions>

function ActionsMenu({
  garden,
  actions: { editBoundary, requestDelete },
  onRename,
}: {
  garden: Garden
  actions: Actions
  onRename: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

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

  const item =
    'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-small transition-colors hover:bg-app-card'
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Bahçe işlemleri"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-app-text-muted transition-colors hover:bg-app-card hover:text-app-text"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-1 w-48 rounded-xl border border-app-border bg-app-panel p-1 shadow-2xl">
          <button type="button" role="menuitem" className={`${item} text-app-text`} onClick={() => { setOpen(false); onRename() }}>
            <Pencil className="h-4 w-4 text-app-text-muted" aria-hidden /> Adını düzenle
          </button>
          <button type="button" role="menuitem" className={`${item} text-app-text`} onClick={() => { setOpen(false); editBoundary(garden) }}>
            <Spline className="h-4 w-4 text-app-text-muted" aria-hidden /> Sınırı düzenle
          </button>
          <button type="button" role="menuitem" className={`${item} text-app-danger`} onClick={() => { setOpen(false); requestDelete(garden) }}>
            <Trash2 className="h-4 w-4" aria-hidden /> Sil
          </button>
        </div>
      )}
    </div>
  )
}

/** Seçili bahçenin detayı: son değer, uyarılar, görünüm ayarları, verimlilik bölgeleri, grafik ve işleme durumu. */
export function GardenDetail({ garden }: { garden: Garden }) {
  const { close } = useGardenNav()
  const { tab } = useBahcemRoute()
  const season = useBahcemStore((s) => s.season)
  const grafik = useBahcemStore((s) => s.grafikIndeksleri)
  const toggleGrafik = useBahcemStore((s) => s.toggleGrafikIndeksi)
  const setSelectedDate = useBahcemStore((s) => s.setSelectedDate)
  const havaKatmani = useBahcemStore((s) => s.havaKatmani)
  const setHavaKatmani = useBahcemStore((s) => s.setHavaKatmani)
  const { data, scenes, isLoading, active, katman } = useIndexView()
  const refresh = useRefreshIndices(garden.id)
  // Grafik hava katmanı: seçili sezonun takvim yılı (bugüne kadar)
  const weatherTo = (() => {
    const yesterday = shiftDays(todayIstanbul(), -1)
    const yearEnd = `${season}-12-31`
    return yearEnd < yesterday ? yearEnd : yesterday
  })()
  const weatherHistory = useWeatherHistory(garden.id, `${season}-01-01`, weatherTo, havaKatmani)
  const actions = useGardenActions()
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(garden.ad)
  const [refreshError, setRefreshError] = useState<string | null>(null)

  const indexLayer = katman === TRUE_COLOR ? 'ndvi' : katman
  const latest = latestIndexValue(scenes, indexLayer)
  const location = [garden.ilce, garden.il].filter(Boolean).join(', ')
  const processing = data?.isleme?.durum === 'bekliyor' || data?.isleme?.durum === 'isleniyor'

  async function commitRename() {
    const next = name.trim()
    if (next && next !== garden.ad) {
      try {
        await actions.rename(garden, next)
      } catch {
        return
      }
    }
    setRenaming(false)
  }

  function onRefresh() {
    setRefreshError(null)
    refresh.mutate(undefined, { onError: (err) => setRefreshError(describeError(err)) })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-start gap-2 border-b border-app-border px-3 py-3">
        <IconButton label="Bahçe listesine dön" onClick={close} className="-ml-1">
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </IconButton>
        <div className="min-w-0 flex-1">
          {renaming ? (
            <input
              autoFocus
              value={name}
              maxLength={120}
              aria-label="Bahçe adı"
              onChange={(e) => setName(e.target.value)}
              onBlur={() => void commitRename()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void commitRename()
                if (e.key === 'Escape') {
                  setName(garden.ad)
                  setRenaming(false)
                }
              }}
              className="h-8 w-full rounded-lg border border-app-accent bg-app-bg/70 px-2 text-body font-semibold text-app-text outline-none"
            />
          ) : (
            <h2 className="truncate text-lead font-semibold text-app-text">{garden.ad}</h2>
          )}
          <p className="mt-0.5 truncate text-caption text-app-text-muted">
            {productLabel(garden.urun)} · {formatDecare(garden.alanDekar)}
            {location && ` · ${location}`}
          </p>
        </div>
        <ActionsMenu
          garden={garden}
          actions={actions}
          onRename={() => {
            setName(garden.ad)
            setRenaming(true)
          }}
        />
      </header>

      <Tabs
        label="Bahçe bilgileri"
        idPrefix="garden"
        value={tab}
        items={GARDEN_TABS.map((id) => ({ id, label: GARDEN_TAB_LABELS[id], to: gardenPath(garden.id, id) }))}
        className="border-b border-app-border px-3 pt-1"
      />

      <div
        id={`garden-panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`garden-tab-${tab}`}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3"
        data-testid="detail-panel"
      >
        {tab === 'hava' ? (
          <WeatherTab gardenId={garden.id} />
        ) : tab === 'gunluk' ? (
          <ComingSoon title="Günlük" step="Adım 11–13" text="Gözlem ve hasat kaydı, ilaç defteri ve maliyet defteri burada olacak." />
        ) : tab === 'rapor' ? (
          <ComingSoon title="Rapor" step="Adım 16" text="Sezon raporu (PDF) ve paylaşım bağlantısı burada olacak." />
        ) : isLoading || !data ? (
          <div className="space-y-3" aria-label="Uydu verisi yükleniyor">
            <Skeleton className="h-20" />
            <Skeleton className="h-44" />
          </div>
        ) : (
          <>
            {tab === 'durum' && (
            <section className="flex items-center justify-between gap-3 rounded-md border border-app-border bg-app-card p-3.5" aria-label="Son değer">
              {latest ? (
                <>
                  <div>
                    <p className="text-caption uppercase tracking-wide text-app-text-dim">Son {INDEX_DEFS[indexLayer].ad}</p>
                    <p className="mt-0.5 text-h1 font-semibold leading-none text-app-text">
                      {formatIndexValue(indexLayer, latest.ortalama)}
                    </p>
                    <p className="mt-1.5 text-caption text-app-text-muted" data-testid="latest-date">
                      {formatDate(latest.tarih)}
                    </p>
                  </div>
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-caption font-semibold text-app-text"
                    style={{ backgroundColor: `color-mix(in srgb, ${indexColor(indexLayer, latest.ortalama)} 22%, transparent)` }}
                  >
                    <i className="h-2 w-2 rounded-full" style={{ background: indexColor(indexLayer, latest.ortalama) }} aria-hidden />
                    {vigorLabel(indexLayer, latest.ortalama)}
                  </span>
                </>
              ) : (
                <p className="text-small text-app-text-muted">
                  {processing ? 'İlk görüntüler hazırlanıyor…' : 'Henüz kullanılabilir görüntü yok.'}
                </p>
              )}
            </section>
            )}

            {tab === 'analiz' ? (
              scenes?.some((s) => s.durum === 'tamam') ? (
                <YieldCard gardenId={garden.id} />
              ) : (
                <p className="px-1 text-small text-app-text-muted">Analiz için önce uydu görüntüleri hazır olmalı.</p>
              )
            ) : null}

            {tab === 'durum' && <AlertsCard alerts={data.uyarilar} />}

            {tab === 'durum' && (active || scenes?.some((s) => s.durum === 'tamam') ? <ViewPanel /> : null)}

            {tab === 'durum' && scenes?.some((s) => s.durum === 'tamam') && (
              <section className="rounded-md border border-app-border bg-app-card p-3.5">
                <IndexChart
                  scenes={data.gozlemler}
                  season={season}
                  active={grafik}
                  activeDate={active?.tarih ?? null}
                  onToggle={toggleGrafik}
                  onSelect={setSelectedDate}
                  weather={havaKatmani ? (weatherHistory.data ?? []) : null}
                  weatherLoading={weatherHistory.isLoading}
                  onWeatherToggle={() => setHavaKatmani(!havaKatmani)}
                />
              </section>
            )}

            {tab === 'durum' && <StatusCard data={data} refreshing={refresh.isPending} onRefresh={onRefresh} refreshError={refreshError} />}
            {katman !== TRUE_COLOR ? null : (
              <p className="px-1 text-caption text-app-text-dim">{layerName(katman)} görüntüsü bulutsuz tarihler için üretilir.</p>
            )}
          </>
        )}
      </div>
      {actions.dialog}
    </div>
  )
}
