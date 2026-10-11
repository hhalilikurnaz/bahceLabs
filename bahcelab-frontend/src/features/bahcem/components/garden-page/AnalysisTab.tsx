import { YieldCard } from '../indeks/YieldCard'
import { ComingSoonList } from './ComingSoonList'
import { ANALYSIS_ITEMS } from './comingSoonItems'
import { ProblemAreas } from './ProblemAreas'
import { Card } from '@/components/ui'
import { useIndexView } from '../../hooks/useIndexView'

/** Analiz sekmesi: bölgeler ve sorunlu alanlar; ileride topografya, toprak ve uygulama haritası. */
export function AnalysisTab({ gardenId }: { gardenId: string }) {
  const { scenes } = useIndexView()
  const hasImages = scenes?.some((s) => s.durum === 'tamam') ?? false

  return (
    <div className="space-y-3">
      {hasImages ? (
        <div className="grid grid-cols-1 gap-3 @2xl:grid-cols-2 @2xl:items-start">
          <YieldCard gardenId={gardenId} />
          <ProblemAreas />
        </div>
      ) : (
        <Card>
          <p className="text-body text-app-text-muted">
            Analiz için önce uydu görüntüleri hazır olmalı. Görüntüler geldiğinde bölgeler ve sorunlu alanlar burada görünür.
          </p>
        </Card>
      )}
      <ComingSoonList heading="Yakında" items={ANALYSIS_ITEMS} />
    </div>
  )
}
