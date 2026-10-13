import { Droplets } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useUpdateGarden } from '../../api/useGardens'
import { Card, ErrorState, SelectField, Skeleton } from '@/components/ui'
import { useIrrigation } from '../../api/agroApi'
import { describeError } from '../../api/gardensApi'
import { IRRIGATION_SYSTEMS, type Garden, type SulamaSistemi } from '../../api/types'
import { gardenPath } from '../../lib/routes'
import { RuleBadge } from '../garden-page/RuleBadge'
import { useToast } from '../layout/toastContext'

const mm = (v: number) => v.toLocaleString('tr-TR', { maximumFractionDigits: 1 })

/** Sulama önerisi: tek cümle karar + anlamlı sayılar + «Sulama sistemi seçin». 9H'de Su sekmesine taşınacak. Reçete değil, yaklaşık öneri. */
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

  // Sıfır ve boş değerler gösterilmez («0 ton», «—»): yalnız anlamlı sayılar
  const figures: { label: string; value: string }[] = []
  if (data?.veriYeterli) {
    if (data.ihtiyacMm !== null && data.ihtiyacMm > 0) figures.push({ label: `Önümüzdeki ${data.onumuzdekiGunler?.gun ?? 7} gün ihtiyacı`, value: `${mm(data.ihtiyacMm)} mm` })
    if (data.tonDekar !== null && data.tonDekar > 0) figures.push({ label: 'Dekara yaklaşık', value: `${mm(data.tonDekar)} ton` })
    if (data.sistem.verimlilik !== null) figures.push({ label: 'Sistem verimliliği', value: `%${Math.round(data.sistem.verimlilik * 100)}` })
  }
  const [choosing, setChoosing] = useState(false)

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
          {data.kararKaynagi === 'su' ? (
            <Link to={gardenPath(garden.id, 'su')} className="inline-flex min-h-11 items-center text-small font-semibold text-app-text underline underline-offset-2" data-testid="irrigation-su-link">
              Gerekçesi Su sekmesinde: toprak nemi, su dengesi →
            </Link>
          ) : (
            <p className="text-caption text-app-text-dim" data-testid="irrigation-hava-notu">Toprak nemi verisi henüz yok; yalnız hava verisine dayanan yaklaşık hesap.</p>
          )}
          {figures.length > 0 && (
            <dl className="grid grid-cols-2 gap-2 text-small" data-testid="irrigation-figures">
              {figures.map((f) => (
                <div key={f.label} className="rounded-md bg-app-text/5 p-2.5">
                  <dt className="text-app-text-dim">{f.label}</dt>
                  <dd className="tabular mt-0.5 text-h2 font-semibold text-app-text">{f.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </>
      )}

      {garden.sulamaSistemi || choosing ? (
        <SelectField label="Sulama sistemi" value={garden.sulamaSistemi ?? ''} onChange={(e) => setSystem(e.target.value)} disabled={update.isPending}>
          <option value="">Seçilmedi</option>
          {IRRIGATION_SYSTEMS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </SelectField>
      ) : (
        <button type="button" onClick={() => setChoosing(true)} className="h-11 rounded-md border border-app-border px-3.5 text-small font-semibold text-app-text hover:border-app-text" data-testid="sulama-sistemi-sec">
          Sulama sistemi seçin
        </button>
      )}
      <p className="text-caption text-app-text-dim" data-testid="irrigation-note">
        {data?.not ?? 'Yaklaşık öneridir, sulama reçetesi değildir.'}
      </p>
    </Card>
  )
}
