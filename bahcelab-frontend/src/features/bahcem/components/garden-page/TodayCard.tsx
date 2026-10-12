import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, ErrorState, Skeleton, cx } from '@/components/ui'
import { useToday, type TodayItem } from '../../api/agroApi'
import { gardenPath } from '../../lib/routes'

const ICON = { kritik: CircleAlert, uyari: TriangleAlert, bilgi: Info } as const
const TONE = { kritik: 'text-app-danger', uyari: 'text-app-warn', bilgi: 'text-app-accent' } as const
/** Her madde tek eylem: ilgili sekmeye geçiş (etiket sekme adıdır). Görev ve takvim eylemleri İşlerim ile (Faz 1.5) gelecek. */
const ACTION_LABEL: Record<TodayItem['sekme'], string> = { durum: 'Durum', analiz: 'Analiz', hava: 'Hava', gunluk: 'Günlük', rapor: 'Rapor' }

/** «Bugün»: öncelik sırasıyla en fazla 3 madde; satır = ikon · başlık · kısa açıklama · sağda tek eylem. */
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
    <Card aria-label="Bugün" data-testid="today-card" className="p-4">
      <h3 className="font-display text-h2 text-app-text">Bugün</h3>
      <ul className="mt-2 divide-y divide-app-border">
        {data.map((item) => {
          const done = item.tur === 'her_sey_yolunda'
          const Icon = done ? CircleCheck : ICON[item.oncelik]
          return (
            <li key={`${item.tur}-${item.baslik}`} className="flex items-center gap-3 py-3" data-testid="today-item" data-kind={item.tur}>
              <Icon className={cx('h-5 w-5 shrink-0', done ? 'text-app-success' : TONE[item.oncelik])} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-body font-semibold leading-snug text-app-text">{item.baslik}</p>
                <p className="line-clamp-2 text-small text-app-text-muted" title={item.metin}>{item.metin}</p>
              </div>
              {!done && (
                <Link
                  to={gardenPath(gardenId, item.sekme)}
                  data-testid="today-action"
                  className="flex h-9 shrink-0 items-center rounded-md border border-app-border px-3 text-small font-semibold text-app-text hover:border-app-text max-[560px]:h-11"
                >
                  {ACTION_LABEL[item.sekme]}
                </Link>
              )}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
