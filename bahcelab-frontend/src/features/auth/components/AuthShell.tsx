import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import heroImage from '@/assets/marketing/hero-orchard-drones.jpg'
import { BahcelabBrandLogo } from '@/features/marketing/components/BahcelabBrandLogo'

export const authFieldClass =
  'mt-1.5 w-full rounded-lg border border-[#0c2418]/12 bg-white px-3.5 py-3 text-[14px] text-[#0c2418] outline-none transition-[border-color,box-shadow] placeholder:text-[#5c665d]/50 focus:border-[#2d6b45]/40 focus:ring-2 focus:ring-[#2d6b45]/15'

export const authLabelClass = 'text-[12px] font-medium tracking-wide text-[#4b554c]'

export const authPrimaryButtonClass =
  'w-full rounded-lg border border-[#0c2418]/15 bg-[#0c2418] px-4 py-3.5 text-[14px] font-medium text-[#f3efe4] transition-opacity hover:opacity-90 disabled:opacity-55'

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
        className="relative hidden flex-col justify-between overflow-hidden bg-[#06140d] p-10 text-[#f3efe4] xl:p-14 lg:flex"
        aria-hidden={false}
      >
        <img
          src={heroImage}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-[#06140d]/55" />
        <div
          className="absolute inset-0 bg-gradient-to-br from-[#06140d]/90 via-[#06140d]/40 to-[#0f2a1c]/75"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_20%_20%,rgba(163,230,53,0.12),transparent)]"
          aria-hidden
        />

        <div className="relative z-10">
          <Link to="/" className="inline-flex no-underline">
            <BahcelabBrandLogo tone="light" height={36} />
          </Link>
        </div>

        <div className="relative z-10 max-w-lg">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#c9f27a]/90">
            {copy.eyebrow}
          </p>
          <h2 className="mt-4 text-balance text-3xl font-semibold leading-tight tracking-[-0.03em] text-[#fffef9] xl:text-4xl">
            {copy.headline}
          </h2>
          {copy.lead ? (
            <p className="mt-4 text-[15px] leading-relaxed text-[#f3efe4]/82">{copy.lead}</p>
          ) : null}
          {copy.bullets.length > 0 ? (
            <ul className="mt-8 space-y-3 border-t border-white/10 pt-8 text-[14px] leading-relaxed text-[#f3efe4]/78">
              {copy.bullets.map((item) => (
                <li key={item} className="flex gap-3">
                  <span
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#a3e635]"
                    aria-hidden
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <p className="relative z-10 text-[11px] text-[#f3efe4]/45">
          Tarımda akıllı üretim — BahçeLab
        </p>
      </aside>

      <section className="relative flex min-h-dvh flex-col bg-[#e4ede0]">
        <header className="relative px-5 py-5 sm:px-8 lg:px-12 lg:pt-10">
          <div className="mx-auto flex w-full max-w-[28rem] items-center justify-between gap-4 lg:max-w-[30rem]">
            <Link to="/" className="inline-flex no-underline lg:hidden">
              <BahcelabBrandLogo height={30} />
            </Link>
            <Link
              to="/"
              className="ml-auto text-[13px] font-medium text-[#4b554c] no-underline transition-colors hover:text-[#0c2418] lg:ml-0"
            >
              ← Ana sayfa
            </Link>
          </div>
        </header>

        <main className="relative flex flex-1 flex-col justify-center px-5 pb-10 pt-2 sm:px-8 lg:px-12 lg:pb-14">
          <div className="mx-auto w-full max-w-[28rem] lg:max-w-[30rem]">
            <div
              className="overflow-hidden rounded-[1.25rem] border border-[#0c2418]/12 bg-marketing-cream sm:rounded-[1.5rem]"
            >
              <div className="border-b border-[#0c2418]/8 bg-[#f7f4ee]/90 px-6 py-6 sm:px-8 sm:py-7">
                <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-[#2d6b45]/80">
                  {cardEyebrow[variant]}
                </p>
                <h1 className="mt-2 text-balance text-[clamp(1.5rem,4vw,1.75rem)] font-semibold tracking-[-0.03em] text-[#0c2418]">
                  {title}
                </h1>
                <p className="mt-2 text-[14px] leading-relaxed text-[#4b554c]">{subtitle}</p>
              </div>

              <div className="px-6 py-7 sm:px-8 sm:py-8">{children}</div>
            </div>

            {footer && <p className="mt-6 text-center text-[13px] leading-relaxed text-[#4b554c]">{footer}</p>}
          </div>
        </main>
      </section>
    </div>
  )
}
