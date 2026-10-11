import { Droplets } from 'lucide-react'
import { useUpdateGarden } from '../../api/useGardens'
import { Card, ErrorState, SelectField, Skeleton } from '@/components/ui'
import { useIrrigation } from '../../api/agroApi'
import { describeError } from '../../api/gardensApi'
import { IRRIGATION_SYSTEMS, type Garden, type SulamaSistemi } from '../../api/types'
import { RuleBadge } from '../garden-page/RuleBadge'
import { useToast } from '../layout/toastContext'

const mm = (v: number) => v.toLocaleString('tr-TR', { maximumFractionDigits: 1 })

/** Sulama önerisi: son 7 gün açığı, önümüzdeki 7 gün ihtiyacı, ton/dekar ve sistem verimliliği. Reçete değil, yaklaşık öneri. */
export function IrrigationCard({ garden }: { garden: Garden }) {
  const { data, isLoading, isError, refetch, isFetching } = useIrrigation(garden.id)
  const update = useUpdateGarden()
  const toast = useToast()

  function setSystem(value: string) {
    update.mutate(
      { id: garden.id, patch: { sulamaSistemi: (value || null) as SulamaSistemi | null } },
      { onSuccess: () => void refetch(), onError: (err) => toast.show(describeError(err)) },
    )
  }

  return (
    <Card aria-label="Sulama önerisi" data-testid="irrigation-card" className="space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-display text-h2 text-app-text">
          <Droplets className="h-5 w-5 text-app-water" aria-hidden /> Sulama önerisi
        </h3>
        <RuleBadge meta={data?.kurallar.etkiliYagis ?? null} />
      </div>

      {isLoading ? (
        <Skeleton className="h-32" />
      ) : isError || !data ? (
        <ErrorState title="Sulama önerisi alınamadı" description="İnternet bağlantınızı kontrol edip tekrar deneyin." retrying={isFetching} onRetry={() => void refetch()} />
      ) : !data.veriYeterli ? (
        <p className="text-body text-app-text-muted" data-testid="irrigation-insufficient">
          Veri yetersiz: {data.veriYetersizNedeni}
        </p>
      ) : (
        <>
          <p className="text-body font-semibold text-app-text" data-testid="irrigation-sentence">
            {data.cumle}
          </p>
          <dl className="grid grid-cols-2 gap-2 text-small" data-testid="irrigation-figures">
            <div className="rounded-md bg-app-text/5 p-2.5">
              <dt className="text-app-text-dim">Son {data.sonGunler?.gun ?? 7} gün açığı</dt>
              <dd className="tabular mt-0.5 text-h2 font-semibold text-app-text">{data.sonGunler ? `${mm(Math.max(0, data.sonGunler.netMm))} mm` : '—'}</dd>
              {data.sonGunler && <dd className="text-caption text-app-text-dim">ETc {mm(data.sonGunler.etcMm)} − yağış {mm(data.sonGunler.etkiliYagisMm)}</dd>}
            </div>
            <div className="rounded-md bg-app-text/5 p-2.5">
              <dt className="text-app-text-dim">Önümüzdeki {data.onumuzdekiGunler?.gun ?? 7} gün ihtiyacı</dt>
              <dd className="tabular mt-0.5 text-h2 font-semibold text-app-text">{data.ihtiyacMm !== null ? `${mm(data.ihtiyacMm)} mm` : '—'}</dd>
              {data.onumuzdekiGunler && <dd className="text-caption text-app-text-dim">ETc {mm(data.onumuzdekiGunler.etcMm)} − yağış {mm(data.onumuzdekiGunler.etkiliYagisMm)}</dd>}
            </div>
            <div className="rounded-md bg-app-text/5 p-2.5">
              <dt className="text-app-text-dim">Dekara yaklaşık</dt>
              <dd className="tabular mt-0.5 text-h2 font-semibold text-app-text">{data.tonDekar !== null ? `${mm(data.tonDekar)} ton` : '—'}</dd>
              <dd className="text-caption text-app-text-dim">1 mm = 1 ton/dekar{data.toplamTon !== null ? ` · toplam ≈ ${mm(data.toplamTon)} ton` : ''}</dd>
            </div>
            <div className="rounded-md bg-app-text/5 p-2.5">
              <dt className="text-app-text-dim">Sistem verimliliği</dt>
              <dd className="tabular mt-0.5 text-h2 font-semibold text-app-text">{data.sistem.verimlilik !== null ? `%${Math.round(data.sistem.verimlilik * 100)}` : '—'}</dd>
              <dd className="text-caption text-app-text-dim">{data.sistem.ad ?? 'Sistem seçilmedi'}</dd>
            </div>
          </dl>
          {data.kurallar.sistem.durum === 'dogrulanmadi' && <RuleBadge meta={data.kurallar.sistem} />}
        </>
      )}

      <SelectField label="Sulama sistemi" value={garden.sulamaSistemi ?? ''} onChange={(e) => setSystem(e.target.value)} disabled={update.isPending}>
        <option value="">Seçilmedi</option>
        {IRRIGATION_SYSTEMS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </SelectField>
      <p className="text-caption text-app-text-dim" data-testid="irrigation-note">
        {data?.not ?? 'Yaklaşık öneridir, sulama reçetesi değildir.'}
      </p>
    </Card>
  )
}
