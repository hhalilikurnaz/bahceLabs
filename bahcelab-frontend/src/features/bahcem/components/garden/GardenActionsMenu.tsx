import { ClipboardList, MoreHorizontal, Pencil, Spline, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { IconButton, cx } from '@/components/ui'
import type { Garden } from '../../api/types'

interface GardenActionsMenuProps {
  garden: Pick<Garden, 'ad'>
  onRename: () => void
  /** Çeşit, dikim yılı, ağaç sayısı, sulama sistemi */
  onEditInfo?: () => void
  onEditBoundary: () => void
  onDelete: () => void
  className?: string
}

const ITEM =
  'flex min-h-11 w-full items-center gap-2.5 rounded-sm px-3 text-left text-body transition-colors hover:bg-app-card-hover focus-visible:bg-app-card-hover'

/** Bahçe işlemleri menüsü (liste kartı ve bahçe sayfası başlığı ortak kullanır). */
export function GardenActionsMenu({ garden, onRename, onEditInfo, onEditBoundary, onDelete, className }: GardenActionsMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    rootRef.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus()
    const onPointer = (event: PointerEvent) => !rootRef.current?.contains(event.target as Node) && setOpen(false)
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const run = (action: () => void) => () => {
    setOpen(false)
    action()
  }

  return (
    <div ref={rootRef} className={className ?? 'relative'}>
      <IconButton label={`${garden.ad} işlemleri`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <MoreHorizontal className="h-5 w-5" aria-hidden />
      </IconButton>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-1 w-52 rounded-md border border-app-border bg-app-panel p-1 shadow-e3">
          <button type="button" role="menuitem" className={cx(ITEM, 'text-app-text')} onClick={run(onRename)}>
            <Pencil className="h-4 w-4 text-app-text-muted" aria-hidden /> Adını düzenle
          </button>
          {onEditInfo && (
            <button type="button" role="menuitem" className={cx(ITEM, 'text-app-text')} onClick={run(onEditInfo)}>
              <ClipboardList className="h-4 w-4 text-app-text-muted" aria-hidden /> Bilgileri düzenle
            </button>
          )}
          <button type="button" role="menuitem" className={cx(ITEM, 'text-app-text')} onClick={run(onEditBoundary)}>
            <Spline className="h-4 w-4 text-app-text-muted" aria-hidden /> Sınırı düzenle
          </button>
          <button type="button" role="menuitem" className={cx(ITEM, 'text-app-danger')} onClick={run(onDelete)}>
            <Trash2 className="h-4 w-4" aria-hidden /> Sil
          </button>
        </div>
      )}
    </div>
  )
}
