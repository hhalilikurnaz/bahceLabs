import { Loader2, RefreshCw, TriangleAlert } from 'lucide-react'
import { IconButton } from '@/components/ui'
import type { IndexData } from '../../api/indeksApi'
import { timeAgo } from '../../lib/dates'

interface StatusLineProps {
  data: IndexData
  refreshing: boolean
  onRefresh: () => void
  refreshError: string | null
}

/** Uydu verisi durumu: sekmenin altında tek satır — son kontrol, işleme ilerlemesi/hata ve «Şimdi güncelle» simge düğmesi. */
export function StatusLine({ data, refreshing, onRefresh, refreshError }: StatusLineProps) {
  const job = data.isleme
  const active = job?.durum === 'bekliyor' || job?.durum === 'isleniyor'
  const percent = job && job.toplam > 0 ? Math.min(100, Math.round((job.islenen / job.toplam) * 100)) : 0
  const lastCheck = timeAgo(data.sonKontrol)
  const failure = job?.durum === 'hata' ? (job.hataMesaji ?? 'Uydu görüntüleri işlenemedi.') : refreshError

  let text = lastCheck ? `Son kontrol: ${lastCheck}` : 'Henüz kontrol edilmedi'
  if (active) text = job && job.toplam > 0 ? `Uydu görüntüleri işleniyor… ${job.islenen}/${job.toplam}` : job?.durum === 'bekliyor' ? 'Sıraya alındı…' : 'Görüntüler aranıyor…'

  return (
    <div className="flex items-center gap-2 text-small text-app-text-muted" data-testid="status-line">
      {active ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-app-accent" aria-hidden /> : failure ? <TriangleAlert className="h-4 w-4 shrink-0 text-app-danger" aria-hidden /> : null}
      <p className="min-w-0 flex-1" role={failure ? 'alert' : 'status'} aria-live="polite">
        {failure ? <span className="text-app-danger">{failure}</span> : text}
        {active && job && job.toplam > 0 && <span className="sr-only"> yüzde {percent}</span>}
      </p>
      <IconButton label="Şimdi güncelle" onClick={onRefresh} disabled={active || refreshing}>
        <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden />
      </IconButton>
    </div>
  )
}
