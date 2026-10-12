import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BrandLogo } from '@/components/ui'
import { AbstractParcels } from './AbstractParcels'

export const authFieldClass =
  'mt-1.5 w-full rounded-lg border border-ink/12 bg-white px-3.5 py-3 text-body text-ink outline-none transition-[border-color,box-shadow] placeholder:text-app-text-dim focus:border-leaf-deep focus:ring-2 focus:ring-leaf-deep/30'

export const authLabelClass = 'text-caption font-medium tracking-wide text-app-text-muted'

export const authPrimaryButtonClass =
  'min-h-12 w-full rounded-lg border border-ink/15 bg-ink px-4 py-3.5 text-body font-semibold text-cream transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf-deep disabled:opacity-60'

type AuthVariant = 'login' | 'register'

const cardEyebrow: Record<AuthVariant, string> = {
  login: 'BahçeLab · Giriş',
  register: 'BahçeLab · Erken erişim',
}

const panelCopy: Record<
  AuthVariant,
  { eyebrow: string; headline: string; lead: string; bullets: string[] }
> = {
  login: {
    eyebrow: 'Planlama alanı',
    headline: 'Bahçenizi tek ekranda planlayın',
    lead: 'Doğru Veriyle, Doğru Üretime İlerleyin!',
    bullets: [],
  },
  register: {
    eyebrow: 'Erken erişim',
    headline: 'Kayıt süreci hazırlanıyor',
    lead: 'Planlama ve gözlem deneyimi açıldığında bu kanaldan duyuracağız. Blogda sürdürülebilir üretim ve veri okuryazarlığı üzerine yazılar yayınlıyoruz.',
    bullets: [
      'Yeni kayıt şimdilik kapalı',
      'Mevcut hesaplarla giriş yapılabilir',
      'Duyuru için blogu takip edebilirsiniz',
    ],
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
      <aside
        className="relative hidden flex-col justify-between overflow-hidden bg-forest p-10 text-cream xl:p-14 lg:flex"
        aria-hidden={false}
      >
        <AbstractParcels className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-0 bg-forest/35" />
        <div
          className="absolute inset-0 bg-gradient-to-br from-forest/90 via-forest/40 to-forest/75"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_20%_20%,rgba(163,230,53,0.12),transparent)]"
          aria-hidden
        />

        <div className="relative z-10">
          <Link to="/" aria-label="BahçeLab ana sayfa" className="inline-flex no-underline">
            <BrandLogo surface="dark" height={34} />
          </Link>
        </div>

        <div className="relative z-10 max-w-lg">
          <p className="text-caption font-medium uppercase tracking-[0.22em] text-lemon">
            {copy.eyebrow}
          </p>
          <h2 className="mt-4 text-balance font-display text-4xl leading-tight text-app-card xl:text-5xl">
            {copy.headline}
          </h2>
          {copy.lead ? (
            <p className="mt-4 text-body leading-relaxed text-cream/82">{copy.lead}</p>
          ) : null}
          {copy.bullets.length > 0 ? (
            <ul className="mt-8 space-y-3 border-t border-white/10 pt-8 text-body leading-relaxed text-cream/78">
              {copy.bullets.map((item) => (
                <li key={item} className="flex gap-3">
                  <span
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-lemon"
                    aria-hidden
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <p className="relative z-10 text-caption text-cream/45">
          Tarımda akıllı üretim — BahçeLab
        </p>
      </aside>

      <section className="relative flex min-h-dvh flex-col bg-app-bg">
        <header className="relative px-5 py-5 sm:px-8 lg:px-12 lg:pt-10">
          <div className="mx-auto flex w-full max-w-[28rem] items-center justify-between gap-4 lg:max-w-[30rem]">
            <Link to="/" aria-label="BahçeLab ana sayfa" className="inline-flex no-underline lg:hidden">
              <BrandLogo surface="light" height={30} />
            </Link>
            <Link
              to="/"
              className="ml-auto text-small font-medium text-app-text-muted no-underline transition-colors hover:text-ink lg:ml-0"
            >
              ← Ana sayfa
            </Link>
          </div>
        </header>

        <main className="relative flex flex-1 flex-col justify-center px-5 pb-10 pt-2 sm:px-8 lg:px-12 lg:pb-14">
          <div className="mx-auto w-full max-w-[28rem] lg:max-w-[30rem]">
            <div
              className="overflow-hidden rounded-[1.25rem] border border-ink/12 bg-marketing-cream sm:rounded-[1.5rem]"
            >
              <div className="border-b border-ink/8 bg-cream/90 px-6 py-6 sm:px-8 sm:py-7">
                <p className="text-caption font-medium uppercase tracking-[0.24em] text-leaf-deep">
                  {cardEyebrow[variant]}
                </p>
                <h1 className="mt-2 text-balance font-display text-[clamp(1.75rem,4vw,2.25rem)] leading-tight text-ink">
                  {title}
                </h1>
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
