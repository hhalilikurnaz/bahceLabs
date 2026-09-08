import { Pause, Play } from 'lucide-react'
import { useState } from 'react'
import {
  TreeStageIllustration,
  type TreeStage,
} from './TreeStageIllustration'

interface Milestone {
  month: number
  monthLabel: string
  statusLabel: string
  stage: TreeStage
}

const GROWTH_STAGES: Milestone[] = [
  { month: 0, monthLabel: '0. Ay', statusLabel: 'Dikim', stage: 'seedling' },
  { month: 6, monthLabel: '6. Ay', statusLabel: 'Köklenme', stage: 'sprout' },
  { month: 12, monthLabel: '12. Ay', statusLabel: 'Gelişim', stage: 'young' },
  { month: 18, monthLabel: '18. Ay', statusLabel: 'Çiçeklenme', stage: 'flowering' },
  { month: 24, monthLabel: '24. Ay', statusLabel: 'İlk Hasat', stage: 'harvest' },
  { month: 36, monthLabel: '36. Ay', statusLabel: 'Verim Artışı', stage: 'mature' },
  { month: 48, monthLabel: '48. Ay+', statusLabel: 'Maksimum Verim', stage: 'peak' },
]

const DEFAULT_ACTIVE_MONTH = 24

export function GrowthSimulationTimeline() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [activeMonth, setActiveMonth] = useState(DEFAULT_ACTIVE_MONTH)

  const activeIndex = GROWTH_STAGES.findIndex((s) => s.month === activeMonth)
  const progressPercent =
    activeIndex <= 0 ? 0 : (activeIndex / (GROWTH_STAGES.length - 1)) * 100

  return (
    <section className="px-6 py-4">
      <div className="mb-2">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-white">
          GELİŞİM SİMÜLASYONU
        </h3>
      </div>

      <div className="flex items-center gap-4">
        {/* Play / Pause circular button */}
        <button
          type="button"
          onClick={() => setIsPlaying((p) => !p)}
          aria-label={isPlaying ? 'Duraklat' : 'Simülasyonu Oynat'}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-planning-accent/80 bg-[#122018] text-planning-accent shadow-[0_0_12px_rgba(146,196,100,0.22)] transition-all hover:scale-105 hover:bg-planning-accent/20 focus:outline-none"
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" fill="currentColor" />
          ) : (
            <Play className="ml-0.5 h-4 w-4" fill="currentColor" />
          )}
        </button>

        {/* Timeline body: trees + track with nodes + labels */}
        <div className="relative min-w-0 flex-1">
          {/* Milestone columns */}
          <div className="relative flex justify-between">
            {/* Horizontal track line passing through nodes */}
            <div
              className="pointer-events-none absolute left-0 right-0 h-[2.5px] bg-[#27323a]"
              style={{ top: '74px' }}
            >
              <div
                className="h-full bg-planning-accent shadow-[0_0_8px_rgba(146,196,100,0.5)] transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {GROWTH_STAGES.map((item) => {
              const isActive = item.month === activeMonth
              const isPast = item.month <= activeMonth

              return (
                <button
                  key={item.month}
                  type="button"
                  onClick={() => setActiveMonth(item.month)}
                  className="group relative z-10 flex flex-1 flex-col items-center focus:outline-none"
                  aria-label={`${item.monthLabel} — ${item.statusLabel}`}
                >
                  {/* Tree Illustration */}
                  <div className="mb-0.5 flex h-[72px] items-end justify-center">
                    <TreeStageIllustration
                      stage={item.stage}
                      isHighlighted={isActive}
                    />
                  </div>

                  {/* Milestone Node on the line */}
                  <div className="flex h-5 items-center justify-center">
                    {isActive ? (
                      <div className="relative flex items-center justify-center">
                        <span className="absolute h-6 w-6 animate-ping rounded-full bg-planning-accent opacity-30" />
                        <span className="h-3.5 w-3.5 rounded-full border-2 border-white bg-planning-accent shadow-[0_0_10px_rgba(146,196,100,0.75)]" />
                      </div>
                    ) : (
                      <div
                        className={`h-2 w-2 rounded-full transition-colors ${
                          isPast
                            ? 'bg-planning-accent/80'
                            : 'bg-[#3b4752] group-hover:bg-[#526373]'
                        }`}
                      />
                    )}
                  </div>

                  {/* Text below node */}
                  <div className="mt-1 text-center">
                    <p
                      className={`text-[11px] leading-tight transition-colors ${
                        isActive
                          ? 'font-bold text-planning-accent'
                          : 'font-medium text-white/90 group-hover:text-white'
                      }`}
                    >
                      {item.monthLabel}
                    </p>
                    <p
                      className={`mt-0.5 text-[10px] leading-tight transition-colors ${
                        isActive
                          ? 'font-semibold text-planning-accent'
                          : 'text-[#8b99a5] group-hover:text-white/80'
                      }`}
                    >
                      {item.statusLabel}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
