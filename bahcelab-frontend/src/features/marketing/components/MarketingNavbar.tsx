import { Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BrandLogo, buttonClass } from '@/components/ui'
import { useAuth } from '@/features/auth/useAuth'

interface MarketingNavbarProps {
  /** Hero üzerinde biraz saydam; kaydırınca daha opak. Blog ve alt sayfalar: solid */
  variant?: 'over-hero' | 'solid'
}

const LINKS = [
  { label: 'Nasıl çalışır', to: { pathname: '/', hash: '#nasil-calisir' } },
  { label: 'Blog', to: { pathname: '/blog' } },
] as const

const linkClass = 'text-small text-mk-on-dark/85 no-underline transition-colors hover:text-mk-on-dark'

export function MarketingNavbar({ variant = 'over-hero' }: MarketingNavbarProps) {
  const { isAuthenticated } = useAuth()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const logoTo = isAuthenticated ? '/bahceler' : '/'

  useEffect(() => {
    if (variant !== 'over-hero') return
    const onScroll = () => setScrolled(window.scrollY > 48)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [variant])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const solid = variant === 'solid' || scrolled || open

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b border-mk-on-dark/10 backdrop-blur-md transition-colors duration-300 ${solid ? 'bg-mk-night-deep/95' : 'bg-mk-night-deep/80'}`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-5 sm:px-8">
        <Link to={logoTo} aria-label="BahçeLab ana sayfa" className="inline-flex shrink-0 items-center no-underline">
          <BrandLogo surface="dark" height={30} />
        </Link>

        <nav className="ml-6 hidden items-center gap-7 md:flex" aria-label="Ana menü">
          {LINKS.map((l) => (
            <Link key={l.label} to={l.to} className={linkClass}>
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {!isAuthenticated && (
            <Link to="/login" className={`${linkClass} hidden md:inline`}>
              Giriş yap
            </Link>
          )}
          <Link
            to={isAuthenticated ? '/bahceler' : '/register'}
            className={buttonClass({ variant: 'onDark', className: 'whitespace-nowrap px-3.5 text-small' })}
          >
            {isAuthenticated ? 'Bahçelerim' : 'Erken erişime katıl'}
          </Link>
          <button
            type="button"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-mk-on-dark hover:bg-mk-on-dark/10 md:hidden"
            aria-expanded={open}
            aria-controls="mobil-menu"
            aria-label={open ? 'Menüyü kapat' : 'Menüyü aç'}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
          </button>
        </div>
      </div>

      {open && (
        <nav id="mobil-menu" aria-label="Mobil menü" className="border-t border-mk-on-dark/10 px-5 pb-4 pt-2 md:hidden">
          <ul className="mx-auto flex max-w-6xl flex-col">
            {LINKS.map((l) => (
              <li key={l.label}>
                <Link to={l.to} onClick={() => setOpen(false)} className="flex min-h-12 items-center text-body text-mk-on-dark no-underline">
                  {l.label}
                </Link>
              </li>
            ))}
            {!isAuthenticated && (
              <li>
                <Link to="/login" onClick={() => setOpen(false)} className="flex min-h-12 items-center text-body text-mk-on-dark no-underline">
                  Giriş yap
                </Link>
              </li>
            )}
          </ul>
        </nav>
      )}
    </header>
  )
}
