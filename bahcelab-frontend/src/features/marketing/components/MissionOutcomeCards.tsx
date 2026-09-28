import { Clock3, Droplets, TrendingUp, type LucideIcon } from 'lucide-react'
import { Reveal } from './Reveal'

interface OutcomeItem {
  icon: LucideIcon
  title: string
  body: string
  /** Dekoratif çubuk: önce / sonra (yüzde değil, görsel vurgu) */
  before: number
  after: number
}

const outcomes: OutcomeItem[] = [
  {
    icon: Droplets,
    title: 'Girdi ve su',
    body: 'İhtiyaç kadar kullanmak; maliyeti kontrol altında tutmak.',
    before: 72,
    after: 48,
  },
  {
    icon: Clock3,
    title: 'Zamanlama',
    body: 'Doğru zamanda müdahale etmek; sürekli yetişmekten kurtulmak.',
    before: 65,
    after: 42,
  },
  {
    icon: TrendingUp,
    title: 'Verim',
    body: 'Sezonları karşılaştırabilmek; düzenli bir artış görmek.',
    before: 58,
    after: 78,
  },
]

function OutcomeBar({ before, after }: { before: number; after: number }) {
  return (
    <div className="mt-4 space-y-2" aria-hidden>
      <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.14em] text-[#5c665d]">
        <span className="w-10 shrink-0">Önce</span>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#0c2418]/8">
          <div
            className="h-full rounded-full bg-[#0c2418]/22 transition-all"
            style={{ width: `${before}%` }}
          />
        </div>
      </div>
      <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.14em] text-[#2d6b45]">
        <span className="w-10 shrink-0">Hedef</span>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#2d6b45]/10">
          <div
            className="h-full rounded-full bg-[#2d6b45]/45 transition-all"
            style={{ width: `${after}%` }}
          />
        </div>
      </div>
    </div>
  )
}

export function MissionOutcomeCards() {
  return (
    <div className="mt-8">
      <Reveal>
        <p className="text-[13px] font-medium text-[#0c2418] sm:text-sm">Ne kazanmayı hedefliyoruz?</p>
      </Reveal>
      <ul className="mt-4 grid gap-3 sm:grid-cols-3">
        {outcomes.map((item, index) => (
          <Reveal key={item.title} delayMs={index * 70}>
            <li
              className="h-full rounded-xl border border-[#0c2418]/10 bg-white/50 p-4 shadow-[0_1px_0_rgba(12,36,24,0.04)] sm:p-5"
            >
              <item.icon className="h-5 w-5 text-[#2d6b45]" strokeWidth={1.35} aria-hidden />
              <h3 className="mt-3 text-[15px] font-semibold tracking-[-0.01em] text-[#0c2418]">
                {item.title}
              </h3>
              <p className="mt-2 text-[13px] leading-relaxed text-[#4b554c] sm:text-[14px]">{item.body}</p>
              <OutcomeBar before={item.before} after={item.after} />
            </li>
          </Reveal>
        ))}
      </ul>
      <p className="mt-3 text-[11px] leading-relaxed text-[#5c665d]/90">
        Çubuklar örnek gösterimdir; gerçek ölçüm sahaya göre değişir.
      </p>
    </div>
  )
}
