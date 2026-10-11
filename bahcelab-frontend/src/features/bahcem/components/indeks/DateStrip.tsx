import { Fragment, useEffect, useMemo, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Cloud, Pause, Play } from 'lucide-react'
import { gridKey, indeksApi, layerImageUrl, type Scene } from '../../api/indeksApi'
import { useIndexView } from '../../hooks/useIndexView'
import { loadImage } from '../../lib/canvas'
import { formatDate, formatDayMonth, yearOf } from '../../lib/dates'
import { INDEX_DEFS, TRUE_COLOR, formatIndexValue, isIndexId, layerName, type LayerId } from '../../lib/indices'
import { isUsable } from '../../lib/scenes'
import { useBahcemStore } from '../../stores/bahcemStore'

const BASE_INTERVAL_MS = 1100
const SPEEDS = [0.5, 1, 2] as const

/** Haritanın altında yatay tarih şeridi: küçük önizlemeler, oynat/durdur (zaman atlaması), ok tuşlarıyla gezinme. */
export function DateStrip() {
  // Dar ekranda panel açıkken şerit panelin üstüne binmesin
  const panelOpen = useBahcemStore((s) => s.leftPanelOpen && !s.fullMap)
  const { gardenId, katman, data, active } = useIndexView()
  const mode = useBahcemStore((s) => s.mode)
  const oynat = useBahcemStore((s) => s.oynat)
  const hiz = useBahcemStore((s) => s.hiz)
  const setSelectedDate = useBahcemStore((s) => s.setSelectedDate)
  const setOynat = useBahcemStore((s) => s.setOynat)
  const setHiz = useBahcemStore((s) => s.setHiz)
  const client = useQueryClient()
  const listRef = useRef<HTMLDivElement>(null)

  const scenes = data?.gozlemler
  const selectable = useMemo(() => (scenes ?? []).filter((s) => isUsable(s, katman)), [scenes, katman])

  const pick = (tarih: string) => {
    setOynat(false) // elle seçim animasyonu durdurur
    setSelectedDate(tarih)
  }

  // Seçili tarih şeritte ortalanır. scrollIntoView kullanılmaz: overflow:hidden olan üst düzeni de
  // kaydırıp sayfayı bozar; yalnızca şeridin kendi kaydırması değiştirilir.
  useEffect(() => {
    const list = listRef.current
    const el = list?.querySelector<HTMLElement>(`[data-date="${active?.tarih}"]`)
    if (!list || !el) return
    list.scrollTo({ left: el.offsetLeft - list.clientWidth / 2 + el.clientWidth / 2, behavior: 'smooth' })
  }, [active])

  // Zaman atlaması: görüntüler önceden indirilir, sıradaki hazırsa geçilir (yoksa bir sonraki tıka bekler)
  useEffect(() => {
    if (!oynat || !gardenId || selectable.length < 2) return
    for (const scene of selectable) {
      if (katman === TRUE_COLOR) void loadImage(layerImageUrl(gardenId, scene, TRUE_COLOR)).catch(() => {})
      else if (isIndexId(katman) && scene.indeksler[katman]?.veriVar) {
        void client.prefetchQuery({
          queryKey: gridKey(gardenId, katman, scene.tarih, scene.surum),
          queryFn: () => indeksApi.grid(gardenId, scene, katman),
          staleTime: Infinity,
        })
      }
    }

    const ready = (scene: Scene) =>
      katman === TRUE_COLOR ||
      !isIndexId(katman) ||
      !scene.indeksler[katman]?.veriVar ||
      client.getQueryData(gridKey(gardenId, katman, scene.tarih, scene.surum)) !== undefined

    const timer = window.setInterval(() => {
      const state = useBahcemStore.getState()
      const index = selectable.findIndex((s) => s.tarih === (state.selectedDate ?? selectable[selectable.length - 1].tarih))
      const next = selectable[(index + 1) % selectable.length]
      if (ready(next)) setSelectedDate(next.tarih)
    }, BASE_INTERVAL_MS / hiz)
    return () => window.clearInterval(timer)
  }, [oynat, hiz, gardenId, katman, selectable, client, setSelectedDate])

  // Ok tuşları: yazı alanı/harita odakta değilken ya da şeridin kendisi odaktayken tarihler arasında gezinir
  useEffect(() => {
    if (!gardenId || mode !== 'idle' || selectable.length === 0) return

    const onKey = (e: KeyboardEvent) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return
      const target = e.target as HTMLElement | null
      const inStrip = listRef.current?.contains(target) ?? false
      const typing = target?.closest('input, textarea, select, [contenteditable="true"], canvas, [role="slider"]')
      if (typing && !inStrip) return

      const index = selectable.findIndex((s) => s.tarih === active?.tarih)
      let next = index
      if (e.key === 'ArrowLeft') next = Math.max(0, index - 1)
      if (e.key === 'ArrowRight') next = Math.min(selectable.length - 1, index + 1)
      if (e.key === 'Home') next = 0
      if (e.key === 'End') next = selectable.length - 1
      e.preventDefault()
      if (next !== index) pick(selectable[next].tarih)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pick yalnızca store eylemlerini kullanır
  }, [gardenId, mode, selectable, active])

  if (!gardenId || mode !== 'idle' || !scenes || scenes.length === 0) return null

  return (
    <div
      className={`surface-dark absolute bottom-9 left-[var(--map-left)] right-[calc(var(--map-right)+3.75rem)] z-20 flex items-stretch gap-2 rounded-lg border border-app-border bg-app-panel p-2 shadow-e2 transition-[left,right] duration-[var(--duration-panel)] ease-[var(--ease-out-soft)] ${panelOpen ? 'hidden md:flex' : ''}`}
    >
      <div className="flex shrink-0 flex-col items-center justify-center gap-1 border-r border-app-border pr-2">
        <button
          type="button"
          onClick={() => setOynat(!oynat)}
          disabled={selectable.length < 2}
          aria-label={oynat ? 'Zaman atlamasını durdur' : 'Zaman atlamasını oynat'}
          aria-pressed={oynat}
          className="flex h-11 w-11 items-center justify-center rounded-md bg-app-primary text-app-on-primary transition-colors hover:bg-app-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          {oynat ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
        </button>
        <select
          value={hiz}
          onChange={(e) => setHiz(Number(e.target.value) as (typeof SPEEDS)[number])}
          aria-label="Oynatma hızı"
          className="h-11 w-16 cursor-pointer rounded-md border border-app-border bg-app-card px-1 text-small text-app-text-muted"
        >
          {SPEEDS.map((s) => (
            <option key={s} value={s}>
              {s}×
            </option>
          ))}
        </select>
      </div>

      <div
        ref={listRef}
        role="listbox"
        aria-label={`${layerName(katman)} görüntü tarihleri`}
        aria-orientation="horizontal"
        tabIndex={0}
        className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-1 outline-none focus-visible:ring-2 focus-visible:ring-app-accent"
      >
        {scenes.map((scene, i) => (
          <Fragment key={scene.tarih}>
            {/* Şerit 13 ayı kapsar: aynı gün/ay iki yılda da bulunur, bu yüzden yıl ayırıcısı gösterilir */}
            {(i === 0 || yearOf(scene.tarih) !== yearOf(scenes[i - 1].tarih)) && (
              <span
                aria-hidden
                className="flex shrink-0 items-center self-stretch rounded-lg bg-app-bg/60 px-2 text-caption font-semibold text-app-text-muted"
              >
                {yearOf(scene.tarih)}
              </span>
            )}
            <DateCard
              gardenId={gardenId}
              scene={scene}
              layer={katman}
              selected={scene.tarih === active?.tarih}
              onSelect={pick}
            />
          </Fragment>
        ))}
      </div>
    </div>
  )
}

