import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui'
import { Check, MousePointerClick, Play, Undo2, X } from 'lucide-react'
import {
  TerraDraw,
  TerraDrawModeUndoRedo,
  TerraDrawPolygonMode,
  TerraDrawSelectMode,
  TerraDrawUndoRedoKeyboardShortcuts,
  type GeoJSONStoreFeatures,
  type HexColor,
} from 'terra-draw'
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter'
import { describeError } from '../../api/gardensApi'
import type { PolygonCoordinates } from '../../api/types'
import { useGardens, useUpdateGarden } from '../../api/useGardens'
import { formatDecare, geometryBounds, ringAreaM2 } from '../../lib/geo'
import { cssColor } from '../../map/cssColor'
import { useFocusPadding } from '../../map/useFocusGarden'
import { useMap } from '../../map/useMap'
import { useBahcemStore } from '../../stores/bahcemStore'
import { useToast } from '../layout/toastContext'
import { TOP_AREA_CLASS } from '../layout/topArea'

/** Bu yakınlaştırma düzeyinin altında çizim başlatılamaz (köşeler yeterince hassas olsun). */
export const MIN_DRAW_ZOOM = 14

const POLYGON_MODE = 'polygon'
const SELECT_MODE = 'select'

const asHex = (value: string): HexColor => value as HexColor

function polygonStyles(accent: HexColor) {
  return {
    fillColor: accent,
    fillOpacity: 0.25,
    outlineColor: accent,
    outlineWidth: 3,
    closingPointColor: '#ffffff' as HexColor,
    closingPointWidth: 7,
    closingPointOutlineColor: accent,
    closingPointOutlineWidth: 3,
  }
}

function selectStyles(accent: HexColor) {
  return {
    selectedPolygonColor: accent,
    selectedPolygonFillOpacity: 0.25,
    selectedPolygonOutlineColor: accent,
    selectedPolygonOutlineWidth: 3,
    selectionPointColor: '#ffffff' as HexColor,
    selectionPointWidth: 6,
    selectionPointOutlineColor: accent,
    selectionPointOutlineWidth: 3,
    midPointColor: accent,
    midPointOutlineColor: '#ffffff' as HexColor,
    midPointWidth: 4,
    midPointOutlineWidth: 2,
  }
}

type PolygonFeature = GeoJSONStoreFeatures & { geometry: { type: 'Polygon'; coordinates: number[][][] } }

/** Anlık görüntüden çizilen/düzenlenen bahçe poligonunu (yardımcı noktalar hariç) bulur. */
function findPolygon(draw: TerraDraw, id?: string | number): PolygonFeature | undefined {
  return draw
    .getSnapshot()
    .find(
      (f) =>
        f.geometry.type === 'Polygon' &&
        f.properties.mode === POLYGON_MODE &&
        (id === undefined || f.id === id),
    ) as PolygonFeature | undefined
}

