import type { SimulationPlan } from '../types'

export interface PlanningApi {
  listPlans(): Promise<SimulationPlan[]>
  getPlan(id: string): Promise<SimulationPlan>
  createPlan(name: string, gardenId?: string | null): Promise<SimulationPlan>
  updatePlan(id: string, patch: Partial<SimulationPlan>): Promise<SimulationPlan>
}
