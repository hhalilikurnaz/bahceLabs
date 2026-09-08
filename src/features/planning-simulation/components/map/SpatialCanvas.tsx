import { MapCompass } from './MapCompass'
import { MapControls } from './MapControls'
import { PlantingMapOverlay } from './PlantingMapOverlay'
import type { PlantingPlan, VisualizationMode } from '../../types'
import { EmptyState } from '../shared/DataField'

interface SpatialCanvasProps {
  mode: VisualizationMode
  onModeChange: (mode: VisualizationMode) => void
  hasGeometry: boolean
  plantingPlan: PlantingPlan | null
  mapOverlay?: {
    boundaryWidthM: number | null
    boundaryHeightM: number | null
  }
}

export function SpatialCanvas({
  mode,
  onModeChange,
  hasGeometry,
  plantingPlan,
  mapOverlay,
}: SpatialCanvasProps) {
  return (
    <div className="relative h-full min-h-[320px] overflow-hidden rounded-[inherit] bg-[#0a120a]">
      {hasGeometry ? (
        <>
          {/* Aerial terrain placeholder — MapLibre / gerçek imagery B8'de */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse at 55% 45%, #2d4a2a 0%, #1a2e18 35%, #0f1a0e 70%, #080d08 100%)',
            }}
          />
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                'radial-gradient(circle at 20% 80%, #1a3d1a 0%, transparent 50%), radial-gradient(circle at 80% 20%, #243824 0%, transparent 40%)',
            }}
          />

          <MapControls mode={mode} onModeChange={onModeChange} />
          <MapCompass />

          <PlantingMapOverlay
            spacingLabel={plantingPlan?.summary.spacingLabel ?? null}
            boundaryWidthM={mapOverlay?.boundaryWidthM ?? null}
            boundaryHeightM={mapOverlay?.boundaryHeightM ?? null}
          />
        </>
      ) : (
        <div className="flex h-full items-center justify-center p-8">
          <EmptyState
            title="Arazi tanımlanmadı"
            description="Haritada polygon çizerek veya mevcut bahçe seçerek başlayın."
          />
        </div>
      )}
    </div>
  )
}
