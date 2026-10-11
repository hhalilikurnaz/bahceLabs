import { Briefcase, LogOut, Store, Wrench } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button, EmptyState } from '@/components/ui'
import { ComingSoonList } from '../garden-page/ComingSoonList'
import { NotificationPreferences } from '../notifications/NotificationPreferences'
import { NotificationsPanel } from '../notifications/NotificationsPanel'
import { JOBS_ITEMS, MARKET_ITEMS, NOTIFICATION_ITEMS, SERVICES_ITEMS, SETTINGS_ITEMS, type ComingSoonItem } from '../garden-page/comingSoonItems'
import { useAuth } from '@/features/auth/AuthContext'
import type { Section } from '../../lib/routes'

type PlaceholderSection = 'islerim' | 'hizmetler' | 'pazar'

const COPY: Record<PlaceholderSection, { title: string; intro: string; step: string; icon: typeof Store; text: string; items: ComingSoonItem[] }> = {
  islerim: {
    title: 'İşlerim',
    intro: 'Sizin adınıza çalışan yardımcılar.',
    step: 'Faz 1.5',
    icon: Briefcase,
    text: 'Hibe, sertifika, sigorta gibi evrak işlerini sizin için hazırlayan yardımcılar burada olacak.',
    items: JOBS_ITEMS,
  },
  hizmetler: {
    title: 'Hizmetler',
    intro: 'Sahaya gelen ekipler, laboratuvar ve uzman.',
    step: 'Faz 1.5',
    icon: Wrench,
    text: 'İlaçlama, budama, hasat ekibi, analiz ve danışmanlık hizmetlerini buradan isteyeceksiniz.',
    items: SERVICES_ITEMS,
  },
  pazar: {
    title: 'Pazar',
    intro: 'Satış, depo, girdi ve finansman.',
    step: 'Adım 17',
    icon: Store,
    text: 'Hasat sonrası ürününüzü kaydedip depo ve satış durumunu izleyebileceksiniz.',
    items: MARKET_ITEMS,
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
          <NotificationPreferences />
          <ComingSoonList heading="Yakında" items={SETTINGS_ITEMS} />
        </div>
      </div>
    )
  }

  if (section === 'bildirimler') {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <NotificationsPanel />
        <div className="px-4 pb-4">
          <ComingSoonList heading="Yakında" items={NOTIFICATION_ITEMS} />
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
      <div className="min-h-0 flex-1 overflow-y-auto">
        <EmptyState icon={<Icon className="h-7 w-7" strokeWidth={1.5} aria-hidden />} title={`Yakında – ${copy.step}`} description={copy.text} />
        <div className="px-4 pb-4">
          <ComingSoonList heading="Neler gelecek" items={copy.items} />
        </div>
      </div>
    </div>
  )
}
