import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, ErrorState, Skeleton, cx } from '@/components/ui'
import { useToday, type TodayItem } from '../../api/agroApi'
import { gardenPath } from '../../lib/routes'

const ICON = { kritik: CircleAlert, uyari: TriangleAlert, bilgi: Info } as const
const TONE = { kritik: 'text-app-danger', uyari: 'text-app-warn', bilgi: 'text-app-accent' } as const
const TAB_LABEL: Record<TodayItem['sekme'], string> = { durum: 'Durum', analiz: 'Analiz', hava: 'Hava', gunluk: 'Günlük', rapor: 'Rapor' }

/** «Bugün»: öncelik sırasıyla en fazla 3 madde; her madde ilgili sekmeye bağlanır. */
export function TodayCard({ gardenId }: { gardenId: string }) {
  const { data, isLoading, isError, refetch, isFetching } = useToday(gardenId)
  if (isLoading) return <Skeleton className="h-44" aria-label="Bugün yükleniyor" />
  if (isError || !data) {
    return (
      <Card>
        <ErrorState title="Bugün listesi alınamadı" description="İnternet bağlantınızı kontrol edip tekrar deneyin." retrying={isFetching} onRetry={() => void refetch()} />
      </Card>
    )
  }
  return (
    <Card aria-label="Bugün" data-testid="today-card" className="space-y-2 p-4">
      <h3 className="font-display text-h2 text-app-text">Bugün</h3>
      <ul className="space-y-2">
        {data.map((item) => {
          const Icon = item.tur === 'her_sey_yolunda' ? CircleCheck : ICON[item.oncelik]
          const tone = item.tur === 'her_sey_yolunda' ? 'text-app-success' : TONE[item.oncelik]
          return (
            <li key={`${item.tur}-${item.baslik}`} className="flex items-start gap-2.5" data-testid="today-item" data-kind={item.tur}>
              <Icon className={cx('mt-0.5 h-5 w-5 shrink-0', tone)} aria-hidden />
              <div className="min-w-0">
                <p className="text-body font-semibold text-app-text">{item.baslik}</p>
                <p className="text-small text-app-text-muted">{item.metin}</p>
                {item.ayrinti && (
                  <details className="group text-small" data-testid="today-detail">
                    <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-app-text-muted underline-offset-2 hover:underline">Ayrıntı</summary>
                    <p className="pb-1 text-app-text-muted">{item.ayrinti}</p>
                  </details>
                )}
                {item.tur !== 'her_sey_yolunda' && (
                  <Link
                    to={gardenPath(gardenId, item.sekme)}
                    className="inline-flex min-h-11 items-center text-small font-semibold text-app-accent underline-offset-2 hover:underline"
                  >
                    {TAB_LABEL[item.sekme]} sekmesine git
                  </Link>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
