import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, buttonClass } from '@/components/ui'
import { BEKLEME_FORMU_ACIK, MIN_PASSWORD_LENGTH, REGISTRATION_ENABLED } from '../authConfig'
import { authErrorMessage } from '../authErrors'
import { BeklemeFormu } from '../components/BeklemeFormu'
import { PasswordField } from '../components/authForm'
import { AuthShell, authFieldClass, authLabelClass } from '../components/AuthShell'
import { useAuth } from '../useAuth'

const girisBaglantisi = (
  <>
    Zaten hesabınız var mı?{' '}
    <Link to="/login" className="font-semibold text-mk-ink no-underline underline-offset-2 hover:underline">
      Giriş yapın
    </Link>
  </>
)

/** Kayıt açıksa hesap formu; kapalıysa (VITE_REGISTRATION_ENABLED) aynı adres erken erişim (bekleme listesi) formunu gösterir. */
export function RegisterPage() {
  if (!REGISTRATION_ENABLED && !BEKLEME_FORMU_ACIK) {
    return (
      <AuthShell variant="register" title="Erken erişim" subtitle="Başvurular şu an alınmıyor." footer={girisBaglantisi}>
        <div className="space-y-5" role="status" data-testid="bekleme-kapali">
          <p className="text-body leading-relaxed text-mk-body">Erken erişim başvuruları şu an alınmıyor. Yeni yazıları blogda paylaşıyoruz.</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link to="/blog" className={buttonClass({ variant: 'secondary', block: true, className: 'flex-1' })}>Bloga git</Link>
            <Link to="/" className={buttonClass({ variant: 'ghost', block: true, className: 'flex-1' })}>Ana sayfaya git</Link>
          </div>
        </div>
      </AuthShell>
    )
  }
  if (!REGISTRATION_ENABLED) {
    return (
      <AuthShell variant="register" title="Erken erişime katılın" subtitle="Erişim açıldığında size haber verelim." footer={girisBaglantisi}>
        <BeklemeFormu />
      </AuthShell>
    )
  }
  return <HesapFormu />
}

function HesapFormu() {
  const { isAuthenticated, register } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/bahceler', { replace: true })
    }
  }, [isAuthenticated, navigate])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)

    try {
      await register({ name, email, password })
      navigate('/bahceler', { replace: true })
    } catch (err) {
      setError(authErrorMessage(err, 'Kayıt olunamadı.'))
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthShell variant="register" title="Hesap oluştur" subtitle="Bahçelerinizi tek yerden izlemeye başlayın." footer={girisBaglantisi}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && (
          <p role="alert" className="rounded-lg border border-app-danger/25 bg-app-danger/8 px-3.5 py-2.5 text-small text-app-danger">
            {error}
          </p>
        )}

        <label className="block">
          <span className={authLabelClass}>Ad soyad</span>
          <input type="text" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} className={authFieldClass} />
        </label>

        <label className="block">
          <span className={authLabelClass}>E-posta</span>
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={authFieldClass} placeholder="ornek@bahce.com" />
        </label>

        <PasswordField
          label="Şifre"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint={`En az ${MIN_PASSWORD_LENGTH} karakter olmalı.`}
        />

        <Button type="submit" variant="primary" size="lg" block loading={pending} className="mt-2">
          {pending ? 'Hesap oluşturuluyor…' : 'Kayıt ol'}
        </Button>
      </form>
    </AuthShell>
  )
}
