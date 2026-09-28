import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { BahcelabBrandLogo } from '@/features/marketing/components/BahcelabBrandLogo'

interface PlanningEntryShellProps {
  children: ReactNode
  footerNote?: string
}

export function PlanningEntryShell({
  children,
  footerNote,
}: PlanningEntryShellProps) {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-planning-bg">
      <header className="relative z-20 shrink-0 border-b border-planning-border bg-planning-panel backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3.5 px-6 py-4 sm:px-10">
          <Link to="/" className="inline-flex shrink-0 items-center no-underline">
            <BahcelabBrandLogo tone="light" height={34} />
          </Link>
          <div className="flex items-center gap-3 text-[12px]">
            {user && (
              <span className="hidden text-planning-text-muted sm:inline">{user.name}</span>
            )}
            <Link to="/" className="text-planning-text-muted no-underline hover:text-planning-text">
              Ana sayfa
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-md border border-planning-border px-2.5 py-1.5 text-planning-text-muted transition-colors hover:text-planning-text"
            >
              Çıkış
            </button>
          </div>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
          <div className="absolute inset-x-0 top-0 h-[min(380px,46vh)] bg-[radial-gradient(ellipse_160%_100%_at_50%_0%,rgba(146,196,100,0.1)_0%,rgba(146,196,100,0.035)_38%,transparent_72%)]" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-planning-accent/25 to-transparent" />
        </div>

        <main className="relative z-10 mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col justify-center overflow-hidden px-6 py-5 sm:px-10 sm:py-6">
          {children}
        </main>

        <footer className="relative z-10 shrink-0 border-t border-planning-border-subtle bg-planning-bg px-6 py-3 sm:px-10">
          <div className="mx-auto max-w-6xl">
            <p className="text-[11px] leading-snug text-planning-text-dim">
              Simülasyon sonuçları tahmini senaryo olarak sunulur; gerçek verim
              garantisi değildir.
              {footerNote ? ` ${footerNote}` : ''}
            </p>
          </div>
        </footer>
      </div>
    </div>
  )
}
