import { Fragment, useEffect, useMemo, useRef } from 'react'
import { Cloud } from 'lucide-react'
import { ndviImageUrl, type NdviObservation } from '../../api/ndviApi'
import { useNdviView } from '../../hooks/useNdviView'
import { formatDate, formatDayMonth, yearOf } from '../../lib/dates'
import { formatNdvi } from '../../lib/ndvi'
import { useBahcemStore } from '../../stores/bahcemStore'

/** Haritanın altında yatay tarih şeridi: küçük NDVI önizlemeleri, bulutlu tarihler soluk ve tıklanamaz. */
export function NdviDateStrip() {
  const { gardenId, data, active } = useNdviView()
  const mode = useBahcemStore((s) => s.mode)
  const panelOpen = useBahcemStore((s) => s.leftPanelOpen)
  const setNdviDate = useBahcemStore((s) => s.setNdviDate)
  const listRef = useRef<HTMLDivElement>(null)

  const observations = data?.gozlemler
  const selectable = useMemo(
    () => (observations ?? []).filter((o) => o.durum === 'tamam' && o.pngVar),
    [observations],
  )

  // Seçili tarih şeritte ortalanır. scrollIntoView kullanılmaz: overflow:hidden olan üst düzeni de
  // kaydırıp sayfayı bozar; yalnızca şeridin kendi kaydırması değiştirilir.
  useEffect(() => {
    const list = listRef.current
    const el = list?.querySelector<HTMLElement>(`[data-date="${active?.tarih}"]`)
    if (!list || !el) return
    list.scrollTo({
      left: el.offsetLeft - list.clientWidth / 2 + el.clientWidth / 2,
      behavior: 'smooth',
    })
  }, [active])

  // Ok tuşları: yazı alanı/harita odakta değilken ya da şeridin kendisi odaktayken tarihler arasında gezinir
  useEffect(() => {
    if (!gardenId || mode !== 'idle' || selectable.length === 0) return

    const onKey = (e: KeyboardEvent) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return
      const target = e.target as HTMLElement | null
      const inStrip = listRef.current?.contains(target) ?? false
      const typing = target?.closest('input, textarea, select, [contenteditable="true"], canvas')
      if (typing && !inStrip) return

      const index = selectable.findIndex((o) => o.tarih === active?.tarih)
      let next = index
      if (e.key === 'ArrowLeft') next = Math.max(0, index - 1)
      if (e.key === 'ArrowRight') next = Math.min(selectable.length - 1, index + 1)
      if (e.key === 'Home') next = 0
      if (e.key === 'End') next = selectable.length - 1
      e.preventDefault()
      if (next !== index) setNdviDate(selectable[next].tarih)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [gardenId, mode, selectable, active, setNdviDate])

  if (!gardenId || mode !== 'idle' || !observations || observations.length === 0) return null

  return (
    <div
      className={`absolute bottom-3 left-[4.25rem] right-[4.5rem] z-20 rounded-2xl border border-app-border bg-app-panel p-2 shadow-2xl transition-[left] duration-300 ease-out ${
        panelOpen ? 'md:left-[27.5rem]' : 'md:left-[4.25rem]'
      }`}
    >
      <div
        ref={listRef}
        role="listbox"
        aria-label="NDVI görüntü tarihleri"
        aria-orientation="horizontal"
        tabIndex={0}
        className="flex gap-1.5 overflow-x-auto pb-1 outline-none focus-visible:ring-2 focus-visible:ring-app-accent"
      >
        {observations.map((o, i) => (
          <Fragment key={o.tarih}>
            {/* Şerit 13 ayı kapsar: aynı gün/ay iki yılda da bulunur, bu yüzden yıl ayırıcısı gösterilir */}
            {(i === 0 || yearOf(o.tarih) !== yearOf(observations[i - 1].tarih)) && (
              <span
                aria-hidden
                className="flex shrink-0 items-center self-stretch rounded-lg bg-app-bg/60 px-2 text-[10px] font-semibold text-app-text-muted"
              >
                {yearOf(o.tarih)}
              </span>
            )}
            <DateCard
              gardenId={gardenId}
              observation={o}
              selected={o.tarih === active?.tarih}
              onSelect={setNdviDate}
            />
          </Fragment>
        ))}
      </div>
    </div>
  )
}

interface DateCardProps {
  gardenId: string
  observation: NdviObservation
  selected: boolean
  onSelect: (tarih: string) => void
}

function DateCard({ gardenId, observation: o, selected, onSelect }: DateCardProps) {
  const cloudy = o.durum !== 'tamam' || !o.pngVar
  const label = cloudy
    ? `${formatDate(o.tarih)}, bulutlu (kullanılabilir piksel %${Math.round(o.gecerliPikselOrani * 100)})`
    : `${formatDate(o.tarih)}, ortalama NDVI ${formatNdvi(o.ortalama)}`

  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      aria-disabled={cloudy}
      aria-label={label}
      title={label}
      data-date={o.tarih}
      tabIndex={-1}
      onClick={() => !cloudy && onSelect(o.tarih)}
      className={`flex w-[62px] shrink-0 flex-col items-center gap-1 rounded-xl border p-1.5 transition-colors ${
        cloudy
          ? 'cursor-not-allowed border-transparent opacity-40'
          : selected
            ? 'border-app-accent bg-app-card-hover'
            : 'border-transparent hover:bg-app-card'
      }`}
    >
      <span className="flex h-11 w-full items-center justify-center overflow-hidden rounded-lg bg-app-bg/80">
        {cloudy ? (
          <Cloud className="h-5 w-5 text-app-text-muted" aria-hidden />
        ) : (
          <img
            src={ndviImageUrl(gardenId, o)}
            alt=""
            loading="lazy"
            decoding="async"
            crossOrigin="use-credentials"
            className="ndvi-pixelated h-full w-full object-contain"
          />
        )}
      </span>
      <span
        className={`text-[10px] leading-none ${selected ? 'font-semibold text-app-text' : 'text-app-text-muted'}`}
      >
        {formatDayMonth(o.tarih)}
      </span>
    </button>
  )
}