interface DateCardProps {
  gardenId: string
  scene: Scene
  layer: LayerId
  selected: boolean
  onSelect: (tarih: string) => void
}

function DateCard({ gardenId, scene, layer, selected, onSelect }: DateCardProps) {
  const cloudy = scene.durum !== 'tamam'
  const usable = isUsable(scene, layer)
  const value = isIndexId(layer) ? scene.indeksler[layer]?.ortalama : undefined
  const label = cloudy
    ? `${formatDate(scene.tarih)}, bulutlu (kullanılabilir piksel %${Math.round(scene.gecerliPikselOrani * 100)})`
    : usable
      ? `${formatDate(scene.tarih)}${value !== undefined ? `, ortalama ${INDEX_DEFS[layer as keyof typeof INDEX_DEFS].ad} ${formatIndexValue(layer as never, value)}` : ''}${scene.bulutOrani !== null ? `, bulut %${Math.round(scene.bulutOrani)}` : ''}`
      : `${formatDate(scene.tarih)}, bu katman için görüntü hazır değil`

  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      aria-disabled={!usable}
      aria-label={label}
      title={label}
      data-date={scene.tarih}
      tabIndex={-1}
      onClick={() => usable && onSelect(scene.tarih)}
      className={`flex w-[62px] shrink-0 flex-col items-center gap-1 rounded-md border p-1.5 transition-colors ${
        !usable
          ? 'cursor-not-allowed border-transparent opacity-40'
          : selected
            ? 'border-app-accent bg-app-card-hover'
            : 'border-transparent hover:bg-app-card'
      }`}
    >
      <span className="flex h-11 w-full items-center justify-center overflow-hidden rounded-sm bg-app-bg/80">
        {!usable ? (
          <Cloud className="h-5 w-5 text-app-text-muted" aria-hidden />
        ) : (
          <img
            src={layerImageUrl(gardenId, scene, layer)}
            alt=""
            loading="lazy"
            decoding="async"
            crossOrigin="use-credentials"
            className="ndvi-pixelated h-full w-full object-contain"
          />
        )}
      </span>
      <span className={`text-caption leading-none ${selected ? 'font-semibold text-app-text' : 'text-app-text-muted'}`}>
        {formatDayMonth(scene.tarih)}
      </span>
    </button>
  )
}
