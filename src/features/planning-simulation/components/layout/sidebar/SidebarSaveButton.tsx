interface SidebarSaveButtonProps {
  onSave: () => void
  isDirty?: boolean
}

export function SidebarSaveButton({ onSave, isDirty }: SidebarSaveButtonProps) {
  return (
    <button
      type="button"
      onClick={onSave}
      className="w-full rounded-lg border border-planning-border bg-planning-card px-3 py-2 text-[11px] font-medium text-planning-text transition-colors hover:border-planning-text-dim hover:bg-planning-surface"
    >
      {isDirty ? 'Planı Kaydet *' : 'Planı Kaydet'}
    </button>
  )
}
