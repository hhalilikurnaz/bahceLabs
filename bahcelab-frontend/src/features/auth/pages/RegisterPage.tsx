import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { REGISTRATION_ENABLED } from '../authConfig'
import { PasswordField, authErrorMessage } from '../components/authForm'
import { registrationsSoonOnLightClass } from '@/features/marketing/components/registrationsSoonStyles'
import {
  AuthShell,
  authFieldClass,
  authLabelClass,
  authPrimaryButtonClass,
} from '../components/AuthShell'

export function RegisterPage() {
  const { isAuthenticated, register } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/bahcem', { replace: true })
    }
  }, [isAuthenticated, navigate])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)

    try {
      await register({ name, email, password })
      navigate('/bahcem', { replace: true })
    } catch (err) {
      setError(authErrorMessage(err, 'Kayıt olunamadı.'))
    } finally {
      setPending(false)
    }
  }

  if (REGISTRATION_ENABLED) {
    return (
      <AuthShell
        variant="register"
        title="Hesap oluştur"
        subtitle="Bahçelerinizi tek yerden izlemeye başlayın."
        footer={
          <>
            Zaten hesabınız var mı?{' '}
            <Link
              to="/login"
              className="font-semibold text-ink no-underline underline-offset-2 hover:underline"
            >
              Giriş yapın
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
            <span className={authLabelClass}>Ad soyad</span>
            <input
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={authFieldClass}
            />
          </label>

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
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="En az 8 karakter"
            hint="En az 8 karakter olmalı."
          />

          <button type="submit" disabled={pending} className={`${authPrimaryButtonClass} mt-2`}>
            {pending ? 'Hesap oluşturuluyor…' : 'Kayıt ol'}
          </button>
        </form>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      variant="register"
      title="Kayıtlar çok yakında"
      subtitle="Erken erişim ve kayıt süreci kısa süre içinde açılacaktır. O zamana kadar blogumuzda sürdürülebilir üretim, veri okuryazarlığı ve sektörel gelişmeler üzerine paylaşımlar yapıyoruz."
      footer={
        <>
          Zaten hesabınız var mı?{' '}
          <Link
            to="/login"
            className="font-semibold text-ink no-underline underline-offset-2 hover:underline"
          >
            Giriş yapın
          </Link>
        </>
      }
    >
      <div className="space-y-5">
        <span className={`${registrationsSoonOnLightClass} w-full`} role="status">
          Kayıtlar çok yakında
        </span>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            to="/blog"
            className="inline-flex flex-1 items-center justify-center rounded-lg border border-ink/15 bg-transparent px-4 py-3 text-small font-medium text-ink no-underline transition-colors hover:bg-ink/5"
          >
            Bloga git
          </Link>
          <Link
            to="/"
            className="inline-flex flex-1 items-center justify-center rounded-lg border border-ink/12 px-4 py-3 text-small font-medium text-app-text-dim no-underline transition-colors hover:bg-ink/5 hover:text-ink"
          >
            Anasayfaya git
          </Link>
        </div>
      </div>
    </AuthShell>
  )
}
