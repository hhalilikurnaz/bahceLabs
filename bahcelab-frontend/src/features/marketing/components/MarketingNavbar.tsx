import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { BahcelabBrandLogo } from './BahcelabBrandLogo'
import { MarketingSocialLinks } from './MarketingSocialLinks'
import { registrationsSoonOnDarkClass } from './registrationsSoonStyles'

interface MarketingNavbarProps {
  /** Hero üzerinde şeffaf; kaydırınca opak şerit */
  variant?: 'over-hero' | 'solid'
}

export function MarketingNavbar({ variant = 'over-hero' }: MarketingNavbarProps) {
  const { isAuthenticated } = useAuth()
  const [scrolled, setScrolled] = useState(false)
  const logoTo = isAuthenticated ? '/bahcem' : '/'

  useEffect(() => {
    if (variant !== 'over-hero') return

    function onScroll() {
      setScrolled(window.scrollY > 48)
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [variant])

  const isSolid = variant === 'solid' || scrolled

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        isSolid
          ? 'border-b border-white/10 bg-[#06140d]/95'
          : 'bg-gradient-to-b from-[#06140d]/70 to-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
        <Link to={logoTo} className="inline-flex shrink-0 items-center no-underline">
          <BahcelabBrandLogo tone="light" />
        </Link>

        <nav className="hidden items-center gap-8 text-[13px] text-[#f3efe4]/80 sm:flex" aria-label="Ana menü">
          <a href="/#misyon" className="no-underline transition-colors hover:text-[#f3efe4]">
            Misyon
          </a>
          <Link to="/blog" className="no-underline transition-colors hover:text-[#f3efe4]">
            Blog
          </Link>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <MarketingSocialLinks variant="navbar" />
          <Link to="/register" className={`${registrationsSoonOnDarkClass} no-underline`}>
            Kayıtlar çok yakında
          </Link>
          <Link
            to="/login"
            className="inline-flex h-9 items-center justify-center rounded-lg bg-[#f3efe4] px-3.5 text-[12px] font-semibold text-[#06140d] no-underline transition-opacity hover:opacity-90 sm:px-4"
          >
            Giriş yap
          </Link>
        </div>
      </div>
    </header>
  )
}
