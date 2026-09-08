/**
 * Phase 1 B — Planning & Simulation domain types.
 * Bu tipler backend contract ile uyumlu tutulmalıdır.
 */

export type DataAvailability =
  | 'available'
  | 'no_data'
  | 'not_configured'
  | 'unavailable'

export type SimulationPlanStatus = 'draft' | 'saved' | 'applied'

export type PlanningStepId =
  | 'land'
  | 'product'
  | 'planting'
  | 'maintenance'
  | 'simulation'

export type VisualizationMode = '2d' | '3d'

export type PlanningToolId =
  | 'select'
  | 'add-point'
  | 'draw-irrigation'
  | 'define-region'
  | 'delete-edit'

export interface GeoJsonPolygon {
  type: 'Polygon'
  coordinates: number[][][]
}

export interface PlanningLand {
  geometry: GeoJsonPolygon | null
  areaM2: number | null
  perimeterM: number | null
  locationLabel: string | null
  validationStatus: 'valid' | 'invalid' | 'pending' | 'not_set'
  validationMessage: string | null
}

export interface ProductSelection {
  productId: string | null
  productName: string | null
  varietyId: string | null
  varietyName: string | null
  rootstockId: string | null
  rootstockName: string | null
  imageUrl: string | null
  recommendedPlantingPeriod: string | null
  yieldStartPeriod: string | null
}

export interface PlantingSpacing {
  rowSpacingM: number | null
  plantSpacingM: number | null
}

export interface PlantingPoint {
  id: string
  coordinates: [number, number]
  rowNumber: number
  pointIndex: number
}

export interface PlantingRow {
  id: string
  rowNumber: number
  points: PlantingPoint[]
}

export interface PlantingSummary {
  totalAreaHa: number | null
  usableAreaHa: number | null
  rowCount: number | null
  plantingPointCount: number | null
  spacingLabel: string | null
  estimatedYieldLabel: string | null
  estimatedYieldAvailability: DataAvailability
  firstHarvestMonth: number | null
  firstHarvestAvailability: DataAvailability
}

export interface PlantingPlan {
  spacing: PlantingSpacing
  orientationDegrees: number | null
  orientationMode: 'auto' | 'manual'
  boundaryMarginM: number | null
  rows: PlantingRow[]
  points: PlantingPoint[]
  summary: PlantingSummary
}

export interface MaintenancePlan {
  irrigation: {
    method: string | null
    frequency: string | null
    availability: DataAvailability
  }
  fertilization: {
    schedule: string | null
    availability: DataAvailability
  }
  pruning: {
    schedule: string | null
    availability: DataAvailability
  }
}

export interface GrowthStage {
  id: string
  name: string
  relativeMonth: number
  description: string | null
}

export interface GrowthSimulation {
  currentMonth: number
  isPlaying: boolean
  stages: GrowthStage[]
  activeStageId: string | null
  resultLabel: string | null
  resultAvailability: DataAvailability
}

export interface SimulationPlan {
  id: string
  name: string
  workspaceId: string | null
  gardenId: string | null
  status: SimulationPlanStatus
  currentStep: PlanningStepId
  draftLand: PlanningLand
  productSelection: ProductSelection
  plantingPlan: PlantingPlan | null
  maintenancePlan: MaintenancePlan | null
  growthSimulation: GrowthSimulation | null
  createdAt: string
  updatedAt: string
  isDirty: boolean
}

export interface MetricValue<T = string | number> {
  value: T | null
  label: string
  availability: DataAvailability
  unit?: string
}
