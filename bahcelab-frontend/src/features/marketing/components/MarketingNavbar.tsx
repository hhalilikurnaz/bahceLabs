import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BahcelabBrandLogo } from './BahcelabBrandLogo'

const REGISTRATION_OPEN = false

interface MarketingNavbarProps {
  /** Hero üzerinde şeffaf; kaydırınca opak şerit */
  variant?: 'over-hero' | 'solid'
}

export function MarketingNavbar({ variant = 'over-hero' }: MarketingNavbarProps) {
  const [scrolled, setScrolled] = useState(false)

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
          ? 'border-b border-white/10 bg-[#06140d]/88 backdrop-blur-md'
          : 'bg-gradient-to-b from-[#06140d]/70 to-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
        <Link to="/" className="inline-flex shrink-0 items-center no-underline">
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
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-lg border border-white/20 px-3 py-2 text-[12px] font-medium text-[#f3efe4]/70 sm:px-3.5"
            title="Çok yakında"
          >
            Giriş yap
          </button>
          {REGISTRATION_OPEN ? (
            <button
              type="button"
              className="rounded-lg bg-[#f3efe4] px-3 py-2 text-[12px] font-semibold text-[#06140d] sm:px-3.5"
            >
              Kayıt ol
            </button>
          ) : (
            <span
              className="rounded-lg border border-[#a3e635]/35 bg-[#a3e635]/10 px-3 py-2 text-[11px] font-semibold text-[#c9f27a] sm:text-[12px]"
            >
              Kayıtlar çok yakında
            </span>
          )}
        </div>
      </div>
    </header>
  )
}
