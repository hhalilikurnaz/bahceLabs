import { PanelLeftOpen } from 'lucide-react'
import { useEffect } from 'react'
import { Button } from '@/components/ui'
import { useGardens } from '../../api/useGardens'
import { useBahcemRoute } from '../../hooks/useBahcemRoute'
import { useBahcemStore } from '../../stores/bahcemStore'

/** "Tam harita" açıkken: seçili bahçenin adı ve paneli geri açan düğme (ESC de kapatır). */
export function FullMapBar() {
  const fullMap = useBahcemStore((s) => s.fullMap)
  const setFullMap = useBahcemStore((s) => s.setFullMap)
  const { gardenId } = useBahcemRoute()
  const { data: gardens } = useGardens()
  const garden = gardens?.find((g) => g.id === gardenId)

  useEffect(() => {
    if (!fullMap) return
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setFullMap(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [fullMap, setFullMap])

  if (!fullMap || !garden) return null
  return (
    <div className="surface-dark absolute left-[var(--map-left)] top-3 z-20 flex items-center gap-3 rounded-md border border-app-border bg-app-panel py-1 pl-4 pr-1 shadow-e2" data-testid="full-map-bar">
      <span className="font-display text-lead text-app-text">{garden.ad}</span>
      <Button icon={<PanelLeftOpen className="h-4 w-4" aria-hidden />} onClick={() => setFullMap(false)}>
        Paneli aç
      </Button>
    </div>
  )
}
