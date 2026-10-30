import { Bug } from 'lucide-react'
import { Badge, Card, ErrorState, Skeleton, type BadgeTone } from '@/components/ui'
import { useRisks, type Risk } from '../../api/agroApi'
import { formatDate } from '../../lib/dates'
import { RuleBadge } from '../garden-page/RuleBadge'

const LEVEL: Record<Risk['seviye'], { label: string; tone: BadgeTone }> = {
  dusuk: { label: 'Düşük', tone: 'success' },
  orta: { label: 'Orta', tone: 'warn' },
  yuksek: { label: 'Yüksek', tone: 'danger' },
}

/** Zararlı / hastalık risk tahminleri: seviye, gerekçe, geçerlilik tarihi ve kural durumu. Teşhis değil, risk tahmini. */
export function RisksCard({ gardenId }: { gardenId: string }) {
  const { data, isLoading, isError, error, refetch, isFetching } = useRisks(gardenId)
  return (
    <Card aria-label="Zararlı ve hastalık riski" data-testid="risks-card" className="space-y-3 p-4">
      <h3 className="flex items-center gap-2 font-display text-h2 text-app-text">
        <Bug className="h-5 w-5 text-app-warn" aria-hidden /> Zararlı / hastalık riski
      </h3>
      {isLoading ? (
        <Skeleton className="h-32" />
      ) : isError || !data ? (
        <ErrorState title="Risk tahminleri alınamadı" error={error} retrying={isFetching} onRetry={() => void refetch()} />
      ) : data.riskler.length === 0 ? (
        <p className="text-body text-app-text-muted">Bu ürün için tanımlı risk kuralı yok.</p>
      ) : (
        <ul className="space-y-2.5">
          {data.riskler.map((risk) => {
            const level = LEVEL[risk.seviye]
            return (
              <li key={risk.kod} className="rounded-md bg-app-text/5 p-3" data-testid="risk-row" data-level={risk.seviye} data-code={risk.kod}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-body font-semibold text-app-text">{risk.ad}</p>
                  {risk.veriYeterli ? <Badge tone={level.tone}>{level.label}</Badge> : <Badge tone="neutral">Veri yetersiz</Badge>}
                </div>
                <p className="mt-1 text-small text-app-text-muted">{risk.gerekce}</p>
                <p className="mt-1 text-caption text-app-text-dim">
                  Geçerlilik: {formatDate(risk.gecerlilikBaslangic)} – {formatDate(risk.gecerlilikBitis)}
                </p>
                <RuleBadge meta={risk.kural} className="mt-1.5 inline-block" />
              </li>
            )
          })}
        </ul>
      )}
      {data && (
        <p className="text-caption text-app-text-dim" data-testid="risk-note">
          {data.not} {data.tuzak.desteklenir ? '' : `Tuzak sayımı girişi ${data.tuzak.adim}'de eklenecek.`}
        </p>
      )}
    </Card>
  )
}
