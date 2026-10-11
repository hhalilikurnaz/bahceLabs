import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { REGISTRATION_ENABLED } from '../authConfig'
import { authErrorMessage } from '../authErrors'
import { PasswordField } from '../components/authForm'
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
      setError(authErrorMessage(err, 'Giriş yapılamadı.'))
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
            className="font-semibold text-ink no-underline underline-offset-2 hover:underline"
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
            className="rounded-lg border border-app-danger/25 bg-app-danger/8 px-3.5 py-2.5 text-small text-app-danger"
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

        <PasswordField
          label="Şifre"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Şifreniz"
        />

        <button type="submit" disabled={pending} className={`${authPrimaryButtonClass} mt-2`}>
          {pending ? 'Giriş yapılıyor…' : 'Giriş yap'}
        </button>
      </form>
    </AuthShell>
  )
}
