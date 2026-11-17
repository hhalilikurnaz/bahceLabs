import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BrandLogo } from '@/components/ui'
import { AbstractParcels } from './AbstractParcels'

export const authFieldClass =
  'mt-1.5 w-full rounded-md border border-mk-ink/20 bg-white px-3.5 py-3 text-body text-mk-ink outline-none transition-[border-color,box-shadow] placeholder:text-app-text-dim focus:border-mk-accent focus:ring-2 focus:ring-mk-accent/30'

export const authLabelClass = 'text-caption font-medium tracking-wide text-app-text-muted'

type AuthVariant = 'login' | 'register'

const cardEyebrow: Record<AuthVariant, string> = {
  login: 'BahçeLab · Giriş',
  register: 'BahçeLab · Erken erişim',
}

const panelCopy: Record<AuthVariant, { eyebrow: string; headline: string; lead: string }> = {
  login: {
    eyebrow: 'Bahçe durumu',
    headline: 'Bahçenizin durumunu tek ekranda izleyin',
    lead: 'Uydu görüntüsü ve hava verisi, bahçenizin kendi geçmişine göre tek haritada.',
  },
  register: {
    eyebrow: 'Erken erişim',
    headline: 'Haritanızı ilk görenlerden olun',
    lead: 'Erişim açıldığında size haber verelim. Kayıt için e-posta adresiniz, iliniz ve ürününüz yeterli.',
  },
}

interface AuthShellProps {
  variant: AuthVariant
  title: string
  subtitle: string
  children: ReactNode
  footer?: ReactNode
}

export function AuthShell({ variant, title, subtitle, children, footer }: AuthShellProps) {
  const copy = panelCopy[variant]

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-mk-night p-10 text-mk-on-dark xl:p-14 lg:flex">
        <AbstractParcels className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-0 bg-mk-night/35" />
        <div className="absolute inset-0 bg-gradient-to-br from-mk-night/90 via-mk-night/40 to-mk-night/75" aria-hidden />

        <div className="relative z-10">
          <Link to="/" aria-label="BahçeLab ana sayfa" className="inline-flex no-underline">
            <BrandLogo surface="dark" height={34} />
          </Link>
        </div>

        <div className="relative z-10 max-w-lg">
          <p className="text-caption font-semibold uppercase tracking-[0.16em] text-mk-lemon">{copy.eyebrow}</p>
          <h2 className="mt-4 text-balance font-display text-4xl leading-tight text-mk-on-dark xl:text-5xl">{copy.headline}</h2>
          <p className="mt-4 text-body leading-relaxed text-mk-on-dark/85">{copy.lead}</p>
        </div>

        <p className="relative z-10 text-caption text-mk-on-dark/70">Narenciye bahçeleri için akıllı tarım sistemleri</p>
      </aside>

      <section className="relative flex min-h-dvh flex-col bg-app-bg">
        <header className="relative px-5 py-5 sm:px-8 lg:px-12 lg:pt-10">
          <div className="mx-auto flex w-full max-w-[28rem] items-center justify-between gap-4 lg:max-w-[30rem]">
            <Link to="/" aria-label="BahçeLab ana sayfa" className="inline-flex no-underline lg:hidden">
              <BrandLogo surface="light" height={30} />
            </Link>
            <Link to="/" className="ml-auto text-small font-medium text-app-text-muted no-underline transition-colors hover:text-mk-ink lg:ml-0">
              ← Ana sayfa
            </Link>
          </div>
        </header>

        <main className="relative flex flex-1 flex-col justify-center px-5 pb-10 pt-2 sm:px-8 lg:px-12 lg:pb-14">
          <div className="mx-auto w-full max-w-[28rem] lg:max-w-[30rem]">
            <div className="overflow-hidden rounded-mk border border-mk-ink/12 bg-mk-cream">
              <div className="border-b border-mk-ink/8 bg-mk-cream px-6 py-6 sm:px-8 sm:py-7">
                <p className="text-caption font-semibold uppercase tracking-[0.16em] text-mk-accent">{cardEyebrow[variant]}</p>
                <h1 className="mt-2 text-balance font-display text-[clamp(1.75rem,4vw,2.25rem)] leading-tight text-mk-ink">{title}</h1>
                <p className="mt-2 text-body leading-relaxed text-app-text-muted">{subtitle}</p>
              </div>

              <div className="px-6 py-7 sm:px-8 sm:py-8">{children}</div>
            </div>

            {footer && <p className="mt-6 text-center text-small leading-relaxed text-app-text-muted">{footer}</p>}
          </div>
        </main>
      </section>
    </div>
  )
}
