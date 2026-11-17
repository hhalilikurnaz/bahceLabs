import { Link } from 'react-router-dom'
import { BrandLogo } from '@/components/ui'
import './footer.css'
import { MarketingSocialLinks } from './MarketingSocialLinks'

interface MarketingFooterProps {
  /** Son şerit bölümünün içinde; zemin rengini şerit verir */
  attached?: boolean
}

const linkClass = 'inline-flex min-h-6 items-center text-small text-mk-muted underline decoration-mk-ink/20 underline-offset-2 transition-colors hover:text-mk-ink hover:decoration-mk-ink/40'

export function MarketingFooter({ attached = false }: MarketingFooterProps) {
  const year = new Date().getFullYear()

  return (
    <footer className={`relative overflow-hidden text-mk-muted ${attached ? '' : 'bg-mk-cream'}`}>
      <div className={`relative z-10 mx-auto grid max-w-6xl gap-8 px-5 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr] ${attached ? 'pb-4 pt-12' : 'py-12'}`}>
        <div>
          <BrandLogo surface="light" height={30} />
          <p className="mt-3 max-w-[38ch] text-small text-mk-muted">
            Narenciye bahçeleri için uydu ve hava verisi, bahçenizin kendi geçmişine göre tek haritada.
          </p>
        </div>
        <nav aria-label="Alt menü">
          <ul className="flex flex-col items-start gap-2">
            <li><Link to="/blog" className={linkClass}>Blog</Link></li>
            <li><Link to="/login" className={linkClass}>Giriş yap</Link></li>
            <li><Link to="/register" className={linkClass}>Erken erişim</Link></li>
            <li><Link to="/kvkk" className={linkClass}>Aydınlatma metni (KVKK)</Link></li>
          </ul>
        </nav>
        <MarketingSocialLinks />
      </div>
      <p className="relative z-10 mx-auto max-w-6xl px-5 pb-6 text-small text-mk-muted sm:px-8">© {year} BahçeLab · Tüm hakları saklıdır.</p>
      <div aria-hidden className="mk-watermark" />
    </footer>
  )
}
