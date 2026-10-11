import { useEffect, useMemo, useRef, useState } from 'react'
import { StatusBadge } from '../components/garden/StatusBadge'
import { WeatherIcon } from '../components/hava/WeatherIcon'
import { useGardensOverview, type GardenOverview } from '../api/overviewApi'
import { useGardens } from '../api/useGardens'
import { MAP } from '../lib/config'
import { boundsCenter, geometryBounds } from '../lib/geo'
import { STATUS_META } from '../lib/status'
import { formatTemp } from '../lib/weather'
import { useBahcemStore } from '../stores/bahcemStore'
import { useMap } from './useMap'

interface Point {
  x: number
  y: number
}

const HOVER_LAYER = 'gardens-fill'

/**
 * Harita üstü bahçe adları (yakınlaştırma eşiğinin altında gizlenir) ve üzerine gelince özet kart.
 * Yazılar DOM'dadır (raster altlıkta glif/yazı tipi gerekmez), konumları harita hareketinde yeniden projekte edilir.
 */
export function GardenMapLabels() {
  const { map, styleVersion } = useMap()
  const { data: gardens } = useGardens()
  const { data: overview } = useGardensOverview()
  const mode = useBahcemStore((s) => s.mode)
  const zoom = useBahcemStore((s) => s.mapZoom)
  const selectedId = useBahcemStore((s) => s.selectedGardenId)
  const [points, setPoints] = useState<Record<string, Point>>({})
  const [hover, setHover] = useState<{ id: string; at: Point } | null>(null)
  const frame = useRef(0)

  const centers = useMemo(
    () => (gardens ?? []).map((g) => ({ id: g.id, lngLat: boundsCenter(geometryBounds(g.geometry)) })),
    [gardens],
  )

  useEffect(() => {
    if (!map) return
    const project = () => {
      cancelAnimationFrame(frame.current)
      frame.current = requestAnimationFrame(() => {
        const next: Record<string, Point> = {}
        for (const c of centers) {
          const p = map.project(c.lngLat)
          next[c.id] = { x: p.x, y: p.y }
        }
        setPoints(next)
      })
    }
    project()
    map.on('move', project)
    map.on('resize', project)
    return () => {
      cancelAnimationFrame(frame.current)
      map.off('move', project)
      map.off('resize', project)
    }
  }, [map, centers])

  useEffect(() => {
    if (!map || styleVersion === 0) return
    const onMove = (event: { point: { x: number; y: number }; features?: { properties?: Record<string, unknown> }[] }) => {
      const id = event.features?.[0]?.properties?.id
      setHover(typeof id === 'string' ? { id, at: { x: event.point.x, y: event.point.y } } : null)
    }
    const onLeave = () => setHover(null)
    map.on('mousemove', HOVER_LAYER, onMove)
    map.on('mouseleave', HOVER_LAYER, onLeave)
    return () => {
      map.off('mousemove', HOVER_LAYER, onMove)
      map.off('mouseleave', HOVER_LAYER, onLeave)
    }
  }, [map, styleVersion])

  if (mode !== 'idle') return null
  const byId = new Map<string, GardenOverview>((overview?.bahceler ?? []).map((g) => [g.id, g]))
  const hovered = hover ? byId.get(hover.id) : undefined

  return (
    <div className="surface-dark pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-hidden>
      {zoom >= MAP.labelMinZoom &&
        centers.map((c) => {
          const p = points[c.id]
          const item = byId.get(c.id)
          // Seçili bahçenin adı haritada gösterilmez: sağ panelin başlığında zaten var ve görüntünün üstünü kapatır
          if (!p || !item || c.id === selectedId) return null
          const Icon = STATUS_META[item.durum].Icon
          return (
            <span
              key={c.id}
              data-testid="map-label"
              className="absolute inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-app-panel/85 px-2.5 py-1 text-caption font-semibold text-app-text shadow-e1 backdrop-blur-sm"
              style={{ left: p.x, top: p.y }}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {item.ad}
            </span>
          )
        })}
      {hovered && hover && (
        <div
          data-testid="map-hover-card"
          className="absolute w-60 rounded-md border border-app-border bg-app-panel p-3 shadow-e3"
          style={{ left: Math.min(hover.at.x + 16, window.innerWidth - 260), top: Math.max(hover.at.y - 8, 8) }}
        >
          <p className="font-display text-lead text-app-text">{hovered.ad}</p>
          <div className="mt-1.5 flex items-center gap-2">
            <StatusBadge status={hovered.durum} />
            {hovered.hava && (
              <span className="tabular inline-flex items-center gap-1 text-small font-semibold text-app-text">
                <WeatherIcon name={hovered.hava.ikon} className="h-4 w-4 text-app-text-muted" aria-hidden />
                {formatTemp(hovered.hava.sicaklik)}
              </span>
            )}
          </div>
          <p className="mt-1.5 text-small text-app-text-muted">{hovered.durumNedeni ?? STATUS_META[hovered.durum].hint}</p>
          <p className="mt-1.5 text-caption text-app-text-dim">Açmak için tıklayın</p>
        </div>
      )}
    </div>
  )
}
