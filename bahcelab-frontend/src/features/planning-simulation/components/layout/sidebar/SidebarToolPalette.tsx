import { PLANNING_TOOLS } from '../../../constants/toolIcons'
import type { PlanningToolId } from '../../../types'

interface SidebarToolPaletteProps {
  activeTool: PlanningToolId
  onToolChange: (tool: PlanningToolId) => void
}

export function SidebarToolPalette({
  activeTool,
  onToolChange,
}: SidebarToolPaletteProps) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col justify-between gap-1">
      {PLANNING_TOOLS.map((tool) => {
        const Icon = tool.icon
        const isActive = activeTool === tool.id

        return (
          <button
            key={tool.id}
            type="button"
            onClick={() => onToolChange(tool.id)}
            className={`flex flex-1 w-full items-center gap-2.5 rounded-lg px-2.5 text-left transition-colors ${
              isActive
                ? 'border border-planning-accent/60 bg-planning-accent/10 text-planning-accent'
                : 'border border-transparent text-planning-text-muted hover:bg-planning-surface hover:text-planning-text'
            }`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
            <span className="text-[10px] font-medium leading-tight">
              {tool.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
