import { useEffect, useRef, useState } from 'react'
import { MoreHorizontal, Pencil, Trash2, Spline } from 'lucide-react'
import type { Garden } from '../../api/types'
import { formatDecare, largestOuterRing, silhouettePath } from '../../lib/geo'

export interface GardenListItemProps {
  garden: Garden
  selected?: boolean
  /** Son geçerli NDVI ortalaması (Adım 5); yoksa gösterilmez */
  ndvi?: number | null
  onSelect: (garden: Garden) => void
  onRename: (garden: Garden, name: string) => Promise<void>
  onEditBoundary: (garden: Garden) => void
  onDelete: (garden: Garden) => void
}

function NdviBadge({ value }: { value: number | null | undefined }) {
  if (value == null) {
    return (
      <span className="rounded-md bg-app-bg/60 px-2 py-0.5 text-[11px] font-medium text-app-text-dim">
        NDVI —
      </span>
    )
  }
  return (
    <span className="rounded-md bg-app-accent-soft px-2 py-0.5 text-[11px] font-semibold text-app-accent">
      NDVI {value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
  )
}

export function GardenListItem({
  garden,
  selected = false,
  ndvi,
  onSelect,
  onRename,
  onEditBoundary,
  onDelete,
}: GardenListItemProps) {
  const rowRef = useRef<HTMLLIElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [draftName, setDraftName] = useState(garden.ad)
  const [saving, setSaving] = useState(false)

  const path = silhouettePath(largestOuterRing(garden.geometry))

  // Haritadan seçilince listede görünür kıl
  useEffect(() => {
    if (selected) rowRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selected])

  useEffect(() => {
    if (!menuOpen) return
    const onPointer = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  async function commitRename() {
    const name = draftName.trim()
    if (!name || name === garden.ad) {
      setRenaming(false)
      setDraftName(garden.ad)
      return
    }
    setSaving(true)
    try {
      await onRename(garden, name)
      setRenaming(false)
    } finally {
      setSaving(false)
    }
  }

  const menuItem =
    'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] transition-colors hover:bg-app-card'

  return (
    <li
      ref={rowRef}
      className={`relative flex items-center gap-1 rounded-xl border pr-1.5 transition-colors ${
        selected
          ? 'border-app-accent/50 bg-app-card-hover'
          : 'border-transparent bg-app-card hover:bg-app-card-hover'
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3 p-2.5">
        <svg viewBox="0 0 40 40" className="h-12 w-12 shrink-0 rounded-lg bg-app-bg/70" aria-hidden>
          {path && (
            <path d={path} className="fill-app-accent/25 stroke-app-accent" strokeWidth={1.5} strokeLinejoin="round" />
          )}
        </svg>

        {renaming ? (
          <input
            autoFocus
            value={draftName}
            disabled={saving}
            maxLength={120}
            aria-label="Bahçe adı"
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void commitRename()
              if (e.key === 'Escape') {
                setRenaming(false)
                setDraftName(garden.ad)
              }
            }}
            className="h-9 min-w-0 flex-1 rounded-lg border border-app-accent bg-app-bg/70 px-2.5 text-[14px] text-app-text outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => onSelect(garden)}
            aria-current={selected}
            className="min-w-0 flex-1 text-left focus-visible:outline-2 focus-visible:outline-app-accent"
          >
            <span className="block truncate text-[14px] font-medium text-app-text">{garden.ad}</span>
            <span className="mt-1 flex items-center gap-2">
              <span className="text-[12px] text-app-text-muted">{formatDecare(garden.alanDekar)}</span>
              <NdviBadge value={ndvi} />
            </span>
          </button>
        )}
      </div>

      <div ref={menuRef} className="relative">
        <button
          type="button"
          aria-label={`${garden.ad} işlemleri`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-app-text-muted transition-colors hover:bg-app-bg/60 hover:text-app-text focus-visible:outline-2 focus-visible:outline-app-accent"
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden />
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full z-30 mt-1 w-48 rounded-xl border border-app-border bg-app-panel p-1 shadow-2xl"
          >
            <button
              type="button"
              role="menuitem"
              className={`${menuItem} text-app-text`}
              onClick={() => {
                setMenuOpen(false)
                setDraftName(garden.ad)
                setRenaming(true)
              }}
            >
              <Pencil className="h-4 w-4 text-app-text-muted" aria-hidden />
              Adını düzenle
            </button>
            <button
              type="button"
              role="menuitem"
              className={`${menuItem} text-app-text`}
              onClick={() => {
                setMenuOpen(false)
                onEditBoundary(garden)
              }}
            >
              <Spline className="h-4 w-4 text-app-text-muted" aria-hidden />
              Sınırı düzenle
            </button>
            <button
              type="button"
              role="menuitem"
              className={`${menuItem} text-app-danger`}
              onClick={() => {
                setMenuOpen(false)
                onDelete(garden)
              }}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              Sil
            </button>
          </div>
        )}
      </div>
    </li>
  )
}
