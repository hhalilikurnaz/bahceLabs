import { Bell, LogOut, Moon, Search, Settings, Sun } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { useUnreadPoll } from '../api/notificationsApi'
import { NotificationsPanel } from '../components/notifications/NotificationsPanel'
import { badgeText } from '../lib/notifications'
import { NAV_ITEMS, SETTINGS_PATH } from '../lib/routes'
import { Logo } from '../varliklar/varliklar'
import { useTema } from './tema'

function useDisari<T extends HTMLElement>(open: boolean, close: () => void) {
  const ref = useRef<T>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && close()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close])
  return ref
}

const initials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toLocaleUpperCase('tr-TR')
}

/** Üst gezinme: Bahçeler · Asistan · İşlerim · Hizmetler · Pazar · ⌘K · bildirim · tema · hesap. Copilot düğmesi yoktur (Asistan ve ⌘K). */
export function UstGezinme({ onKomut }: { onKomut: () => void }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { tema, degistir } = useTema()
  const unread = useUnreadPoll().data?.okunmamis ?? 0
  const [bildirim, setBildirim] = useState(false)
  const [hesap, setHesap] = useState(false)
  const bRef = useDisari<HTMLDivElement>(bildirim, () => setBildirim(false))
  const hRef = useDisari<HTMLDivElement>(hesap, () => setHesap(false))
  const icon = 'relative grid shrink-0 h-9 w-9 max-[560px]:h-11 max-[560px]:w-11 place-items-center rounded-md border border-transparent text-app-text hover:border-app-border'

  return (
    <header className="flex h-14 shrink-0 items-center gap-5 border-b border-app-border bg-app-panel px-5 max-[560px]:gap-2.5 max-[560px]:px-3">
      <NavLink to="/bahceler" className="flex items-center justify-center gap-2.5 whitespace-nowrap text-[16px] max-[560px]:h-11 max-[560px]:w-11 font-semibold tracking-tight text-app-text" aria-label="BahçeLab">
        <Logo size={30} />
        <span className="max-[560px]:hidden">BahçeLab</span>
      </NavLink>
      <nav aria-label="Ana gezinme" className="flex min-w-0 gap-0.5 overflow-x-auto [scrollbar-width:none]">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.key}
            to={item.path}
            className={({ isActive }) =>
              `relative flex h-14 items-center gap-1.5 whitespace-nowrap px-3 text-[14px] font-medium ${isActive ? 'text-app-text after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-app-primary' : 'text-app-text-muted hover:text-app-text'}`
            }
          >
            {item.label}
            {item.soon && <span className="rounded-[2px] border border-app-border px-1 text-[9.5px] font-medium text-app-text-dim">{item.soon}</span>}
          </NavLink>
        ))}
      </nav>
      <span className="flex-1" />
      <button type="button" onClick={onKomut} aria-label="Ara veya sor" data-testid="komut-ac" className="flex h-9 max-[900px]:h-11 shrink-0 w-[300px] max-w-[32vw] items-center gap-2.5 rounded-md border border-app-border bg-app-bg px-2.5 text-left text-app-text-muted max-[900px]:w-11 max-[900px]:min-w-11 max-[900px]:justify-center">
        <Search className="h-4 w-4 shrink-0" aria-hidden />
        <span className="flex-1 truncate text-[13px] max-[900px]:hidden">Ara veya sor — “zayıf bölgeleri göster”</span>
        <kbd className="rounded-[2px] border border-app-border bg-app-panel px-1.5 text-[10.5px] max-[900px]:hidden">⌘K</kbd>
      </button>
      <div ref={bRef} className="relative shrink-0">
        <button type="button" className={icon} aria-label={`Bildirimler${unread ? `, ${unread} okunmamış` : ''}`} aria-expanded={bildirim} onClick={() => setBildirim(!bildirim)} data-testid="bildirim-ac">
          <Bell className="h-[19px] w-[19px]" strokeWidth={1.5} aria-hidden />
          {unread > 0 && <span data-testid="unread-badge" className="num absolute right-0.5 top-0.5 min-w-[15px] rounded-full bg-app-warn px-1 text-center text-[9.5px] font-semibold leading-[15px] text-white">{badgeText(unread)}</span>}
        </button>
        {bildirim && (
          <div className="glass absolute right-0 top-11 z-40 flex max-h-[min(640px,80vh)] w-[420px] max-w-[calc(100vw-24px)] flex-col overflow-hidden">
            <NotificationsPanel onNavigate={() => setBildirim(false)} />
          </div>
        )}
      </div>
      <button type="button" className={icon} aria-label={tema === 'koyu' ? 'Açık temaya geç' : 'Koyu temaya geç'} onClick={degistir} data-testid="tema">
        {tema === 'koyu' ? <Sun className="h-[19px] w-[19px]" strokeWidth={1.5} aria-hidden /> : <Moon className="h-[19px] w-[19px]" strokeWidth={1.5} aria-hidden />}
      </button>
      <div ref={hRef} className="relative shrink-0">
        <button type="button" onClick={() => setHesap(!hesap)} aria-expanded={hesap} aria-label={`Hesap: ${user?.name ?? ''}`} className="grid h-8 w-8 shrink-0 max-[560px]:h-11 max-[560px]:w-11 place-items-center rounded-full bg-app-card-hover text-[12px] font-semibold">
          {initials(user?.name ?? '?')}
        </button>
        {hesap && (
          <div className="glass absolute right-0 top-11 z-40 w-56 p-1.5" role="menu">
            <div className="px-2.5 py-2 text-[12.5px]"><b className="block">{user?.name}</b><span className="text-app-text-muted">{user?.email}</span></div>
            <button role="menuitem" type="button" onClick={() => (setHesap(false), navigate(SETTINGS_PATH))} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] hover:bg-app-card-hover"><Settings className="h-4 w-4" aria-hidden /> Ayarlar</button>
            <button role="menuitem" type="button" onClick={async () => { await logout(); navigate('/login', { replace: true }) }} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] hover:bg-app-card-hover"><LogOut className="h-4 w-4" aria-hidden /> Çıkış yap</button>
          </div>
        )}
      </div>
    </header>
  )
}
