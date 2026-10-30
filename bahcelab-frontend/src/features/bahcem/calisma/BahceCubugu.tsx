import { ChevronDown, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { TextField } from '@/components/ui'
import type { Garden } from '../api/types'
import { GardenActionsMenu } from '../components/garden/GardenActionsMenu'
import { GardenInfoDialog } from '../components/garden/GardenInfoDialog'
import { useGardenActions } from '../components/garden/useGardenActions'
import { PRODUCTS } from '../api/types'
import { dekar } from '../lib/format'
import { GARDEN_TABS, GARDEN_TAB_LABELS, NEW_GARDEN_PATH, gardenPagePath, gardenPath, type GardenTab } from '../lib/routes'

const urunAdi = (v: string) => PRODUCTS.find((p) => p.value === v)?.label ?? v
const meta = (g: Garden) => [urunAdi(g.urun), g.cesit, dekar(g.alanDekar), [g.ilce, g.il].filter(Boolean).join(', ')].filter(Boolean).join(' · ')

/** Bahçe çubuğu: bahçe seçici (ad · ürün · dekar · konum) · sekmeler · «Saha Defteri ↗». */
export function BahceCubugu({ garden, gardens, tab }: { garden: Garden; gardens: Garden[]; tab: GardenTab | null }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const actions = useGardenActions()
  const [renaming, setRenaming] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [name, setName] = useState(garden.ad)
  const commit = async () => {
    const next = name.trim()
    if (next && next !== garden.ad) {
      try {
        await actions.rename(garden, next)
      } catch {
        return
      }
    }
    setRenaming(false)
  }
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  return (
    <div className="flex h-[52px] shrink-0 items-center gap-[18px] overflow-x-auto border-b border-app-border bg-app-panel px-5 [scrollbar-width:none] max-[560px]:h-auto max-[560px]:flex-wrap max-[560px]:gap-x-3 max-[560px]:gap-y-1 max-[560px]:px-3 max-[560px]:pt-2.5">
      <div ref={box} className="relative shrink-0">
        {renaming ? (
          <TextField label="Bahçe adı" hideLabel autoFocus value={name} maxLength={120} onChange={(e) => setName(e.target.value)} onBlur={() => void commit()} onKeyDown={(e) => { if (e.key === 'Enter') void commit(); if (e.key === 'Escape') { setName(garden.ad); setRenaming(false) } }} />
        ) : (
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="listbox" data-testid="bahce-secici" className="flex items-center gap-2.5 whitespace-nowrap text-left max-[560px]:min-h-11">
          <b className="text-[19px] font-bold leading-none tracking-tight">{garden.ad}</b>
          <span className="text-[12px] text-app-text-muted max-[560px]:hidden">{meta(garden)}</span>
          <ChevronDown className="h-4 w-4 text-app-text-muted" aria-hidden />
        </button>
        )}
        {open && (
          <div role="listbox" aria-label="Bahçeler" className="glass fixed z-40 mt-2 w-[360px] max-w-[calc(100vw-24px)] p-1.5">
            {gardens.map((g) => (
              <button key={g.id} role="option" aria-selected={g.id === garden.id} type="button" onClick={() => (setOpen(false), navigate(gardenPath(g.id, tab ?? 'durum')))} className={`block w-full rounded-md px-3 py-2 text-left hover:bg-app-card-hover ${g.id === garden.id ? 'bg-app-card-hover' : ''}`}>
                <b className="block text-[14px]">{g.ad}</b>
                <span className="text-caption text-app-text-muted">{meta(g)}</span>
              </button>
            ))}
            <Link to={NEW_GARDEN_PATH} onClick={() => setOpen(false)} className="mt-1 flex items-center gap-2 rounded-md border-t border-app-border px-3 py-2.5 text-[13px] font-semibold hover:bg-app-card-hover">
              <Plus className="h-4 w-4" aria-hidden /> Bahçe ekle
            </Link>
          </div>
        )}
      </div>
      <nav role="tablist" aria-label="Bahçe sekmeleri" className="flex h-[52px] gap-0.5 max-[560px]:order-3 max-[560px]:h-11 max-[560px]:w-full max-[560px]:overflow-x-auto max-[560px]:[scrollbar-width:none]">
        {GARDEN_TABS.map((t) => (
          <NavLink
            key={t}
            to={gardenPath(garden.id, t)}
            end
            role="tab"
            aria-selected={tab === t}
            className={`relative flex shrink-0 items-center whitespace-nowrap px-3 text-[14px] font-medium max-[560px]:min-h-11 ${tab === t ? 'text-app-text after:absolute after:inset-x-3 after:-bottom-px after:h-[3px] after:bg-app-text' : 'text-app-text-muted hover:text-app-text'}`}
          >
            {GARDEN_TAB_LABELS[t]}
          </NavLink>
        ))}
      </nav>
      <span className="flex-1 max-[560px]:hidden" />
      <GardenActionsMenu garden={garden} onRename={() => (setName(garden.ad), setRenaming(true))} onEditInfo={() => setInfoOpen(true)} onEditBoundary={() => { navigate(gardenPath(garden.id)); actions.editBoundary(garden) }} onDelete={() => actions.requestDelete(garden)} />
      {actions.dialog}
      {infoOpen && <GardenInfoDialog garden={garden} onClose={() => setInfoOpen(false)} />}
      <Link to={gardenPagePath(garden.id, 'defter')} className="flex h-8 max-[560px]:h-11 shrink-0 items-center rounded-md border border-app-border px-3 text-small font-semibold hover:border-app-text max-[560px]:ml-auto">
        Saha Defteri ↗
      </Link>
    </div>
  )
}
