import { Bell, LogOut, Ruler, Store } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, EmptyState } from '@/components/ui'
import { useAuth } from '@/features/auth/AuthContext'
import type { Section } from '../../lib/routes'

const COPY: Record<'pazar' | 'bildirimler', { title: string; intro: string; step: string; icon: typeof Store; text: string }> = {
  pazar: {
    title: 'Pazar & Depo',
    intro: 'Hasat, stok ve satış kayıtlarınız burada olacak.',
    step: 'Adım 17',
    icon: Store,
    text: 'Hasat sonrası ürününüzü kaydedip depo ve satış durumunu izleyebileceksiniz.',
  },
  bildirimler: {
    title: 'Bildirimler',
    intro: 'Uyarılar ve hatırlatmalar tek yerde toplanacak.',
    step: 'Adım 8',
    icon: Bell,
    text: 'Don, sıcak, ilaçlama penceresi ve uydu uyarıları burada listelenecek; okundu işaretleyebileceksiniz.',
  },
}

/** Henüz olmayan bölümler dürüstçe "yakında" der; ölü bağlantı bırakılmaz. */
export function SectionPanel({ section }: { section: Exclude<Section, 'bahceler'> }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  if (section === 'ayarlar') {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="border-b border-app-border px-4 py-4">
          <h2 className="font-display text-h1 text-app-text">Ayarlar</h2>
          <p className="mt-1 text-body text-app-text-muted">Hesabınız ve araçlar</p>
        </header>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {user && (
            <section className="rounded-md border border-app-border bg-app-card p-4" aria-label="Hesap">
              <p className="text-caption font-semibold uppercase tracking-wide text-app-text-dim">Hesap</p>
              <p className="mt-1 text-lead font-semibold text-app-text">{user.name}</p>
              <p className="text-body text-app-text-muted">{user.email}</p>
              <Button
                className="mt-4"
                icon={<LogOut className="h-4 w-4" aria-hidden />}
                onClick={async () => {
                  await logout()
                  navigate('/login', { replace: true })
                }}
              >
                Çıkış yap
              </Button>
            </section>
          )}
          <section className="rounded-md border border-app-border bg-app-card p-4" aria-label="Araçlar">
            <p className="text-caption font-semibold uppercase tracking-wide text-app-text-dim">Araçlar</p>
            <Link
              to="/planning"
              className="mt-2 flex min-h-11 items-center gap-3 rounded-md text-body font-medium text-app-text no-underline hover:text-app-accent"
            >
              <Ruler className="h-5 w-5 text-app-accent" aria-hidden />
              Dikim planlama simülasyonu
            </Link>
          </section>
          <p className="px-1 text-caption text-app-text-dim">Çoklu kullanıcı ve hesap ayarları Adım 19'da gelecek.</p>
        </div>
      </div>
    )
  }

  const copy = COPY[section]
  const Icon = copy.icon
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-b border-app-border px-4 py-4">
        <h2 className="font-display text-h1 text-app-text">{copy.title}</h2>
        <p className="mt-1 text-body text-app-text-muted">{copy.intro}</p>
      </header>
      <EmptyState
        className="flex-1 justify-center"
        icon={<Icon className="h-7 w-7" strokeWidth={1.5} aria-hidden />}
        title={`Yakında – ${copy.step}`}
        description={copy.text}
      />
    </div>
  )
}
