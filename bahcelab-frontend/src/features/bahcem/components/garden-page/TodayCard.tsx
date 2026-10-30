import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ErrorState, Skeleton, cx } from '@/components/ui'
import { useToday, type TodayItem } from '../../api/agroApi'
import { gardenPath } from '../../lib/routes'

const ICON = { kritik: CircleAlert, onemli: TriangleAlert, bilgi: Info } as const
const TONE = { kritik: 'text-app-danger', onemli: 'text-app-warn', bilgi: 'text-app-accent' } as const
const ONEM_AD = { kritik: 'Kritik', onemli: 'Önemli', bilgi: 'Bilgi' } as const
/** Her madde tek eylem: ilgili sekmeye geçiş (etiket sekme adıdır). Görev ve takvim eylemleri İşlerim ile (Faz 1.5) gelecek. */
const ACTION_LABEL: Record<TodayItem['sekme'], string> = { durum: 'Durum', analiz: 'Analiz', hava: 'Hava', gunluk: 'Günlük', rapor: 'Rapor' }

/** «Bugün»: ÖNEM sırasıyla (kritik → önemli → bilgi) en fazla 3 madde — olaylar ve riskler dahil; satır = ikon · başlık · kısa açıklama · sağda tek eylem. */
export function TodayCard({ gardenId }: { gardenId: string }) {
  const { data, isLoading, isError, error, refetch, isFetching } = useToday(gardenId)
  if (isLoading) return <Skeleton className="m-skeleton h-44" aria-label="Yapılacaklar yükleniyor" />
  if (isError || !data) {
    return (
      <section className="rounded-md border border-app-border bg-app-card p-4">
        <ErrorState title="Yapılacaklar alınamadı" error={error} retrying={isFetching} onRetry={() => void refetch()} className="py-4" />
      </section>
    )
  }
  return (
    <section aria-label="Yapılacaklar" data-testid="today-card" className="rounded-md border border-app-border bg-app-card p-4">
      <h3 className="text-lead font-semibold text-app-text">Yapılacaklar</h3>
      <ul className="mt-2 divide-y divide-app-border">
        {data.map((item) => {
          const done = item.tur === 'her_sey_yolunda'
          const Icon = done ? CircleCheck : ICON[item.oncelik]
          return (
            <li key={`${item.tur}-${item.baslik}`} className="flex items-center gap-3 py-3" data-testid="today-item" data-kind={item.tur}>
              <Icon className={cx('h-5 w-5 shrink-0', done ? 'text-app-success' : TONE[item.oncelik])} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-body font-semibold leading-snug text-app-text">
                  <span className={cx('mr-1.5 rounded-[4px] border border-app-border px-1.5 py-px align-middle text-caption font-semibold', TONE[item.oncelik])} data-testid="today-onem" data-onem={item.oncelik}>{ONEM_AD[item.oncelik]}</span>
                  {item.baslik}
                </p>
                <p className="text-small text-app-text-muted">{item.metin}</p>
                {item.ayrinti && item.tur === 'indeks_dususu' && (
                  <details className="mt-1 text-small text-app-text-muted" data-testid="today-ayrinti">
                    <summary className="flex min-h-9 cursor-pointer items-center font-semibold text-app-text max-[560px]:min-h-11">Ayrıntı</summary>
                    <p className="pb-1">{item.ayrinti}</p>
                  </details>
                )}
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
    </section>
  )
}
