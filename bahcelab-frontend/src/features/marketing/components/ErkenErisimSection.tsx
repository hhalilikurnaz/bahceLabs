import { Link } from 'react-router-dom'
import { buttonClass } from '@/components/ui'
import { BEKLEME_FORMU_ACIK, REGISTRATION_ENABLED } from '@/features/auth/authConfig'
import { DiagonalStripSection } from './DiagonalStripSection'
import { MarketingFooter } from './MarketingFooter'
import { Reveal } from './Reveal'

export type ErkenErisimSecondaryCta = { to: string; label: string }

interface ErkenErisimSectionProps {
  /** Ana sayfada blog; blog sayfalarında ana sayfa */
  secondaryCta?: ErkenErisimSecondaryCta
}

const defaultSecondaryCta: ErkenErisimSecondaryCta = { to: '/blog', label: 'Bloga git' }

/** Sayfa sonu çağrısı + footer. Kayıt açıksa hesap oluşturmaya, kapalıysa erken erişim (bekleme) listesine gider; ikisi de /register. */
export function ErkenErisimSection({ secondaryCta = defaultSecondaryCta }: ErkenErisimSectionProps) {
  return (
    <DiagonalStripSection tone="cream" topEdge="slant-down" contentClassName="!pb-0" clipOverflow={false} bottomSlot={<MarketingFooter attached />}>
      <Reveal>
        <h2 className="text-2xl font-semibold tracking-[-0.02em] text-mk-ink sm:text-3xl">Erken erişime katılın</h2>
        <p className="mt-4 max-w-3xl text-body leading-[1.75] text-mk-body sm:text-base">
          {REGISTRATION_ENABLED
            ? 'Hesabınızı oluşturun, bahçenizin sınırını çizin ve haritanızı görün.'
            : BEKLEME_FORMU_ACIK
              ? 'E-posta adresinizi, ilinizi ve ürününüzü bırakın; erişim açıldığında size haber verelim.'
              : 'Erken erişim başvuruları şu an alınmıyor. Yeni yazıları blogda paylaşıyoruz.'}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          {(REGISTRATION_ENABLED || BEKLEME_FORMU_ACIK) && (
            <Link to="/register" className={buttonClass({ variant: 'primary', size: 'lg' })}>
              Erken erişime katıl
            </Link>
          )}
          <Link to={secondaryCta.to} className={buttonClass({ variant: 'secondary', size: 'lg' })}>
            {secondaryCta.label}
          </Link>
        </div>
      </Reveal>
    </DiagonalStripSection>
  )
}
