import type {
  GrowthSimulation,
  MaintenancePlan,
  PlantingPlan,
  PlanningStepId,
  ProductSelection,
  SimulationPlan,
} from '../types'

type ApiSimulationPlan = {
  id: string
  name: string
  workspace_id: string
  garden_id: string | null
  status: SimulationPlan['status']
  current_step: PlanningStepId
  draft_land: {
    geometry: SimulationPlan['draftLand']['geometry']
    area_m2: number | null
    perimeter_m: number | null
    location_label: string | null
    validation_status: SimulationPlan['draftLand']['validationStatus']
    validation_message: string | null
  }
  product_selection: {
    product_id: string | null
    product_name: string | null
    variety_id: string | null
    variety_name: string | null
    rootstock_id: string | null
    rootstock_name: string | null
    image_url: string | null
    recommended_planting_period: string | null
    yield_start_period: string | null
  }
  planting_plan: ApiPlantingPlan | null
  maintenance_plan: ApiMaintenancePlan | null
  growth_simulation: ApiGrowthSimulation | null
  created_at: string
  updated_at: string
  is_dirty: boolean
}

type ApiPlantingPlan = {
  spacing: {
    row_spacing_m: number | null
    plant_spacing_m: number | null
  }
  orientation_degrees: number | null
  orientation_mode: 'auto' | 'manual'
  boundary_margin_m: number | null
  rows: Array<{
    id: string
    row_number: number
    points: Array<{
      id: string
      coordinates: [number, number]
      row_number: number
      point_index: number
    }>
  }>
  points: Array<{
    id: string
    coordinates: [number, number]
    row_number: number
    point_index: number
  }>
  summary: {
    total_area_ha: number | null
    usable_area_ha: number | null
    row_count: number | null
    planting_point_count: number | null
    spacing_label: string | null
    estimated_yield_label: string | null
    estimated_yield_availability: SimulationPlan['plantingPlan'] extends infer P
      ? P extends { summary: infer S }
        ? S extends { estimatedYieldAvailability: infer A }
          ? A
          : never
        : never
      : never
    first_harvest_month: number | null
    first_harvest_availability: SimulationPlan['plantingPlan'] extends infer P
      ? P extends { summary: infer S }
        ? S extends { firstHarvestAvailability: infer A }
          ? A
          : never
        : never
      : never
  }
}

type ApiMaintenancePlan = {
  irrigation: MaintenancePlan['irrigation']
  fertilization: MaintenancePlan['fertilization']
  pruning: MaintenancePlan['pruning']
}

type ApiGrowthSimulation = {
  current_month: number
  is_playing: boolean
  stages: Array<{
    id: string
    name: string
    relative_month: number
    description: string | null
  }>
  active_stage_id: string | null
  result_label: string | null
  result_availability: GrowthSimulation['resultAvailability']
}

function mapProductSelectionFromApi(
  selection: ApiSimulationPlan['product_selection'],
): ProductSelection {
  return {
    productId: selection.product_id,
    productName: selection.product_name,
    varietyId: selection.variety_id,
    varietyName: selection.variety_name,
    rootstockId: selection.rootstock_id,
    rootstockName: selection.rootstock_name,
    imageUrl: selection.image_url,
    recommendedPlantingPeriod: selection.recommended_planting_period,
    yieldStartPeriod: selection.yield_start_period,
  }
}

function mapProductSelectionToApi(selection: ProductSelection) {
  return {
    product_id: selection.productId,
    product_name: selection.productName,
    variety_id: selection.varietyId,
    variety_name: selection.varietyName,
    rootstock_id: selection.rootstockId,
    rootstock_name: selection.rootstockName,
    image_url: selection.imageUrl,
    recommended_planting_period: selection.recommendedPlantingPeriod,
    yield_start_period: selection.yieldStartPeriod,
  }
}

function mapPlantingPlanFromApi(plan: ApiPlantingPlan): PlantingPlan {
  return {
    spacing: {
      rowSpacingM: plan.spacing.row_spacing_m,
      plantSpacingM: plan.spacing.plant_spacing_m,
    },
    orientationDegrees: plan.orientation_degrees,
    orientationMode: plan.orientation_mode,
    boundaryMarginM: plan.boundary_margin_m,
    rows: plan.rows.map((row) => ({
      id: row.id,
      rowNumber: row.row_number,
      points: row.points.map((point) => ({
        id: point.id,
        coordinates: point.coordinates,
        rowNumber: point.row_number,
        pointIndex: point.point_index,
      })),
    })),
    points: plan.points.map((point) => ({
      id: point.id,
      coordinates: point.coordinates,
      rowNumber: point.row_number,
      pointIndex: point.point_index,
    })),
    summary: {
      totalAreaHa: plan.summary.total_area_ha,
      usableAreaHa: plan.summary.usable_area_ha,
      rowCount: plan.summary.row_count,
      plantingPointCount: plan.summary.planting_point_count,
      spacingLabel: plan.summary.spacing_label,
      estimatedYieldLabel: plan.summary.estimated_yield_label,
      estimatedYieldAvailability: plan.summary.estimated_yield_availability,
      firstHarvestMonth: plan.summary.first_harvest_month,
      firstHarvestAvailability: plan.summary.first_harvest_availability,
    },
  }
}

