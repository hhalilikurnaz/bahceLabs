import { PLANNING_TOOLS } from '../../constants/planningSteps'
import type { PlanningStepId, PlanningToolId } from '../../types'

interface PlanningSidebarProps {
  currentStep: PlanningStepId
  completedSteps: PlanningStepId[]
  activeTool: PlanningToolId
  onToolChange: (tool: PlanningToolId) => void
  onSave: () => void
}

const SIDEBAR_STEPS = [
  { id: 'land' as const, label: 'Arazi Tanımı', sub: null },
  { id: 'product' as const, label: 'Ürün Seçimi', sub: null },
  {
    id: 'planting' as const,
    label: 'Dikim Planı',
    sub: ['Dikim Mesafesi', 'Sulama Planı', 'Besleme Planı'],
  },
  { id: 'maintenance' as const, label: 'Bakım Planı', sub: null },
  { id: 'simulation' as const, label: 'Simülasyon', sub: null },
]

export function PlanningSidebar({
  currentStep,
  completedSteps,
  activeTool,
  onToolChange,
  onSave,
}: PlanningSidebarProps) {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-planning-border bg-planning-panel">
      <div className="p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-planning-text-dim">
          Planlama Adımları
        </p>
        <ul className="mt-3 space-y-1">
          {SIDEBAR_STEPS.map((step, index) => {
            const isActive = step.id === currentStep
            const isCompleted = completedSteps.includes(step.id)

            return (
              <li key={step.id}>
                <div
                  className={`rounded-lg px-3 py-2 text-sm ${
                    isActive
                      ? 'bg-planning-accent/10 text-planning-accent'
                      : 'text-planning-text-muted'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs">
                      {isCompleted ? '✓' : index + 1}
                    </span>
                    <span className="font-medium">{step.label}</span>
                  </div>
                  {isActive && step.sub && (
                    <ul className="mt-2 space-y-1 border-l border-planning-border pl-4">
                      {step.sub.map((item, subIndex) => (
                        <li
                          key={item}
                          className={`text-xs ${
                            subIndex === 0
                              ? 'text-planning-accent'
                              : 'text-planning-text-dim'
                          }`}
                        >
                          {item}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="mt-auto border-t border-planning-border p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-planning-text-dim">
          Araçlar
        </p>
        <div className="mt-3 flex flex-col gap-1">
          {PLANNING_TOOLS.map((tool) => (
            <button
              key={tool.id}
              type="button"
              onClick={() => onToolChange(tool.id)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors ${
                activeTool === tool.id
                  ? 'bg-planning-accent/15 text-planning-accent'
                  : 'text-planning-text-muted hover:bg-planning-surface'
              }`}
            >
              <span>{tool.icon}</span>
              <span>{tool.label}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onSave}
          className="mt-4 w-full rounded-lg bg-planning-accent px-4 py-2.5 text-xs font-semibold text-planning-bg"
        >
          Planı Kaydet
        </button>
      </div>
    </aside>
  )
}
