import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import {
  AuthShell,
  authFieldClass,
  authLabelClass,
  authPrimaryButtonClass,
} from '../components/AuthShell'

export function RegisterPage() {
  const { register, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/planning', { replace: true })
    }
  }, [isAuthenticated, navigate])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)

    try {
      await register({ name, email, password })
      navigate('/planning', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kayıt tamamlanamadı.')
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthShell
      variant="register"
      title="Kayıt ol"
      subtitle="Ücretsiz hesap oluşturun ve planlamaya başlayın."
      footer={
        <>
          Zaten hesabınız var mı?{' '}
          <Link
            to="/login"
            className="font-semibold text-[#0c2418] no-underline underline-offset-2 hover:underline"
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
            className="rounded-lg border border-red-500/25 bg-red-500/8 px-3.5 py-2.5 text-[13px] text-red-900"
          >
            {error}
          </p>
        )}

        <label className="block">
          <span className={authLabelClass}>Ad Soyad</span>
          <input
            type="text"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={authFieldClass}
            placeholder="Adınız Soyadınız"
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

        <label className="block">
          <span className={authLabelClass}>Şifre</span>
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={authFieldClass}
            placeholder="En az 6 karakter"
          />
        </label>

        <button type="submit" disabled={pending} className={`${authPrimaryButtonClass} mt-2`}>
          {pending ? 'Kayıt oluşturuluyor…' : 'Hesap oluştur'}
        </button>

        <p className="text-center text-[11px] leading-relaxed text-[#5c665d]">
          Hesap bilgileri şimdilik tarayıcınızda saklanır. Sunucu doğrulaması yakında.
        </p>
      </form>
    </AuthShell>
  )
}
