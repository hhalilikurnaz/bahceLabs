import type { SimulationPlan } from '../types'
import { apiRequest } from './apiClient'
import {
  mapPlanUpdateToApi,
  mapSimulationPlanFromApi,
} from './planningApi.mapper'
import type { PlanningApi } from './planningApi.types'

type ApiSimulationPlan = Parameters<typeof mapSimulationPlanFromApi>[0]

export const planningApiReal: PlanningApi = {
  async listPlans(): Promise<SimulationPlan[]> {
    const plans = await apiRequest<ApiSimulationPlan[]>('/planning/plans')
    return plans.map(mapSimulationPlanFromApi)
  },

  async getPlan(id: string): Promise<SimulationPlan> {
    const plan = await apiRequest<ApiSimulationPlan>(`/planning/plans/${id}`)
    return mapSimulationPlanFromApi(plan)
  },

  async createPlan(name: string, gardenId?: string | null): Promise<SimulationPlan> {
    const plan = await apiRequest<ApiSimulationPlan>('/planning/plans', {
      method: 'POST',
      body: JSON.stringify({
        name,
        ...(gardenId ? { garden_id: gardenId } : {}),
      }),
    })
    return mapSimulationPlanFromApi(plan)
  },

  async updatePlan(
    id: string,
    patch: Partial<SimulationPlan>,
  ): Promise<SimulationPlan> {
    const body = mapPlanUpdateToApi({
      ...patch,
      status: patch.status ?? 'saved',
    })

    const plan = await apiRequest<ApiSimulationPlan>(`/planning/plans/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
    return mapSimulationPlanFromApi(plan)
  },
}
