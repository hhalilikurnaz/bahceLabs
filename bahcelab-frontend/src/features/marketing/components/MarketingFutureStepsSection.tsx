import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { DiagonalStripSection } from './DiagonalStripSection'
import { MarketingFooter } from './MarketingFooter'
import { Reveal } from './Reveal'
import { registrationsSoonOnLightClass } from './registrationsSoonStyles'

function Emphasis({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-[#0c2418]">{children}</strong>
}

export type MarketingFutureStepsSecondaryCta = {
  to: string
  label: string
}

interface MarketingFutureStepsSectionProps {
  /** Ana sayfada blog; blog sayfalarında anasayfa */
  secondaryCta?: MarketingFutureStepsSecondaryCta
}

const defaultSecondaryCta: MarketingFutureStepsSecondaryCta = {
  to: '/blog',
  label: 'Bloga git',
}

export function MarketingFutureStepsSection({
  secondaryCta = defaultSecondaryCta,
}: MarketingFutureStepsSectionProps) {
  return (
    <DiagonalStripSection tone="cream" topEdge="slant-down" contentClassName="!pb-0">
      <Reveal>
        <h2 className="text-2xl font-semibold tracking-[-0.02em] text-[#0c2418] sm:text-3xl">Gelecek adımlar</h2>
        <p className="mt-4 max-w-3xl text-[15px] leading-[1.75] text-[#4b554c] sm:text-base">
          Platformumuz hazır olduğunda planlama ve gözlem deneyimini bu kanaldan duyuracağız. O zamana kadar
          blogumuzda <Emphasis>sürdürülebilir üretim</Emphasis>, veri okuryazarlığı ve sektörel gelişmeler üzerine
          paylaşımlar yapacağız.
        </p>
        <p className="mt-4 max-w-3xl text-[14px] leading-relaxed text-[#5c665d]">
          Erken erişim ve kayıt süreci kısa süre içinde açılacaktır.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <span className={registrationsSoonOnLightClass}>Kayıtlar çok yakında</span>
          <Link
            to={secondaryCta.to}
            className="inline-flex items-center rounded-lg border border-[#0c2418]/15 bg-transparent px-4 py-3 text-[13px] font-medium text-[#0c2418] no-underline transition-colors hover:bg-[#0c2418]/5"
          >
            {secondaryCta.label}
          </Link>
        </div>
      </Reveal>
      <MarketingFooter attached />
    </DiagonalStripSection>
  )
}
