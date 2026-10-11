import { useGardens } from '../../api/useGardens'
import { useBahcemRoute } from '../../hooks/useBahcemRoute'
import { usePanelLayout } from '../../hooks/usePanelLayout'
import { useBahcemStore } from '../../stores/bahcemStore'
import { GardenForm } from '../garden/GardenForm'
import { GardenListPanel } from '../garden/GardenListPanel'
import { ImportPicker } from '../garden/ImportPicker'
import { GardenPage } from '../garden-page/GardenPage'
import { SectionPanel } from './SectionPanel'
import { Skeleton } from '@/components/ui'

/** Bahçe sayfası açılırken (bahçe verisi gelene kadar) panel iskeletle hemen görünür. */
function PanelSkeleton() {
  return (
    <div className="space-y-3 p-4" aria-busy aria-label="Yükleniyor">
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-11" />
      <Skeleton className="h-40" />
      <Skeleton className="h-40" />
    </div>
  )
}

/** Sol panel: liste, bahçe sayfası (geniş), bölümler ve bahçe ekleme/düzenleme formları. Genişliği `--panel-w`. */
export function LeftPanel() {
  const mode = useBahcemStore((s) => s.mode)
  const { section, gardenId } = useBahcemRoute()
  const { kind } = usePanelLayout()
  const { data: gardens, isLoading } = useGardens()
  const selected = gardenId ? gardens?.find((g) => g.id === gardenId) : undefined
  const open = kind !== 'collapsed'

  let content
  if (mode === 'form') content = <GardenForm />
  else if (mode === 'import-pick') content = <ImportPicker />
  else if (section !== 'bahceler') content = <SectionPanel section={section} />
  else if (gardenId && mode === 'idle') content = selected ? <GardenPage key={selected.id} garden={selected} /> : isLoading ? <PanelSkeleton /> : <GardenListPanel />
  else content = <GardenListPanel />

  return (
    <aside
      aria-label={section === 'bahceler' ? 'Bahçeler' : 'Bölüm paneli'}
      aria-hidden={!open}
      inert={!open}
      data-testid="left-panel"
      data-kind={kind}
      style={{ width: 'var(--panel-w)' }}
      className={`absolute bottom-16 left-[calc(var(--rail-w)+0.75rem)] top-[4.25rem] z-20 md:bottom-3 md:top-3 flex flex-col overflow-hidden rounded-lg border border-app-border bg-app-panel shadow-e3 transition-[width,opacity,transform] duration-[var(--duration-panel)] ease-[var(--ease-out-soft)] ${
        open ? 'translate-x-0 opacity-100' : 'pointer-events-none -translate-x-6 opacity-0'
      }`}
    >
      {content}
    </aside>
  )
}
