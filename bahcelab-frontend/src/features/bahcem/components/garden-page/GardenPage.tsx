import { ArrowLeft, Maximize2, X } from 'lucide-react'
import { useState } from 'react'
import { Button, IconButton, Tabs, TextField } from '@/components/ui'
import { useGardensOverview } from '../../api/overviewApi'
import { PRODUCTS, type Garden } from '../../api/types'
import { useBahcemRoute } from '../../hooks/useBahcemRoute'
import { useGardenNav } from '../../hooks/useGardenNav'
import { formatDecare } from '../../lib/geo'
import { GARDEN_TAB_LABELS, GARDEN_TABS, gardenPath } from '../../lib/routes'
import { useBahcemStore } from '../../stores/bahcemStore'
import { GardenActionsMenu } from '../garden/GardenActionsMenu'
import { StatusBadge } from '../garden/StatusBadge'
import { useGardenActions } from '../garden/useGardenActions'
import { WeatherTab } from '../hava/WeatherTab'
import { AnalysisTab } from './AnalysisTab'
import { ComingSoonList } from './ComingSoonList'
import { JOURNAL_ITEMS, REPORT_ITEMS } from './comingSoonItems'
import { StatusTab } from './StatusTab'

const productLabel = (value: string): string => PRODUCTS.find((p) => p.value === value)?.label ?? value

/** Bahçe sayfası (geniş panel): başlık, durum, sekmeler (Durum · Analiz · Hava · Günlük · Rapor). */
export function GardenPage({ garden }: { garden: Garden }) {
  const { close } = useGardenNav()
  const { tab } = useBahcemRoute()
  const setFullMap = useBahcemStore((s) => s.setFullMap)
  const actions = useGardenActions()
  const overview = useGardensOverview()
  const status = overview.data?.bahceler.find((g) => g.id === garden.id)?.durum
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(garden.ad)

  const subtitle = [productLabel(garden.urun), garden.cesit, formatDecare(garden.alanDekar), [garden.ilce, garden.il].filter(Boolean).join(', ')]
    .filter(Boolean)
    .join(' · ')

  async function commitRename() {
    const next = name.trim()
    if (next && next !== garden.ad) {
      try {
        await actions.rename(garden, next)
      } catch {
        return // hata bildirimi `rename` içinde gösterilir
      }
    }
    setRenaming(false)
  }

  return (
    <div className="@container flex min-h-0 flex-1 flex-col" data-testid="garden-page">
      <header className="border-b border-app-border">
        <div className="flex items-start gap-2 px-3 pt-3 min-[1180px]:pl-4">
          <div className="min-[1180px]:hidden">
            <IconButton label="Bahçe listesine dön" onClick={close}>
              <ArrowLeft className="h-5 w-5" aria-hidden />
            </IconButton>
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            {renaming ? (
              <TextField
                label="Bahçe adı"
                hideLabel
                autoFocus
                value={name}
                maxLength={120}
                onChange={(event) => setName(event.target.value)}
                onBlur={() => void commitRename()}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void commitRename()
                  if (event.key === 'Escape') {
                    setName(garden.ad)
                    setRenaming(false)
                  }
                }}
              />
            ) : (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h2 className="truncate font-display text-h1 text-app-text">{garden.ad}</h2>
                {status && <StatusBadge status={status} />}
              </div>
            )}
            <p className="mt-0.5 truncate text-small text-app-text-muted">{subtitle}</p>
          </div>
          <div className="hidden shrink-0 @lg:block">
            <Button icon={<Maximize2 className="h-4 w-4" aria-hidden />} onClick={() => setFullMap(true)}>
              Tam harita
            </Button>
          </div>
          <GardenActionsMenu
            garden={garden}
            onRename={() => {
              setName(garden.ad)
              setRenaming(true)
            }}
            onEditBoundary={() => actions.editBoundary(garden)}
            onDelete={() => actions.requestDelete(garden)}
          />
          <div className="hidden min-[1180px]:block">
            <IconButton label="Bahçe panelini kapat" onClick={close}>
              <X className="h-5 w-5" aria-hidden />
            </IconButton>
          </div>
        </div>
        <Tabs
          label="Bahçe bilgileri"
          idPrefix="garden"
          value={tab}
          items={GARDEN_TABS.map((id) => ({ id, label: GARDEN_TAB_LABELS[id], to: gardenPath(garden.id, id) }))}
          className="px-3"
        />
      </header>

      <div
        id={`garden-panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`garden-tab-${tab}`}
        className="min-h-0 flex-1 overflow-y-auto bg-app-bg p-3"
        data-testid="detail-panel"
      >
        {tab === 'durum' && <StatusTab garden={garden} />}
        {tab === 'analiz' && <AnalysisTab gardenId={garden.id} />}
        {tab === 'hava' && <WeatherTab gardenId={garden.id} />}
        {tab === 'gunluk' && <ComingSoonList heading="Günlük" items={JOURNAL_ITEMS} />}
        {tab === 'rapor' && <ComingSoonList heading="Rapor" items={REPORT_ITEMS} />}
      </div>
      {actions.dialog}
    </div>
  )
}
