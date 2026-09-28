import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import heroImage from '@/assets/marketing/hero-orchard-drones.jpg'
import { BahcelabBrandLogo } from '@/features/marketing/components/BahcelabBrandLogo'

export const authFieldClass =
  'mt-1.5 w-full rounded-xl border border-[#0c2418]/12 bg-[#faf9f5] px-3.5 py-3 text-[14px] text-[#0c2418] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] outline-none transition-shadow placeholder:text-[#5c665d]/50 focus:border-[#2d6b45]/35 focus:bg-white focus:ring-2 focus:ring-[#2d6b45]/20'

export const authLabelClass = 'text-[12px] font-medium tracking-wide text-[#4b554c]'

export const authPrimaryButtonClass =
  'w-full rounded-xl bg-[#0c2418] px-4 py-3.5 text-[14px] font-semibold text-[#f3efe4] shadow-[0_8px_24px_rgba(6,20,13,0.22)] transition-[transform,opacity] hover:opacity-95 active:scale-[0.99] disabled:opacity-55 disabled:shadow-none'

type AuthVariant = 'login' | 'register'

const panelCopy: Record<
  AuthVariant,
  { eyebrow: string; headline: string; lead: string; bullets: string[] }
> = {
  login: {
    eyebrow: 'Planlama alanı',
    headline: 'Bahçenizi tek ekranda planlayın',
    lead: 'Dikimden bakıma, simülasyona — kararlarınızı veriye dayalı bir akışta toplayın.',
    bullets: [
      'Arazi ve bahçe kayıtlarınızı güvenle yönetin',
      'Adım adım planlama ve senaryo simülasyonu',
      'Saha gerçekliğine uygun, ölçülebilir özetler',
    ],
  },
  register: {
    eyebrow: 'BahçeLab hesabı',
    headline: 'Üretim planınızı bir araya getirin',
    lead: 'Kayıt olduktan sonra planlama modülüne geçebilir; verim odaklı araçları keşfedebilirsiniz.',
    bullets: [
      'Dakikalar içinde hesap oluşturun',
      'Ekip içi planlama için hazır çalışma alanı',
      'Sürdürülebilir üretim perspektifi',
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
          <p className="mt-4 text-[15px] leading-relaxed text-[#f3efe4]/82">{copy.lead}</p>
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
        </div>

        <p className="relative z-10 text-[11px] text-[#f3efe4]/45">
          Tarımda akıllı üretim — BahçeLab
        </p>
      </aside>

      <section className="relative flex min-h-dvh flex-col bg-marketing-cream">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_80%_70%_at_50%_-20%,rgba(45,107,69,0.08),transparent)] lg:hidden"
          aria-hidden
        />

        <header className="relative border-b border-[#0c2418]/8 px-5 py-4 lg:border-none lg:px-10 lg:pt-10">
          <Link to="/" className="inline-flex no-underline lg:hidden">
            <BahcelabBrandLogo tone="dark" height={30} className="brightness-0" />
          </Link>
          <Link
            to="/"
            className="hidden text-[13px] font-medium text-[#5c665d] no-underline hover:text-[#0c2418] lg:inline-flex"
          >
            ← Ana sayfa
          </Link>
        </header>

        <main className="relative flex flex-1 flex-col justify-center px-5 pb-10 pt-6 sm:px-10 lg:px-14 lg:pb-14">
          <div className="mx-auto w-full max-w-[26rem]">
            <div className="lg:rounded-2xl lg:border lg:border-[#0c2418]/8 lg:bg-white/45 lg:p-8 lg:shadow-[0_20px_50px_rgba(12,36,24,0.06)] xl:p-9">
              <h1 className="text-2xl font-semibold tracking-[-0.02em] text-[#0c2418] sm:text-[1.65rem]">
                {title}
              </h1>
              <p className="mt-2 text-[14px] leading-relaxed text-[#5c665d]">{subtitle}</p>
              <div className="mt-7">{children}</div>
            </div>

            {footer && (
              <p className="mt-6 text-center text-[13px] text-[#5c665d] lg:mt-8">{footer}</p>
            )}
          </div>
        </main>
      </section>
    </div>
  )
}
