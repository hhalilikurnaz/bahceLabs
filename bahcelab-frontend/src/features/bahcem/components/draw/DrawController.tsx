import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, Segmented } from '@/components/ui'
import { Check, MousePointerClick, Play, Redo2, Undo2, X } from 'lucide-react'
import {
  TerraDraw,
  TerraDrawCircleMode,
  TerraDrawModeUndoRedo,
  TerraDrawPolygonMode,
  TerraDrawSelectMode,
  TerraDrawUndoRedoKeyboardShortcuts,
  type GeoJSONStoreFeatures,
  type HexColor,
} from 'terra-draw'
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter'
import { useQueryClient } from '@tanstack/react-query'
import { describeError } from '../../api/gardensApi'
import { indeksKey, type IndexData } from '../../api/indeksApi'
import type { PolygonCoordinates } from '../../api/types'
import { useGardens, useUpdateGarden } from '../../api/useGardens'
import { DRAW } from '../../lib/config'
import { formatDecare, geometryBounds, polygonsOf, ringAreaM2 } from '../../lib/geo'
import { finishDrawing } from '../../lib/drawAdapter'
import { circleStats, decimateRing, formatLength, nearestVertex, type LngLat } from '../../lib/measure'
import { cssColor } from '../../map/cssColor'
import { useFocusPadding } from '../../map/useFocusGarden'
import { useMap } from '../../map/useMap'
import { useBahcemStore, type DrawShape } from '../../stores/bahcemStore'
import { useToast } from '../layout/toastContext'
import { TOP_AREA_CLASS } from '../layout/topArea'
import { EdgeLabels } from './EdgeLabels'

/** Bu yakınlaştırma düzeyinin altında çizim başlatılamaz. */
export const MIN_DRAW_ZOOM = DRAW.minZoom

const POLYGON_MODE = 'polygon'
const CIRCLE_MODE = 'circle'
const SELECT_MODE = 'select'

const asHex = (value: string): HexColor => value as HexColor
const isCoarsePointer = () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

/** Dokunmatik ekranda tutamaçlar büyük (kolay yakalansın). */
const handle = () => (isCoarsePointer() ? DRAW.handleCoarsePx : DRAW.handlePx)

function polygonStyles(accent: HexColor) {
  return {
    fillColor: accent,
    fillOpacity: 0.25,
    outlineColor: accent,
    outlineWidth: 3,
    closingPointColor: '#ffffff' as HexColor,
    closingPointWidth: handle(),
    closingPointOutlineColor: accent,
    closingPointOutlineWidth: 3,
  }
}

function selectStyles(accent: HexColor) {
  const size = handle()
  return {
    selectedPolygonColor: accent,
    selectedPolygonFillOpacity: 0.25,
    selectedPolygonOutlineColor: accent,
    selectedPolygonOutlineWidth: 3,
    selectionPointColor: '#ffffff' as HexColor,
    selectionPointWidth: size,
    selectionPointOutlineColor: accent,
    selectionPointOutlineWidth: 3,
    midPointColor: accent,
    midPointOutlineColor: '#ffffff' as HexColor,
    midPointWidth: Math.round(size * 0.7),
    midPointOutlineWidth: 2,
  }
}

type PolygonFeature = GeoJSONStoreFeatures & { geometry: { type: 'Polygon'; coordinates: number[][][] } }

/** Anlık görüntüden çizilen/düzenlenen bahçe poligonunu (poligon ya da daire; yardımcı noktalar hariç) bulur. */
function findPolygon(draw: TerraDraw, id?: string | number): PolygonFeature | undefined {
  return draw
    .getSnapshot()
    .find(
      (f) =>
        f.geometry.type === 'Polygon' &&
        (f.properties.mode === POLYGON_MODE || f.properties.mode === CIRCLE_MODE) &&
        (id === undefined || f.id === id),
    ) as PolygonFeature | undefined
}

type Phase = 'idle' | 'drawing' | 'adjust'

