import { Loader2, RefreshCw, TriangleAlert } from 'lucide-react'
import { Button, Card } from '@/components/ui'
import type { IndexData } from '../../api/indeksApi'
import { timeAgo } from '../../lib/dates'

interface StatusCardProps {
  data: IndexData
  refreshing: boolean
  onRefresh: () => void
  refreshError: string | null
}

/** Uydu verisi durumu: işleme ilerlemesi, hata, son kontrol ve «Şimdi güncelle». */
export function StatusCard({ data, refreshing, onRefresh, refreshError }: StatusCardProps) {
  const job = data.isleme
  const active = job?.durum === 'bekliyor' || job?.durum === 'isleniyor'
  const percent = job && job.toplam > 0 ? Math.min(100, Math.round((job.islenen / job.toplam) * 100)) : 0
  const lastCheck = timeAgo(data.sonKontrol)

  return (
    <Card className="space-y-3" aria-label="Uydu verisi durumu">
      {active && (
        <div role="status" aria-live="polite">
          <p className="flex items-center gap-2 text-body font-semibold text-app-text">
            <Loader2 className="h-4 w-4 animate-spin text-app-accent" aria-hidden />
            Uydu görüntüleri işleniyor…
          </p>
          <div
            className="mt-2.5 h-2 overflow-hidden rounded-full bg-app-text/8"
            role="progressbar"
            aria-label="İşleme ilerlemesi"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <div className="h-full rounded-full bg-app-accent transition-[width] duration-500" style={{ width: `${job?.toplam ? percent : 8}%` }} />
          </div>
          <p className="mt-1.5 text-small text-app-text-muted">
            {job && job.toplam > 0
              ? `${job.islenen} / ${job.toplam} görüntü · son 13 ay`
              : job?.durum === 'bekliyor'
                ? 'Sıraya alındı…'
                : 'Görüntüler aranıyor…'}
          </p>
        </div>
      )}

      {job?.durum === 'hata' && (
        <p role="alert" className="flex items-start gap-2 rounded-md bg-app-danger/10 px-3 py-2.5 text-small text-app-danger">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {job.hataMesaji ?? 'Uydu görüntüleri işlenemedi.'}
        </p>
      )}

      {job?.durum === 'tamam' && job.hataMesaji && <p className="text-small text-app-warn">{job.hataMesaji}</p>}

      {refreshError && (
        <p role="alert" className="text-small text-app-danger">
          {refreshError}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-small text-app-text-muted">
          {lastCheck ? `Son kontrol: ${lastCheck}` : active ? '' : 'Henüz kontrol edilmedi'}
        </span>
        <Button
          onClick={onRefresh}
          disabled={active || refreshing}
          icon={<RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden />}
        >
          Şimdi güncelle
        </Button>
      </div>
    </Card>
  )
}
