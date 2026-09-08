import { Navigation } from 'lucide-react'

export function MapCompass() {
  return (
    <div
      className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-lg border border-planning-border bg-planning-card/90"
      aria-label="Kuzey yönü"
    >
      <Navigation className="h-4 w-4 text-planning-text-muted" strokeWidth={1.75} />
      <span className="absolute -top-0.5 text-[9px] font-semibold text-planning-text">N</span>
    </div>
  )
}
