import { create } from 'zustand'
import type {
  PlanningStepId,
  PlanningToolId,
  SimulationPlan,
  VisualizationMode,
} from '../types'

interface PlanningState {
  plan: SimulationPlan | null
  currentStep: PlanningStepId
  activeTool: PlanningToolId
  visualizationMode: VisualizationMode
  setPlan: (plan: SimulationPlan) => void
  setCurrentStep: (step: PlanningStepId) => void
  setActiveTool: (tool: PlanningToolId) => void
  setVisualizationMode: (mode: VisualizationMode) => void
  markDirty: () => void
}

export const usePlanningStore = create<PlanningState>((set) => ({
  plan: null,
  currentStep: 'planting',
  activeTool: 'select',
  visualizationMode: '3d',
  setPlan: (plan) => set({ plan }),
  setCurrentStep: (step) => set({ currentStep: step }),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setVisualizationMode: (mode) => set({ visualizationMode: mode }),
  markDirty: () =>
    set((state) =>
      state.plan ? { plan: { ...state.plan, isDirty: true } } : state,
    ),
}))
