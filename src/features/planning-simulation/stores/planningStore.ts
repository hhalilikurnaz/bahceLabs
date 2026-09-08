import { create } from 'zustand'
import type {
  PlantingSubStepId,
  PlanningStepId,
  PlanningToolId,
  SimulationPlan,
  VisualizationMode,
} from '../types'

interface PlanningState {
  plan: SimulationPlan | null
  currentStep: PlanningStepId
  activePlantingSubStep: PlantingSubStepId
  activeTool: PlanningToolId
  visualizationMode: VisualizationMode
  setPlan: (plan: SimulationPlan) => void
  setCurrentStep: (step: PlanningStepId) => void
  setActivePlantingSubStep: (subStep: PlantingSubStepId) => void
  setActiveTool: (tool: PlanningToolId) => void
  setVisualizationMode: (mode: VisualizationMode) => void
  markDirty: () => void
}

export const usePlanningStore = create<PlanningState>((set) => ({
  plan: null,
  currentStep: 'planting',
  activePlantingSubStep: 'spacing',
  activeTool: 'select',
  visualizationMode: '3d',
  setPlan: (plan) => set({ plan }),
  setCurrentStep: (step) => set({ currentStep: step }),
  setActivePlantingSubStep: (subStep) => set({ activePlantingSubStep: subStep }),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setVisualizationMode: (mode) => set({ visualizationMode: mode }),
  markDirty: () =>
    set((state) =>
      state.plan ? { plan: { ...state.plan, isDirty: true } } : state,
    ),
}))