/** Çizim/düzenleme oturumu: açılırken state sıfır, kapanırken terra-draw tamamen kaldırılır. */
function DrawSession() {
  const { map, styleVersion } = useMap()
  const mode = useBahcemStore((s) => s.mode)
  const editingId = useBahcemStore((s) => s.editingGardenId)
  const mapZoom = useBahcemStore((s) => s.mapZoom)
  const liveArea = useBahcemStore((s) => s.liveAreaDekar)
  const setLiveArea = useBahcemStore((s) => s.setLiveArea)
  const openForm = useBahcemStore((s) => s.openForm)
  const resetFlow = useBahcemStore((s) => s.resetFlow)
  const { data: gardens } = useGardens()
  const update = useUpdateGarden()
  const toast = useToast()
  const padding = useFocusPadding()

  const drawRef = useRef<TerraDraw | null>(null)
  const [started, setStarted] = useState(false)
  const [canUndo, setCanUndo] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const tooFar = mapZoom < MIN_DRAW_ZOOM

  const cancel = useCallback(() => {
    resetFlow()
  }, [resetFlow])

  // terra-draw örneği: çizim/düzenleme süresince yaşar, bitince tüm katmanlarıyla kaldırılır
  useEffect(() => {
    if (!map || styleVersion === 0) return

    const accent = asHex(cssColor('--color-app-accent'))
    const draw = new TerraDraw({
      adapter: new TerraDrawMapLibreGLAdapter({ map }),
      // Köşe bazında geri alma ve Ctrl/Cmd+Z kısayolu
      undoRedo: {
        modeLevel: new TerraDrawModeUndoRedo(),
        keyboardShortcuts: new TerraDrawUndoRedoKeyboardShortcuts(),
      },
      modes: [
        new TerraDrawPolygonMode({
          styles: polygonStyles(accent),
          // Esc'yi biz yönetiyoruz (tüm akışı iptal eder); Enter ile bitirme açık kalır
          keyEvents: { cancel: null, finish: 'Enter' },
        }),
        new TerraDrawSelectMode({
          styles: selectStyles(accent),
          flags: {
            [POLYGON_MODE]: {
              feature: {
                draggable: true,
                coordinates: { midpoints: true, draggable: true, deletable: true },
              },
            },
          },
        }),
      ],
    })
    draw.start()
    drawRef.current = draw

    const refreshLiveArea = () => {
      const feature = findPolygon(draw)
      setCanUndo(draw.canUndo())
      if (!feature) return setLiveArea(null)
      // Çizim sırasında son nokta imleç konumudur; yine de anlık önizleme için yeterli
      const dekar = ringAreaM2(feature.geometry.coordinates[0]) / 1000
      setLiveArea(dekar > 0 ? dekar : null)
    }
    draw.on('change', refreshLiveArea)

    draw.on('finish', (id, context) => {
      if (useBahcemStore.getState().mode !== 'drawing' || context.action !== 'draw') return
      const feature = findPolygon(draw, id)
      if (!feature) return
      const coordinates = feature.geometry.coordinates as PolygonCoordinates
      draw.removeFeatures([id])
      openForm({ geometry: { type: 'Polygon', coordinates }, source: 'draw' })
    })

    return () => {
      drawRef.current = null
      try {
        draw.stop()
      } catch {
        // Harita zaten kaldırılmış olabilir
      }
      setLiveArea(null)
    }
  }, [map, styleVersion, openForm, setLiveArea])

  // Mevcut bahçenin sınırını düzenleme: poligonu terra-draw'a yükle ve seçili aç
  useEffect(() => {
    const draw = drawRef.current
    if (!map || mode !== 'editing-boundary' || !draw || !editingId) return
    const garden = gardens?.find((g) => g.id === editingId)
    if (!garden || garden.geometry.type !== 'Polygon') return
    if (draw.getSnapshot().some((f) => f.properties.mode === POLYGON_MODE)) return

    const results = draw.addFeatures([
      {
        type: 'Feature',
        geometry: garden.geometry,
        properties: { mode: POLYGON_MODE },
      },
    ])
    if (!results[0]?.valid) {
      toast.show('Bu bahçenin sınırı düzenleme aracına yüklenemedi.')
      resetFlow()
      return
    }
    const feature = findPolygon(draw)
    if (feature?.id !== undefined) {
      draw.setMode(SELECT_MODE)
      draw.selectFeature(feature.id)
    }
    // Üstteki araç çubuğunun altında kalmasın diye üst boşluk büyütülür
    map.fitBounds(geometryBounds(garden.geometry), {
      padding: { ...padding(), top: 230 },
      maxZoom: 19,
      duration: 800,
    })
  }, [map, mode, editingId, gardens, styleVersion, padding, resetFlow, toast])

  // Klavye: Esc iptal. Geri alma (Ctrl/Cmd+Z) terra-draw'ın kendi kısayoludur.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        cancel()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cancel])

  function startPolygon() {
    const draw = drawRef.current
    if (!draw || tooFar) return
    draw.setMode(POLYGON_MODE)
    setStarted(true)
  }

  function undo() {
    const draw = drawRef.current
    if (draw?.undo()) setCanUndo(draw.canUndo())
  }

  function saveBoundary() {
    const draw = drawRef.current
    const feature = draw ? findPolygon(draw) : undefined
    if (!feature || !editingId) return
    setSaveError(null)
    update.mutate(
      {
        id: editingId,
        patch: {
          geometry: { type: 'Polygon', coordinates: feature.geometry.coordinates as PolygonCoordinates },
        },
      },
      {
        onSuccess: (garden) => {
          toast.show(`“${garden.ad}” sınırı güncellendi.`)
          resetFlow()
        },
        onError: (err) => setSaveError(describeError(err)),
      },
    )
  }

  const editing = mode === 'editing-boundary'
  const garden = editing ? gardens?.find((g) => g.id === editingId) : undefined
  return (
    <div className={`${TOP_AREA_CLASS} pointer-events-none top-[3.75rem]`}>
      <div
        role="region"
        aria-label={editing ? 'Sınırı düzenle' : 'Bahçeyi çiz'}
        className="surface-dark pointer-events-auto w-full max-w-[480px] rounded-lg border border-app-border bg-app-panel p-4 shadow-e3"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-h2 text-app-text">
              {editing ? `Sınırı düzenle${garden ? `: ${garden.ad}` : ''}` : 'Bahçeyi haritada çizin'}
            </h2>
            <p className="mt-1 text-small text-app-text-muted">
              {editing
                ? 'Köşeleri sürükleyin, kenar ortasındaki noktalardan yeni köşe ekleyin. Köşeyi silmek için seçip Delete’e basın.'
                : started
                  ? 'Köşelere tıklayın. İlk noktaya tıklayarak, son noktaya çift tıklayarak veya Enter ile bitirin.'
                  : 'Bahçenizin üzerine yakınlaşın, “Çizime başla”ya basıp köşelere tıklayın.'}
            </p>
          </div>
          <div
            aria-live="polite"
            className="shrink-0 rounded-md bg-app-card px-3 py-1.5 text-right"
            title="Anlık, yaklaşık alan"
          >
            <span className="block text-caption uppercase tracking-wide text-app-text-dim">Alan</span>
            <span className="text-body font-semibold text-app-accent">
              {liveArea ? formatDecare(liveArea) : '—'}
            </span>
          </div>
        </div>

        {!editing && !started && tooFar && (
          <p
            role="alert"
            className="mt-3 flex items-center gap-2 rounded-md bg-app-warn/10 px-3 py-2 text-small text-app-warn"
          >
            <MousePointerClick className="h-4 w-4 shrink-0" aria-hidden />
            Bahçeyi çizmek için yakınlaşın (şu an yakınlaştırma {mapZoom.toFixed(1)}, en az {MIN_DRAW_ZOOM}{' '}
            gerekli).
          </p>
        )}

        {saveError && (
          <p role="alert" className="mt-3 rounded-md bg-app-danger/10 px-3 py-2 text-small text-app-danger">
            {saveError}
          </p>
        )}

        <div className="mt-3 flex items-center justify-between gap-2">
          <Button onClick={undo} disabled={!canUndo} title="Geri al (Ctrl/Cmd+Z)" icon={<Undo2 className="h-4 w-4" aria-hidden />}>
            Geri al
          </Button>

          <div className="flex items-center gap-2">
            <Button onClick={cancel} title="Vazgeç (Esc)" icon={<X className="h-4 w-4" aria-hidden />}>
              İptal
            </Button>

            {editing ? (
              <Button variant="primary" onClick={saveBoundary} loading={update.isPending} icon={<Check className="h-4 w-4" aria-hidden />}>
                Kaydet
              </Button>
            ) : (
              !started && (
                <Button variant="primary" onClick={startPolygon} disabled={tooFar} icon={<Play className="h-4 w-4" aria-hidden />}>
                  Çizime başla
                </Button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function DrawController() {
  const mode = useBahcemStore((s) => s.mode)
  const { styleVersion } = useMap()
  if (mode !== 'drawing' && mode !== 'editing-boundary') return null
  // Altlık değişince (stil yenilenir) oturum baştan kurulur
  return <DrawSession key={`${mode}-${styleVersion}`} />
}