/** Çizim/düzenleme oturumu: açılırken state sıfır, kapanırken terra-draw tamamen kaldırılır. */
function DrawSession() {
  const { map, styleVersion } = useMap()
  const mode = useBahcemStore((s) => s.mode)
  const editingId = useBahcemStore((s) => s.editingGardenId)
  const mapZoom = useBahcemStore((s) => s.mapZoom)
  const liveArea = useBahcemStore((s) => s.liveAreaDekar)
  const shape = useBahcemStore((s) => s.drawShape)
  const setShape = useBahcemStore((s) => s.setDrawShape)
  const setLiveArea = useBahcemStore((s) => s.setLiveArea)
  const setLiveGeometry = useBahcemStore((s) => s.setLiveGeometry)
  const openForm = useBahcemStore((s) => s.openForm)
  const resetFlow = useBahcemStore((s) => s.resetFlow)
  const watchProcessing = useBahcemStore((s) => s.watchProcessing)
  const client = useQueryClient()
  const { data: gardens } = useGardens()
  const update = useUpdateGarden()
  const toast = useToast()
  const padding = useFocusPadding()

  const drawRef = useRef<TerraDraw | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [ring, setRing] = useState<LngLat[] | null>(null)
  const [radiusM, setRadiusM] = useState<number | null>(null)

  const tooFar = mapZoom < DRAW.minZoom
  const editing = mode === 'editing-boundary'

  // Yapışma hedefleri: düzenlenen bahçe dışındaki bahçelerin köşeleri
  const otherVertices = useMemo<LngLat[]>(
    () =>
      (gardens ?? [])
        .filter((g) => g.id !== editingId)
        .flatMap((g) => polygonsOf(g.geometry).flatMap((rings) => rings.flatMap((r) => r.map((p) => [p[0], p[1]] as LngLat)))),
    [gardens, editingId],
  )
  const verticesRef = useRef(otherVertices)
  useEffect(() => {
    verticesRef.current = otherVertices
  }, [otherVertices])

  const cancel = useCallback(() => resetFlow(), [resetFlow])

  // terra-draw örneği: çizim/düzenleme süresince yaşar, bitince tüm katmanlarıyla kaldırılır
  useEffect(() => {
    if (!map || styleVersion === 0) return

    const accent = asHex(cssColor('--color-app-accent'))
    const draw = new TerraDraw({
      adapter: new TerraDrawMapLibreGLAdapter({ map }),
      undoRedo: { modeLevel: new TerraDrawModeUndoRedo(), keyboardShortcuts: new TerraDrawUndoRedoKeyboardShortcuts() },
      modes: [
        new TerraDrawPolygonMode({
          styles: polygonStyles(accent),
          // Köşe ve çizgiye yapışma + diğer bahçelerin köşelerine yapışma
          snapping: {
            toCoordinate: true,
            toLine: true,
            toCustom: (event) =>
              nearestVertex(
                { x: event.containerX, y: event.containerY },
                verticesRef.current,
                (v) => map.project(v as [number, number]),
                DRAW.snapPx,
              ) as [number, number] | undefined,
          },
          // Esc'yi biz yönetiyoruz (tüm akışı iptal eder); Enter ile bitirme açık kalır
          keyEvents: { cancel: null, finish: 'Enter' },
        }),
        new TerraDrawCircleMode({ styles: polygonStyles(accent), keyEvents: { cancel: null, finish: 'Enter' } }),
        new TerraDrawSelectMode({
          styles: selectStyles(accent),
          flags: {
            [POLYGON_MODE]: {
              feature: { draggable: true, coordinates: { midpoints: true, draggable: true, deletable: true } },
            },
          },
        }),
      ],
    })
    draw.start()
    drawRef.current = draw

    const refresh = () => {
      const feature = findPolygon(draw)
      setCanUndo(draw.canUndo())
      setCanRedo(draw.canRedo())
      if (!feature) {
        setLiveArea(null)
        setLiveGeometry(null)
        setRing(null)
        return
      }
      const coords = feature.geometry.coordinates[0] as unknown as LngLat[]
      const dekar = ringAreaM2(coords) / 1000
      setLiveArea(dekar > 0 ? dekar : null)
      setLiveGeometry({ type: 'Polygon', coordinates: feature.geometry.coordinates as PolygonCoordinates })
      setRing(coords)
      setRadiusM(feature.properties.mode === CIRCLE_MODE ? circleStats(coords).radiusM : null)
    }
    draw.on('change', refresh)
    // Geri al/yinele geçmişi 'change' olayından sonra güncellenebilir: etkileşim bitince düğme durumları yeniden okunur
    const syncButtons = () =>
      window.setTimeout(() => {
        setCanUndo(draw.canUndo())
        setCanRedo(draw.canRedo())
      }, 0)
    window.addEventListener('pointerup', syncButtons)
    window.addEventListener('keyup', syncButtons)

    draw.on('finish', (id, context) => {
      if (useBahcemStore.getState().mode !== 'drawing' || context.action !== 'draw') return
      const feature = findPolygon(draw, id)
      if (!feature) return
      let coordinates = feature.geometry.coordinates as PolygonCoordinates
      if (feature.properties.mode === CIRCLE_MODE) {
        // Daire, köşeleri taşınabilen seyrek bir çokgene çevrilir
        coordinates = [decimateRing(coordinates[0] as unknown as LngLat[], DRAW.circleMaxVertices).map((p): [number, number] => [p[0], p[1]])]
      }
      draw.removeFeatures([id])
      const added = draw.addFeatures([{ type: 'Feature', geometry: { type: 'Polygon', coordinates }, properties: { mode: POLYGON_MODE } }])
      const newId = findPolygon(draw)?.id
      if (added[0]?.valid && newId !== undefined) {
        draw.setMode(SELECT_MODE) // düzenleme: köşe ekle/sil/taşı
        draw.selectFeature(newId)
        setPhase('adjust')
      }
    })

    return () => {
      window.removeEventListener('pointerup', syncButtons)
      window.removeEventListener('keyup', syncButtons)
      drawRef.current = null
      try {
        draw.stop()
      } catch {
        // Harita zaten kaldırılmış olabilir
      }
      setLiveArea(null)
      setLiveGeometry(null)
    }
  }, [map, styleVersion, setLiveArea, setLiveGeometry])

  // Mevcut bahçenin sınırını düzenleme: poligonu terra-draw'a yükle ve seçili aç
  useEffect(() => {
    const draw = drawRef.current
    if (!map || mode !== 'editing-boundary' || !draw || !editingId) return
    const garden = gardens?.find((g) => g.id === editingId)
    if (!garden || garden.geometry.type !== 'Polygon') return
    if (findPolygon(draw)) return

    const results = draw.addFeatures([{ type: 'Feature', geometry: garden.geometry, properties: { mode: POLYGON_MODE } }])
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
    map.fitBounds(geometryBounds(garden.geometry), { padding: { ...padding(), top: 230 }, maxZoom: 19, duration: 800 })
  }, [map, mode, editingId, gardens, styleVersion, padding, resetFlow, toast])

  // Klavye: Esc iptal. Geri alma/yineleme (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z) terra-draw'ın kendi kısayoludur.
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

  function start() {
    const draw = drawRef.current
    if (!draw || tooFar) return
    draw.setMode(shape === 'circle' ? CIRCLE_MODE : POLYGON_MODE)
    setPhase('drawing')
  }

  /** Çizimi bitir (terra-draw sürümüne bağımlı kısım `lib/drawAdapter.ts` içindedir). */
  function finishCurrentDrawing() {
    finishDrawing(map?.getCanvas())
  }

  function undo() {
    if (drawRef.current?.undo()) refreshButtons()
  }
  function redo() {
    if (drawRef.current?.redo()) refreshButtons()
  }
  function refreshButtons() {
    const draw = drawRef.current
    if (!draw) return
    setCanUndo(draw.canUndo())
    setCanRedo(draw.canRedo())
  }

  /** Çizim tamam: sınır forma aktarılır (Kaydet sağ paneldedir). */
  function confirmBoundary() {
    const draw = drawRef.current
    const feature = draw ? findPolygon(draw) : undefined
    if (!draw || !feature) return
    const coordinates = feature.geometry.coordinates as PolygonCoordinates
    draw.clear()
    openForm({ geometry: { type: 'Polygon', coordinates }, source: 'draw' })
  }

  function saveBoundary() {
    const draw = drawRef.current
    const feature = draw ? findPolygon(draw) : undefined
    if (!feature || !editingId) return
    setSaveError(null)
    update.mutate(
      { id: editingId, patch: { geometry: { type: 'Polygon', coordinates: feature.geometry.coordinates as PolygonCoordinates } } },
      {
        onSuccess: (garden) => {
          toast.show(`“${garden.ad}” sınırı güncellendi; uydu görüntüleri yeniden işleniyor.`)
          watchProcessing(garden.id, garden.ad, client.getQueryData<IndexData>(indeksKey(garden.id))?.isleme?.id ?? null)
          resetFlow()
        },
        onError: (err) => {
          setConfirming(false)
          setSaveError(describeError(err))
        },
      },
    )
  }

  const garden = editing ? gardens?.find((g) => g.id === editingId) : undefined
  const title = editing ? `Sınırı düzenle${garden ? `: ${garden.ad}` : ''}` : phase === 'adjust' ? 'Sınırı ayarlayın' : 'Bahçeyi haritada çizin'
  const help = editing
    ? 'Köşeleri sürükleyin, kenar ortasındaki noktalardan yeni köşe ekleyin. Köşeyi silmek için seçip Delete’e basın.'
    : phase === 'adjust'
      ? 'Köşeleri sürükleyin, kenar ortalarından köşe ekleyin, köşeyi silmek için seçip Delete’e basın. Bitince “Sınır tamam”a basın.'
      : phase === 'drawing'
        ? shape === 'circle'
          ? 'Merkeze tıklayın, fareyi/parmağı açarak yarıçapı belirleyip tekrar tıklayın.'
          : 'Köşelere tıklayın. İlk noktaya tıklayarak, son noktaya çift tıklayarak veya Enter ile bitirin. Başka bahçelerin köşelerine yapışır.'
        : 'Bahçenizin üzerine yakınlaşın, şekli seçip “Çizime başla”ya basın.'

  return (
    <>
      <EdgeLabels ring={ring} />
      <div className={`${TOP_AREA_CLASS} pointer-events-none top-[3.75rem]`}>
        <div
          role="region"
          aria-label={editing ? 'Sınırı düzenle' : 'Bahçeyi çiz'}
          className="surface-dark pointer-events-auto w-full max-w-[520px] rounded-lg border border-app-border bg-app-panel p-3 shadow-e3 sm:p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-display text-h2 text-app-text">{title}</h2>
              <p className="mt-1 text-small text-app-text-muted">{help}</p>
            </div>
            <div aria-live="polite" className="shrink-0 rounded-md bg-app-card px-3 py-1.5 text-right" title="Anlık, yaklaşık alan" data-testid="live-area">
              <span className="block text-caption uppercase tracking-wide text-app-text-dim">Alan</span>
              <span className="text-body font-semibold text-app-accent">{liveArea ? formatDecare(liveArea) : '—'}</span>
              {radiusM !== null && <span className="block text-caption text-app-text-muted">yarıçap {formatLength(radiusM)}</span>}
            </div>
          </div>

          {!editing && phase === 'idle' && (
            <div className="mt-3">
              <Segmented
                label="Çizim şekli"
                value={shape}
                onChange={(value: DrawShape) => setShape(value)}
                options={[
                  { value: 'polygon', label: 'Çokgen' },
                  { value: 'circle', label: 'Daire' },
                ]}
                className="w-full"
              />
            </div>
          )}

          {!editing && phase === 'idle' && tooFar && (
            <p role="alert" className="mt-3 flex items-center gap-2 rounded-md bg-app-warn/10 px-3 py-2 text-small text-app-warn">
              <MousePointerClick className="h-4 w-4 shrink-0" aria-hidden />
              Bahçeyi çizmek için yakınlaşın (şu an yakınlaştırma {mapZoom.toFixed(1)}, en az {DRAW.minZoom} gerekli).
            </p>
          )}

          {confirming && (
            <p role="alert" className="mt-3 rounded-md bg-app-warn/10 px-3 py-2 text-small text-app-warn" data-testid="reprocess-warning">
              Sınır değişirse bu bahçenin eski uydu görüntüleri ve bölgeleri silinip yeniden işlenir; bu birkaç dakika sürebilir. Devam edilsin mi?
            </p>
          )}

          {saveError && (
            <p role="alert" className="mt-3 rounded-md bg-app-danger/10 px-3 py-2 text-small text-app-danger">
              {saveError}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button onClick={undo} disabled={!canUndo} title="Geri al (Ctrl/Cmd+Z)" icon={<Undo2 className="h-4 w-4" aria-hidden />}>
                Geri al
              </Button>
              <Button onClick={redo} disabled={!canRedo} title="Yinele (Ctrl/Cmd+Shift+Z)" icon={<Redo2 className="h-4 w-4" aria-hidden />}>
                Yinele
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={confirming ? () => setConfirming(false) : cancel} title="Vazgeç (Esc)" icon={<X className="h-4 w-4" aria-hidden />}>
                {confirming ? 'Geri dön' : 'İptal'}
              </Button>

              {editing ? (
                <Button
                  variant="primary"
                  onClick={confirming ? saveBoundary : () => setConfirming(true)}
                  loading={update.isPending}
                  icon={<Check className="h-4 w-4" aria-hidden />}
                >
                  {confirming ? 'Kaydet ve yeniden işle' : 'Kaydet'}
                </Button>
              ) : phase === 'adjust' ? (
                <Button variant="primary" onClick={confirmBoundary} icon={<Check className="h-4 w-4" aria-hidden />}>
                  Sınır tamam
                </Button>
              ) : phase === 'drawing' ? (
                <Button variant="primary" onClick={finishCurrentDrawing} disabled={!liveArea} icon={<Check className="h-4 w-4" aria-hidden />}>
                  Çizimi bitir
                </Button>
              ) : (
                phase === 'idle' && (
                  <Button variant="primary" onClick={start} disabled={tooFar} icon={<Play className="h-4 w-4" aria-hidden />}>
                    Çizime başla
                  </Button>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export function DrawController() {
  const mode = useBahcemStore((s) => s.mode)
  const { styleVersion } = useMap()
  if (mode !== 'drawing' && mode !== 'editing-boundary') return null
  // Altlık değişince (stil yenilenir) oturum baştan kurulur
  return <DrawSession key={`${mode}-${styleVersion}`} />
}
