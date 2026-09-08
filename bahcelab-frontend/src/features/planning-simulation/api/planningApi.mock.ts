import type { SimulationPlan } from '../types'

function emptyPlan(id: string): SimulationPlan {
  const now = new Date().toISOString()
  return {
    id,
    name: 'Yeni Plan',
    workspaceId: null,
    gardenId: null,
    status: 'draft',
    currentStep: 'land',
    draftLand: {
      geometry: null,
      areaM2: null,
      perimeterM: null,
      locationLabel: null,
      validationStatus: 'not_set',
      validationMessage: null,
    },
    productSelection: {
      productId: null,
      productName: null,
      varietyId: null,
      varietyName: null,
      rootstockId: null,
      rootstockName: null,
      imageUrl: null,
      recommendedPlantingPeriod: null,
      yieldStartPeriod: null,
    },
    plantingPlan: null,
    maintenancePlan: null,
    growthSimulation: null,
    createdAt: now,
    updatedAt: now,
    isDirty: false,
  }
}

const plans = new Map<string, SimulationPlan>()

export const planningApiMock = {
  async listPlans(): Promise<SimulationPlan[]> {
    return Array.from(plans.values())
  },

  async getPlan(id: string): Promise<SimulationPlan> {
    const existing = plans.get(id)
    if (existing) return existing
    const plan = emptyPlan(id)
    plans.set(id, plan)
    return plan
  },

  async createPlan(name: string): Promise<SimulationPlan> {
    const id = crypto.randomUUID()
    const plan = { ...emptyPlan(id), name }
    plans.set(id, plan)
    return plan
  },

  async updatePlan(
    id: string,
    patch: Partial<SimulationPlan>,
  ): Promise<SimulationPlan> {
    const current = await this.getPlan(id)
    const updated: SimulationPlan = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
      isDirty: false,
      status: patch.status ?? 'saved',
    }
    plans.set(id, updated)
    return updated
  },
}

export type PlanningApi = typeof planningApiMock
