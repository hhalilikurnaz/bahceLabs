import { ChevronRight, MapPinned, Sprout } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface PlanningStartSectionProps {
  onSelectDraftLand: () => void
  onSelectExistingGarden: () => void
  disabled?: boolean
}

interface StartOptionProps {
  icon: LucideIcon
  title: string
  description: string
  onClick: () => void
  disabled?: boolean
}

function StartOption({
  icon: Icon,
  title,
  description,
  onClick,
  disabled,
}: StartOptionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group flex h-full w-full flex-1 items-center gap-3 border-b border-planning-border-subtle px-4 py-4 text-left transition-colors last:border-b-0 hover:bg-planning-surface/50 disabled:cursor-not-allowed disabled:opacity-50 sm:px-5"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-planning-border bg-planning-bg text-planning-text-muted transition-colors group-hover:border-planning-accent/30 group-hover:text-planning-accent">
        <Icon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-medium text-planning-text">
          {title}
        </span>
        <span className="mt-0.5 block text-[12px] text-planning-text-muted">
          {description}
        </span>
      </span>

      <ChevronRight
        className="h-4 w-4 shrink-0 text-planning-text-dim transition-colors group-hover:text-planning-accent"
        strokeWidth={1.75}
        aria-hidden
      />
    </button>
  )
}

export function PlanningStartSection({
  onSelectDraftLand,
  onSelectExistingGarden,
  disabled,
}: PlanningStartSectionProps) {
  return (
    <section
      aria-labelledby="planning-start-heading"
      className="flex h-full flex-col overflow-hidden rounded-xl border border-planning-border bg-planning-card shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_12px_40px_rgba(0,0,0,0.18)]"
    >
      <div className="shrink-0 border-b border-planning-border-subtle bg-planning-panel/50 px-4 py-3.5 sm:px-5">
        <h2
          id="planning-start-heading"
          className="text-[14px] font-semibold text-planning-text"
        >
          Yeni plan başlatın
        </h2>
        <p className="mt-1 text-[12px] text-planning-text-muted">
          Arazi kaynağınızı seçin.
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <StartOption
          icon={MapPinned}
          title="Yeni arazi tanımı"
          description="Harita üzerinde alan sınırlarını çizin."
          onClick={onSelectDraftLand}
          disabled={disabled}
        />
        <StartOption
          icon={Sprout}
          title="Kayıtlı bahçe ile devam"
          description="Mevcut bahçe geometrisini kullanın."
          onClick={onSelectExistingGarden}
          disabled={disabled}
        />
      </div>
    </section>
  )
}
