import { create } from 'zustand'

interface BahcemState {
  leftPanelOpen: boolean
  copilotOpen: boolean
  season: number
  toggleLeftPanel: () => void
  setLeftPanelOpen: (open: boolean) => void
  setCopilotOpen: (open: boolean) => void
  setSeason: (season: number) => void
}

const isDesktop = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches

export const useBahcemStore = create<BahcemState>((set) => ({
  // Dar ekranda panel kapalı başlar; harita görünür kalır
  leftPanelOpen: isDesktop(),
  copilotOpen: false,
  season: new Date().getFullYear(),
  toggleLeftPanel: () => set((s) => ({ leftPanelOpen: !s.leftPanelOpen })),
  setLeftPanelOpen: (open) => set({ leftPanelOpen: open }),
  setCopilotOpen: (open) => set({ copilotOpen: open }),
  setSeason: (season) => set({ season }),
}))
