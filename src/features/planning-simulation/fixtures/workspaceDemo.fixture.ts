import lemonMeyerImage from '@/assets/products/lemon-meyer.jpg'
import type { SimulationPlan } from '../types'

export interface WorkspaceMapOverlay {
  boundaryWidthM: number | null
  boundaryHeightM: number | null
}

/**
 * UI görsel QA fixture — production component'lerinde kullanılmaz.
 * Referans ekranla karşılaştırma için workspace preview state.
 */
export function applyWorkspaceDemoFixture(plan: SimulationPlan): SimulationPlan {
  return {
    ...plan,
    name: plan.name === 'Yeni Plan' ? 'Limon Bahçem' : plan.name,
    currentStep: 'planting',
    productSelection: {
      productId: 'lemon',
      productName: 'Limon',
      varietyId: 'meyer',
      varietyName: 'Meyer',
      rootstockId: 'carrizo',
      rootstockName: 'Carrizo',
      imageUrl: lemonMeyerImage,
      recommendedPlantingPeriod: 'Şubat - Mart',
      yieldStartPeriod: '18 - 24 Ay',
    },
    draftLand: {
      ...plan.draftLand,
      geometry: {
        type: 'Polygon',
        coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
      },
      areaM2: plan.draftLand.areaM2 ?? 23_500,
      validationStatus: 'valid',
    },
    plantingPlan: {
      spacing: { rowSpacingM: 6, plantSpacingM: 6 },
      orientationDegrees: null,
      orientationMode: 'auto',
      boundaryMarginM: 0.5,
      rows: [],
      points: [],
      summary: {
        totalAreaHa: 2.35,
        usableAreaHa: 2.2,
        rowCount: 23,
        plantingPointCount: 652,
        spacingLabel: '6.0 m x 6.0 m',
        estimatedYieldLabel: '8.2 ton',
        estimatedYieldAvailability: 'available',
        firstHarvestMonth: 24,
        firstHarvestAvailability: 'available',
      },
    },
    maintenancePlan: {
      irrigation: {
        method: 'Damla Sulama',
        frequency: '3 günde 1',
        availability: 'available',
      },
      fertilization: {
        schedule: 'Yılda 4 kez',
        availability: 'available',
      },
      pruning: {
        schedule: 'Yılda 1 kez',
        availability: 'available',
      },
    },
  }
}

export const WORKSPACE_DEMO_COMPLETED_STEPS = ['land', 'product'] as const

/** Fixture-only map overlay ölçüleri — component'lerde hard-code yok */
export const WORKSPACE_DEMO_MAP_OVERLAY: WorkspaceMapOverlay = {
  boundaryWidthM: 125,
  boundaryHeightM: 188,
}
