import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CloudSun, FileText, Leaf, LogOut, NotebookPen, Ruler, Trees, type LucideIcon } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'
import { useBahcemStore } from '../../stores/bahcemStore'
import { useToast } from './toastContext'

const itemBase =
  'group relative flex h-10 w-10 items-center justify-center rounded-xl text-app-text-muted transition-colors hover:bg-app-card hover:text-app-text focus-visible:outline-2 focus-visible:outline-app-accent'
const itemActive = 'bg-app-accent-soft text-app-accent hover:bg-app-accent-soft hover:text-app-accent'

function Tooltip({ label }: { label: string }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute left-full z-40 ml-3 whitespace-nowrap rounded-lg border border-app-border bg-app-card px-2.5 py-1.5 text-[12px] text-app-text opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
    >
      {label}
    </span>
  )
}

interface RailButtonProps {
  icon: LucideIcon
  label: string
  active?: boolean
  onClick: () => void
}

function RailButton({ icon: Icon, label, active = false, onClick }: RailButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={`${itemBase} ${active ? itemActive : ''}`}
    >
      {active && <span className="absolute -left-2 h-5 w-1 rounded-r-full bg-app-accent" aria-hidden />}
      <Icon className="h-[20px] w-[20px]" strokeWidth={1.75} aria-hidden />
      <Tooltip label={label} />
    </button>
  )
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return (parts[0]?.[0] ?? '?').concat(parts.length > 1 ? parts[parts.length - 1][0] : '').toLocaleUpperCase('tr-TR')
}

function UserMenu() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  if (!user) return null

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Hesap menüsü"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-app-card text-[12px] font-semibold text-app-text ring-1 ring-app-border transition-colors hover:bg-app-card-hover focus-visible:outline-2 focus-visible:outline-app-accent"
      >
        {initials(user.name)}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute bottom-0 left-full z-40 ml-3 w-64 rounded-2xl border border-app-border bg-app-panel p-2 shadow-2xl"
        >
          <div className="px-3 py-2.5">
            <p className="truncate text-[14px] font-semibold text-app-text">{user.name}</p>
            <p className="truncate text-[12px] text-app-text-muted">{user.email}</p>
          </div>
          <div className="my-1 h-px bg-app-border" />
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] text-app-text-muted transition-colors hover:bg-app-card hover:text-app-text"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            Çıkış yap
          </button>
        </div>
      )}
    </div>
  )
}

export function IconRail() {
  const panelOpen = useBahcemStore((s) => s.leftPanelOpen)
  const togglePanel = useBahcemStore((s) => s.toggleLeftPanel)
  const toast = useToast()

  const soon = (label: string) => () => toast.show(`${label} sonraki adımlarda gelecek.`)

  return (
    <nav
      aria-label="Ana gezinme"
      className="absolute inset-y-0 left-0 z-30 flex w-14 flex-col items-center border-r border-app-border bg-app-panel py-3"
    >
      <Link
        to="/bahcem"
        aria-label="BahçeLab"
        className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-app-accent-soft text-app-accent no-underline"
      >
        <Leaf className="h-5 w-5" strokeWidth={1.9} aria-hidden />
      </Link>

      <div className="flex flex-col items-center gap-1.5">
        <RailButton icon={Trees} label="Bahçeler" active={panelOpen} onClick={togglePanel} />
        <RailButton icon={CloudSun} label="Hava durumu" onClick={soon('Hava durumu')} />
        <RailButton icon={NotebookPen} label="Günlük" onClick={soon('Günlük')} />
        <RailButton icon={FileText} label="Raporlar" onClick={soon('Raporlar')} />
        <Link to="/planning" aria-label="Planlama" className={`${itemBase} no-underline`}>
          <Ruler className="h-[20px] w-[20px]" strokeWidth={1.75} aria-hidden />
          <Tooltip label="Planlama" />
        </Link>
      </div>

      <div className="mt-auto">
        <UserMenu />
      </div>
    </nav>
  )
}
