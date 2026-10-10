import { useEffect, useMemo, useRef, useState } from 'react'
import { Crosshair, Loader2, MapPin, Search, X } from 'lucide-react'
import { parseCoordinates, searchPlaces, type PlaceResult } from '../../map/geocoding'
import { getMaptilerKey } from '../../map/mapStyles'
import { useMap } from '../../map/useMap'

const DEBOUNCE_MS = 300

export function PlaceSearch() {
  const { map } = useMap()
  const hasKey = Boolean(getMaptilerKey())

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PlaceResult[]>([])
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)

  const coords = useMemo(() => parseCoordinates(query), [query])

  const text = query.trim()
  const canSearch = hasKey && text.length >= 2 && !coords

  useEffect(() => {
    if (!canSearch) return

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setLoading(true)
      searchPlaces(text, controller.signal)
        .then((found) => {
          setResults(found)
          setFailed(false)
          setActive(0)
        })
        .catch((err: unknown) => {
          if ((err as { name?: string }).name !== 'AbortError') setFailed(true)
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false)
        })
    }, DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [text, canSearch])

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open])

  type Item = { key: string; label: string; icon: 'pin' | 'coords'; go: () => void }

  const items: Item[] = useMemo(() => {
    if (coords) {
      return [
        {
          key: 'coords',
          label: `Koordinata git: ${coords.lat}, ${coords.lng}`,
          icon: 'coords',
          go: () => map?.flyTo({ center: [coords.lng, coords.lat], zoom: 15, duration: 1600 }),
        },
      ]
    }
    return (canSearch ? results : []).map((place) => ({
      key: place.id,
      label: place.label,
      icon: 'pin' as const,
      go: () => {
        if (place.bbox) {
          map?.fitBounds(place.bbox, { padding: 80, maxZoom: 14, duration: 1600 })
        } else {
          map?.flyTo({ center: place.center, zoom: 13, duration: 1600 })
        }
      },
    }))
  }, [coords, canSearch, results, map])

  function choose(item: Item) {
    item.go()
    setQuery(item.label.replace(/^Koordinata git: /, ''))
    setOpen(false)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setOpen(false)
    } else if (e.key === 'ArrowDown' && items.length) {
      e.preventDefault()
      setOpen(true)
      setActive((i) => (i + 1) % items.length)
    } else if (e.key === 'ArrowUp' && items.length) {
      e.preventDefault()
      setActive((i) => (i - 1 + items.length) % items.length)
    } else if (e.key === 'Enter' && items[active]) {
      e.preventDefault()
      choose(items[active])
    }
  }

  const isLoading = canSearch && loading
  const showList = open && text.length >= 2
  const placeholder = hasKey
    ? 'İl, ilçe, köy veya koordinat ara'
    : 'Koordinat ara (yer araması için MapTiler anahtarı gerekli)'

  return (
    <div
      ref={rootRef}
      className="absolute left-[4.25rem] right-[8.75rem] top-3 z-20 md:left-1/2 md:right-auto md:w-[min(480px,calc(100vw-30rem))] md:-translate-x-1/2"
    >
      <div className="flex h-11 items-center gap-2 rounded-full border border-app-border bg-app-panel pl-4 pr-2 shadow-xl transition-colors focus-within:border-app-accent">
        {isLoading ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-app-text-muted" aria-hidden />
        ) : (
          <Search className="h-4 w-4 shrink-0 text-app-text-muted" aria-hidden />
        )}
        <input
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls="place-search-list"
          aria-label="Konum ara"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-[14px] text-app-text outline-none placeholder:text-app-text-dim"
        />
        {query && (
          <button
            type="button"
            aria-label="Aramayı temizle"
            onClick={() => {
              setQuery('')
              setResults([])
            }}
            className="flex h-7 w-7 items-center justify-center rounded-full text-app-text-muted transition-colors hover:bg-app-card hover:text-app-text"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>

      {showList && (
        <ul
          id="place-search-list"
          role="listbox"
          className="mt-2 overflow-hidden rounded-2xl border border-app-border bg-app-panel py-1.5 shadow-2xl"
        >
          {items.map((item, index) => (
            <li key={item.key} role="option" aria-selected={index === active}>
              <button
                type="button"
                onClick={() => choose(item)}
                onMouseEnter={() => setActive(index)}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] text-app-text transition-colors ${
                  index === active ? 'bg-app-card' : ''
                }`}
              >
                {item.icon === 'coords' ? (
                  <Crosshair className="h-4 w-4 shrink-0 text-app-accent" aria-hidden />
                ) : (
                  <MapPin className="h-4 w-4 shrink-0 text-app-text-muted" aria-hidden />
                )}
                <span className="truncate">{item.label}</span>
              </button>
            </li>
          ))}
          {items.length === 0 && !isLoading && (
            <li className="px-4 py-3 text-[13px] text-app-text-muted">
              {failed && canSearch
                ? 'Arama şu an yapılamıyor. Biraz sonra tekrar deneyin.'
                : hasKey
                  ? 'Sonuç bulunamadı.'
                  : 'Yer araması için MapTiler anahtarı gerekli; koordinat girebilirsiniz.'}
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
