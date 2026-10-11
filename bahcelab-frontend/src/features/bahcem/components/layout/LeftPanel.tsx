import { useBahcemRoute } from '../../hooks/useBahcemRoute'
import { usePanelLayout } from '../../hooks/usePanelLayout'
import { useBahcemStore } from '../../stores/bahcemStore'
import { GardenForm } from '../garden/GardenForm'
import { GardenListPanel } from '../garden/GardenListPanel'
import { ImportPicker } from '../garden/ImportPicker'
import { SectionPanel } from './SectionPanel'

/** Sol panel: bahçe listesi, bölümler (Pazar, Bildirimler, Ayarlar) ve bahçe ekleme/düzenleme formları. Genişliği `--list-w`. */
export function LeftPanel() {
  const mode = useBahcemStore((s) => s.mode)
  const { section } = useBahcemRoute()
  const { listOpen } = usePanelLayout()

  let content
  if (mode === 'form') content = <GardenForm />
  else if (mode === 'import-pick') content = <ImportPicker />
  else if (section !== 'bahceler') content = <SectionPanel section={section} />
  else content = <GardenListPanel />

  return (
    <aside
      aria-label={section === 'bahceler' ? 'Bahçeler' : 'Bölüm paneli'}
      aria-hidden={!listOpen}
      inert={!listOpen}
      data-testid="left-panel"
      data-open={listOpen}
      style={{ width: 'var(--list-w)' }}
      className={`absolute bottom-16 left-[calc(var(--rail-w)+0.75rem)] top-[4.25rem] z-20 flex flex-col overflow-hidden rounded-lg border border-app-border bg-app-panel shadow-e3 transition-[width,opacity,transform] duration-[var(--duration-panel)] ease-[var(--ease-out-soft)] md:bottom-3 md:top-3 ${
        listOpen ? 'translate-x-0 opacity-100' : 'pointer-events-none -translate-x-6 opacity-0'
      }`}
    >
      {content}
    </aside>
  )
}
