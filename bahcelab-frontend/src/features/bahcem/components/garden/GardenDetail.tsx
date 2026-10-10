import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, MoreHorizontal, Pencil, Spline, TriangleAlert, Trash2 } from 'lucide-react'
import { describeError } from '../../api/gardensApi'
import { PRODUCTS, type Garden } from '../../api/types'
import { useRefreshNdvi } from '../../api/ndviApi'
import { useNdviView } from '../../hooks/useNdviView'
import { formatDecare } from '../../lib/geo'
import { formatDate } from '../../lib/dates'
import { formatNdvi, ndviColor } from '../../lib/ndvi'
import { useBahcemStore } from '../../stores/bahcemStore'
import { NdviChart } from '../ndvi/NdviChart'
import { NdviStatusCard } from '../ndvi/NdviStatusCard'
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
    'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] transition-colors hover:bg-app-card'
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

/** Seçili bahçenin detayı: son NDVI, uyarı, grafik ve işleme durumu. */
export function GardenDetail({ garden }: { garden: Garden }) {
  const selectGarden = useBahcemStore((s) => s.selectGarden)
  const season = useBahcemStore((s) => s.season)
  const setNdviDate = useBahcemStore((s) => s.setNdviDate)
  const { data, isLoading, active } = useNdviView()
  const refresh = useRefreshNdvi(garden.id)
  const actions = useGardenActions()
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(garden.ad)
  const [refreshError, setRefreshError] = useState<string | null>(null)

  const latest = [...(data?.gozlemler ?? [])].reverse().find((o) => o.durum === 'tamam' && o.ortalama !== null)
  const alert = data?.uyarilar[0]
  const location = [garden.ilce, garden.il].filter(Boolean).join(', ')

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
        <button
          type="button"
          onClick={() => selectGarden(null)}
          aria-label="Bahçe listesine dön"
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-app-text-muted transition-colors hover:bg-app-card hover:text-app-text"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </button>
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
              className="h-8 w-full rounded-lg border border-app-accent bg-app-bg/70 px-2 text-[15px] font-semibold text-app-text outline-none"
            />
          ) : (
            <h2 className="truncate text-[16px] font-semibold text-app-text">{garden.ad}</h2>
          )}
          <p className="mt-0.5 truncate text-[12px] text-app-text-muted">
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

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {isLoading || !data ? (
          <div className="space-y-3" aria-label="NDVI yükleniyor">
            <div className="h-20 animate-pulse rounded-2xl bg-app-card" />
            <div className="h-44 animate-pulse rounded-2xl bg-app-card" />
          </div>
        ) : (
          <>
            <section className="flex items-center justify-between gap-3 rounded-2xl bg-app-card p-3.5" aria-label="Son NDVI">
              {latest ? (
                <>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-app-text-dim">Son NDVI</p>
                    <p className="mt-0.5 text-[26px] font-semibold leading-none text-app-text">
                      {formatNdvi(latest.ortalama)}
                    </p>
                    <p className="mt-1.5 text-[12px] text-app-text-muted">{formatDate(latest.tarih)}</p>
                  </div>
                  <span
                    className="rounded-full px-3 py-1 text-[12px] font-semibold"
                    style={{
                      color: ndviColor(latest.ortalama as number),
                      backgroundColor: `color-mix(in srgb, ${ndviColor(latest.ortalama as number)} 16%, transparent)`,
                    }}
                  >
                    {latest.ortalama! >= 0.6 ? 'Güçlü' : latest.ortalama! >= 0.4 ? 'Orta' : 'Zayıf'}
                  </span>
                </>
              ) : (
                <p className="text-[13px] text-app-text-muted">
                  {data.isleme?.durum === 'bekliyor' || data.isleme?.durum === 'isleniyor'
                    ? 'İlk görüntüler hazırlanıyor…'
                    : 'Henüz kullanılabilir NDVI görüntüsü yok.'}
                </p>
              )}
            </section>

            {alert && (
              <section
                role="alert"
                className="flex items-start gap-2.5 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3.5"
              >
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden />
                <div>
                  <p className="text-[13px] font-semibold text-amber-200">NDVI düşüşü</p>
                  <p className="mt-1 text-[12px] leading-snug text-app-text-muted">{alert.mesaj}</p>
                  <button
                    type="button"
                    onClick={() => setNdviDate(alert.sonTarih)}
                    className="mt-2 text-[12px] font-medium text-amber-200 underline-offset-2 hover:underline"
                  >
                    Son görüntüyü haritada göster
                  </button>
                </div>
              </section>
            )}

            {data.gozlemler.some((o) => o.durum === 'tamam') && (
              <section className="rounded-2xl bg-app-card p-3.5">
                <NdviChart
                  observations={data.gozlemler}
                  season={season}
                  activeDate={active?.tarih ?? null}
                  onSelect={setNdviDate}
                />
              </section>
            )}

            <NdviStatusCard
              data={data}
              refreshing={refresh.isPending}
              onRefresh={onRefresh}
              refreshError={refreshError}
            />
          </>
        )}
      </div>
      {actions.dialog}
    </div>
  )
}
