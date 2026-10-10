import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { REGISTRATION_ENABLED } from '../authConfig'
import {
  AuthShell,
  authFieldClass,
  authLabelClass,
  authPrimaryButtonClass,
} from '../components/AuthShell'

export function LoginPage() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/bahcem'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true })
    }
  }, [isAuthenticated, from, navigate])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)

    try {
      await login({ email, password })
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Giriş yapılamadı.')
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthShell
      variant="login"
      title="Giriş yap"
      subtitle="Hesabınızla bahçelerinize ve planlarınıza ulaşın."
      footer={
        <>
          {REGISTRATION_ENABLED ? 'Hesabınız yok mu?' : 'Kayıtlar çok yakında.'}{' '}
          <Link
            to="/register"
            className="font-semibold text-[#0c2418] no-underline underline-offset-2 hover:underline"
          >
            {REGISTRATION_ENABLED ? 'Kayıt olun' : 'Detaylar'}
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && (
          <p
            role="alert"
            className="rounded-lg border border-red-500/25 bg-red-500/8 px-3.5 py-2.5 text-[13px] text-red-900"
          >
            {error}
          </p>
        )}

        <label className="block">
          <span className={authLabelClass}>E-posta</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={authFieldClass}
            placeholder="ornek@bahce.com"
          />
        </label>

        <label className="block">
          <span className={authLabelClass}>Şifre</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={authFieldClass}
            placeholder="••••••••"
          />
        </label>

        <button type="submit" disabled={pending} className={`${authPrimaryButtonClass} mt-2`}>
          {pending ? 'Giriş yapılıyor…' : 'Giriş yap'}
        </button>
      </form>
    </AuthShell>
  )
}
