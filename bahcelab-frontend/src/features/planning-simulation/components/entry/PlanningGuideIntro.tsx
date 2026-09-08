import { PLANNING_STEPS } from '../../constants/planningSteps'

export function PlanningGuideIntro() {
  return (
    <section className="relative shrink-0 overflow-hidden rounded-xl border border-white/[0.07] bg-planning-panel/30 px-6 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_8px_32px_rgba(0,0,0,0.16)] backdrop-blur-md sm:px-8 sm:py-6">
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.05] via-transparent to-planning-accent/[0.04]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-planning-accent/[0.06] blur-3xl"
        aria-hidden
      />

      <div className="relative">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-planning-accent">
          Planlama modülü
        </p>
        <h1 className="mt-3 text-[24px] font-semibold leading-snug text-planning-text sm:text-[28px]">
          Bahçe planlaması ve simülasyon
        </h1>

        <div className="mt-4 space-y-3 text-[15px] leading-[1.65] text-planning-text-muted sm:text-[16px]">
          <p>
            Bu modülde arazi tanımından dikim planına, bakım programından hasat
            simülasyonuna kadar tüm süreci tek çalışma alanında yönetebilirsiniz.
          </p>
          <p>
            Başlamak için arazi kaynağınızı seçin; planlama ekranında adım adım
            ilerleyin. Kayıtlı planlarınıza istediğiniz zaman geri dönebilirsiniz.
          </p>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-2 border-t border-white/[0.06] pt-4">
          {PLANNING_STEPS.map((step, index) => (
            <span key={step.id} className="flex items-center gap-2">
              <span className="text-[12px] text-planning-text-muted">
                <span className="font-semibold text-planning-text">
                  {step.order}.
                </span>{' '}
                {step.label}
              </span>
              {index < PLANNING_STEPS.length - 1 && (
                <span className="text-planning-text-dim/50" aria-hidden>
                  /
                </span>
              )}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
