export function GrowthSimulationTimeline() {
  const stages = [
    { month: 0, label: 'Dikim' },
    { month: 6, label: 'Köklenme' },
    { month: 12, label: 'Gelişim' },
    { month: 18, label: 'Çiçeklenme' },
    { month: 24, label: 'İlk Hasat' },
    { month: 36, label: 'Verim Artışı' },
    { month: 48, label: 'Maks. Verim' },
  ]

  return (
    <section className="border-t border-planning-border bg-planning-panel px-6 py-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-planning-text-dim">
          Gelişim Simülasyonu
        </h3>
        <button
          type="button"
          className="rounded-full border border-planning-accent bg-planning-accent/10 px-3 py-1 text-xs text-planning-accent"
        >
          ▶ Oynat
        </button>
      </div>
      <div className="relative flex items-center justify-between">
        <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-planning-border" />
        {stages.map((stage) => (
          <div key={stage.month} className="relative z-10 flex flex-col items-center">
            <div
              className={`h-3 w-3 rounded-full ${
                stage.month === 24
                  ? 'bg-planning-accent ring-4 ring-planning-accent/20'
                  : 'bg-planning-border'
              }`}
            />
            <p className="mt-2 text-[10px] text-planning-text-dim">
              {stage.month === 48 ? '48+ Ay' : `${stage.month}. Ay`}
            </p>
            <p className="text-[10px] text-planning-text-muted">{stage.label}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-[10px] text-planning-text-dim">
        Simülasyon çıktısı — bilimsel verim garantisi değildir
      </p>
    </section>
  )
}