function mapPlantingPlanToApi(plan: PlantingPlan) {
  return {
    spacing: {
      row_spacing_m: plan.spacing.rowSpacingM,
      plant_spacing_m: plan.spacing.plantSpacingM,
    },
    orientation_degrees: plan.orientationDegrees,
    orientation_mode: plan.orientationMode,
    boundary_margin_m: plan.boundaryMarginM,
    rows: plan.rows.map((row) => ({
      id: row.id,
      row_number: row.rowNumber,
      points: row.points.map((point) => ({
        id: point.id,
        coordinates: point.coordinates,
        row_number: point.rowNumber,
        point_index: point.pointIndex,
      })),
    })),
    points: plan.points.map((point) => ({
      id: point.id,
      coordinates: point.coordinates,
      row_number: point.rowNumber,
      point_index: point.pointIndex,
    })),
    summary: {
      total_area_ha: plan.summary.totalAreaHa,
      usable_area_ha: plan.summary.usableAreaHa,
      row_count: plan.summary.rowCount,
      planting_point_count: plan.summary.plantingPointCount,
      spacing_label: plan.summary.spacingLabel,
      estimated_yield_label: plan.summary.estimatedYieldLabel,
      estimated_yield_availability: plan.summary.estimatedYieldAvailability,
      first_harvest_month: plan.summary.firstHarvestMonth,
      first_harvest_availability: plan.summary.firstHarvestAvailability,
    },
  }
}

function mapMaintenancePlanFromApi(plan: ApiMaintenancePlan): MaintenancePlan {
  return {
    irrigation: plan.irrigation,
    fertilization: plan.fertilization,
    pruning: plan.pruning,
  }
}

function mapMaintenancePlanToApi(plan: MaintenancePlan) {
  return {
    irrigation: plan.irrigation,
    fertilization: plan.fertilization,
    pruning: plan.pruning,
  }
}

function mapGrowthSimulationFromApi(
  simulation: ApiGrowthSimulation,
): GrowthSimulation {
  return {
    currentMonth: simulation.current_month,
    isPlaying: simulation.is_playing,
    stages: simulation.stages.map((stage) => ({
      id: stage.id,
      name: stage.name,
      relativeMonth: stage.relative_month,
      description: stage.description,
    })),
    activeStageId: simulation.active_stage_id,
    resultLabel: simulation.result_label,
    resultAvailability: simulation.result_availability,
  }
}

function mapGrowthSimulationToApi(simulation: GrowthSimulation) {
  return {
    current_month: simulation.currentMonth,
    is_playing: simulation.isPlaying,
    stages: simulation.stages.map((stage) => ({
      id: stage.id,
      name: stage.name,
      relative_month: stage.relativeMonth,
      description: stage.description,
    })),
    active_stage_id: simulation.activeStageId,
    result_label: simulation.resultLabel,
    result_availability: simulation.resultAvailability,
  }
}

export function mapSimulationPlanFromApi(plan: ApiSimulationPlan): SimulationPlan {
  return {
    id: plan.id,
    name: plan.name,
    workspaceId: plan.workspace_id,
    gardenId: plan.garden_id,
    status: plan.status,
    currentStep: plan.current_step,
    draftLand: {
      geometry: plan.draft_land.geometry,
      areaM2: plan.draft_land.area_m2,
      perimeterM: plan.draft_land.perimeter_m,
      locationLabel: plan.draft_land.location_label,
      validationStatus: plan.draft_land.validation_status,
      validationMessage: plan.draft_land.validation_message,
    },
    productSelection: mapProductSelectionFromApi(plan.product_selection),
    plantingPlan: plan.planting_plan
      ? mapPlantingPlanFromApi(plan.planting_plan)
      : null,
    maintenancePlan: plan.maintenance_plan
      ? mapMaintenancePlanFromApi(plan.maintenance_plan)
      : null,
    growthSimulation: plan.growth_simulation
      ? mapGrowthSimulationFromApi(plan.growth_simulation)
      : null,
    createdAt: plan.created_at,
    updatedAt: plan.updated_at,
    isDirty: plan.is_dirty,
  }
}

export function mapPlanUpdateToApi(patch: Partial<SimulationPlan>) {
  return {
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.currentStep !== undefined ? { current_step: patch.currentStep } : {}),
    ...(patch.gardenId !== undefined ? { garden_id: patch.gardenId } : {}),
    ...(patch.productSelection
      ? { product_selection: mapProductSelectionToApi(patch.productSelection) }
      : {}),
    ...(patch.plantingPlan
      ? { planting_plan: mapPlantingPlanToApi(patch.plantingPlan) }
      : {}),
    ...(patch.maintenancePlan
      ? { maintenance_plan: mapMaintenancePlanToApi(patch.maintenancePlan) }
      : {}),
    ...(patch.growthSimulation
      ? { growth_simulation: mapGrowthSimulationToApi(patch.growthSimulation) }
      : {}),
  }
}
