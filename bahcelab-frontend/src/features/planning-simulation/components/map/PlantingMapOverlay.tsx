interface PlantingMapOverlayProps {
  spacingLabel: string | null
  boundaryWidthM: number | null
  boundaryHeightM: number | null
}

export function PlantingMapOverlay({
  spacingLabel,
  boundaryWidthM,
  boundaryHeightM,
}: PlantingMapOverlayProps) {
  const widthLabel = boundaryWidthM !== null ? `${boundaryWidthM} m` : '—'
  const heightLabel = boundaryHeightM !== null ? `${boundaryHeightM} m` : '—'
  const spacing = spacingLabel ?? '—'

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-12">
      <div className="relative h-[62%] w-[58%]">
        {/* Parcel boundary */}
        <div className="absolute inset-0 rounded-sm border-2 border-dashed border-white/70" />

        {/* Width dimension — top */}
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[11px] font-medium text-white/90">
          {widthLabel}
        </div>

        {/* Height dimension — right */}
        <div className="absolute top-1/2 -right-10 -translate-y-1/2 text-[11px] font-medium text-white/90">
          {heightLabel}
        </div>

        {/* Grid dots pattern */}
        <div
          className="absolute inset-4 opacity-40"
          style={{
            backgroundImage:
              'radial-gradient(circle, rgba(146,196,100,0.85) 1px, transparent 1px)',
            backgroundSize: '18px 18px',
          }}
        />

        {/* Spacing highlight */}
        <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded border-2 border-planning-accent/80 bg-planning-accent/10">
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-planning-border bg-planning-card/95 px-2.5 py-1 text-[11px] font-medium text-planning-text shadow-lg">
            Dikim Mesafesi
            <span className="ml-1 text-planning-accent">{spacing}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
