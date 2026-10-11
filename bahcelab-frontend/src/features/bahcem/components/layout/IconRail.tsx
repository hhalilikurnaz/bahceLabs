import { Bell, Settings, Store, Trees, type LucideIcon } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { BrandMark, Tooltip, cx } from '@/components/ui'
import { useAuth } from '@/features/auth/AuthContext'
import { useUnreadPoll } from '../../api/notificationsApi'
import { useBahcemRoute } from '../../hooks/useBahcemRoute'
import { badgeText } from '../../lib/notifications'
import { SECTION_PATHS, type Section } from '../../lib/routes'
import { useBahcemStore } from '../../stores/bahcemStore'

const ITEMS: { section: Section; label: string; icon: LucideIcon }[] = [
  { section: 'bahceler', label: 'Bahçelerim', icon: Trees },
  { section: 'pazar', label: 'Pazar & Depo', icon: Store },
  { section: 'bildirimler', label: 'Bildirimler', icon: Bell },
]

const itemBase =
  'group relative flex h-11 w-11 items-center justify-center rounded-md text-app-text-muted transition-colors duration-[var(--duration-fast)] hover:bg-app-card-hover hover:text-app-text'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return (parts[0]?.[0] ?? '?').concat(parts.length > 1 ? parts[parts.length - 1][0] : '').toLocaleUpperCase('tr-TR')
}

/** Sol menü: Bahçelerim · Pazar & Depo · Bildirimler · Ayarlar. Koyu orman zemini (harita denetimleriyle aynı yüzey). */
export function IconRail() {
  const { section, gardenId } = useBahcemRoute()
  const unread = useUnreadPoll().data?.okunmamis ?? 0
  const setAutoCollapse = useBahcemStore((s) => s.setListAutoCollapse)
  const { user } = useAuth()
  const panelOpen = useBahcemStore((s) => s.leftPanelOpen)
  const togglePanel = useBahcemStore((s) => s.toggleLeftPanel)
  const setPanelOpen = useBahcemStore((s) => s.setLeftPanelOpen)

  return (
    <nav
      aria-label="Ana gezinme"
      className="surface-dark absolute inset-y-0 left-0 z-30 flex w-14 flex-col items-center border-r border-app-border bg-app-panel py-3"
    >
      <span className="mb-4 flex h-11 w-11 items-center justify-center">
        <BrandMark size={30} />
      </span>

      <div className="flex flex-col items-center gap-1.5">
        {ITEMS.map(({ section: target, label, icon: Icon }) => {
          const active = section === target
          return (
            <Tooltip key={target} label={label}>
              <NavLink
                to={SECTION_PATHS[target]}
                end={target === 'bahceler' ? false : true}
                aria-label={label}
                aria-current={active ? 'page' : undefined}
                onClick={(event) => {
                  if (target === 'bahceler' && active && gardenId) {
                    // Bahçe açıkken listeye basmak yalnızca listeyi açar/kapatır (bahçeden çıkmaz); seçim hatırlanır
                    event.preventDefault()
                    setAutoCollapse(panelOpen) // açıksa kapatılıyor → bir dahaki bahçede daralsın; kapalıysa açılıyor → açık kalsın
                    togglePanel()
                  } else if (active && target === 'bahceler') togglePanel()
                  else setPanelOpen(true)
                }}
                className={cx(itemBase, active && 'bg-app-accent-soft text-app-accent hover:bg-app-accent-soft hover:text-app-accent')}
              >
                {active && panelOpen && <span className="absolute -left-2 h-6 w-1 rounded-r-full bg-lemon" aria-hidden />}
                <Icon className="h-[22px] w-[22px]" strokeWidth={1.75} aria-hidden />
                {target === 'bildirimler' && unread > 0 && (
                  <span data-testid="unread-badge" className="absolute -right-1 -top-1 flex min-w-[18px] items-center justify-center rounded-full bg-app-danger px-1 text-[11px] font-bold leading-[18px] text-white">
                    {badgeText(unread)}
                    <span className="sr-only"> okunmamış bildirim</span>
                  </span>
                )}
              </NavLink>
            </Tooltip>
          )
        })}
      </div>

      <div className="mt-auto flex flex-col items-center gap-1.5">
        <Tooltip label="Ayarlar">
          <NavLink
            to={SECTION_PATHS.ayarlar}
            aria-label="Ayarlar"
            aria-current={section === 'ayarlar' ? 'page' : undefined}
            onClick={() => setPanelOpen(true)}
            className={cx(itemBase, section === 'ayarlar' && 'bg-app-accent-soft text-app-accent')}
          >
            <Settings className="h-[22px] w-[22px]" strokeWidth={1.75} aria-hidden />
          </NavLink>
        </Tooltip>
        {user && (
          <span
            aria-hidden
            className="flex h-9 w-9 items-center justify-center rounded-full bg-app-card text-caption font-semibold text-app-text ring-1 ring-app-border"
          >
            {initials(user.name)}
          </span>
        )}
      </div>
    </nav>
  )
}
