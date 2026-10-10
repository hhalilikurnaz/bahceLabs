import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { BahcelabBrandLogo } from '@/features/marketing/components/BahcelabBrandLogo'

/** Adım 3'te tam ekran uydu haritası ve bahçe paneliyle doldurulacak. */
export function BahcemPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[#0e1a12] text-[#f3efe4]">
      <header className="flex items-center justify-between gap-4 border-b border-white/10 px-6 py-4">
        <Link to="/bahcem" className="inline-flex items-center no-underline">
          <BahcelabBrandLogo tone="dark" height={32} />
        </Link>
        <div className="flex items-center gap-3 text-[13px]">
          {user && <span className="hidden text-[#f3efe4]/70 sm:inline">{user.name}</span>}
          <Link to="/planning" className="text-[#f3efe4]/70 no-underline hover:text-[#f3efe4]">
            Planlama
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-md border border-white/15 px-3 py-1.5 text-[#f3efe4]/80 transition-colors hover:text-white"
          >
            Çıkış yap
          </button>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">Bahçem</h1>
          <p className="mt-2 text-[14px] text-[#f3efe4]/60">
            Bahçe haritası ve izleme paneli çok yakında burada olacak.
          </p>
        </div>
      </main>
    </div>
  )
}
