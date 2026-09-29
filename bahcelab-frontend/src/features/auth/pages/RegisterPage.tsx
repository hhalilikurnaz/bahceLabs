import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { registrationsSoonOnLightClass } from '@/features/marketing/components/registrationsSoonStyles'
import { AuthShell } from '../components/AuthShell'

export function RegisterPage() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/planning', { replace: true })
    }
  }, [isAuthenticated, navigate])

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
            className="font-semibold text-[#0c2418] no-underline underline-offset-2 hover:underline"
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
            className="inline-flex flex-1 items-center justify-center rounded-lg border border-[#0c2418]/15 bg-transparent px-4 py-3 text-[13px] font-medium text-[#0c2418] no-underline transition-colors hover:bg-[#0c2418]/5"
          >
            Bloga git
          </Link>
          <Link
            to="/"
            className="inline-flex flex-1 items-center justify-center rounded-lg border border-[#0c2418]/12 px-4 py-3 text-[13px] font-medium text-[#5c665d] no-underline transition-colors hover:bg-[#0c2418]/5 hover:text-[#0c2418]"
          >
            Anasayfaya git
          </Link>
        </div>
      </div>
    </AuthShell>
  )
}
