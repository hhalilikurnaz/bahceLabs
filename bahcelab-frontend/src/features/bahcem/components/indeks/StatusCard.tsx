import { Loader2, RefreshCw, TriangleAlert } from 'lucide-react'
import type { IndexData } from '../../api/indeksApi'
import { timeAgo } from '../../lib/dates'

interface StatusCardProps {
  data: IndexData
  refreshing: boolean
  onRefresh: () => void
  refreshError: string | null
}

/** İşleme durumu (ilerleme çubuğu), hata mesajı, son kontrol ve «Şimdi güncelle». */
export function StatusCard({ data, refreshing, onRefresh, refreshError }: StatusCardProps) {
  const job = data.isleme
  const active = job?.durum === 'bekliyor' || job?.durum === 'isleniyor'
  const percent = job && job.toplam > 0 ? Math.min(100, Math.round((job.islenen / job.toplam) * 100)) : 0
  const lastCheck = timeAgo(data.sonKontrol)

  return (
    <section className="space-y-3 rounded-2xl bg-app-card p-3.5" aria-label="Uydu görüntüsü durumu">
      {active && (
        <div role="status" aria-live="polite">
          <div className="flex items-center gap-2 text-[13px] font-medium text-app-text">
            <Loader2 className="h-4 w-4 animate-spin text-app-accent" aria-hidden />
            Uydu görüntüleri işleniyor…
          </div>
          <div
            className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-app-bg"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <div
              className="h-full rounded-full bg-app-accent transition-[width] duration-500"
              style={{ width: `${job?.toplam ? percent : 8}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-app-text-muted">
            {job && job.toplam > 0
              ? `${job.islenen} / ${job.toplam} sahne · son 13 ay`
              : job?.durum === 'bekliyor'
                ? 'Sıraya alındı…'
                : 'Sahneler aranıyor…'}
          </p>
        </div>
      )}

      {job?.durum === 'hata' && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl bg-app-danger/10 px-3 py-2.5 text-[12px] leading-snug text-app-danger"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {job.hataMesaji ?? 'Uydu görüntüleri işlenemedi.'}
        </p>
      )}

      {job?.durum === 'tamam' && job.hataMesaji && (
        <p className="text-[11px] leading-snug text-amber-300">{job.hataMesaji}</p>
      )}

      {refreshError && (
        <p role="alert" className="text-[12px] text-app-danger">
          {refreshError}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] text-app-text-muted">
          {lastCheck ? `Son kontrol: ${lastCheck}` : active ? '' : 'Henüz kontrol edilmedi'}
        </span>
        <button
          type="button"
          onClick={onRefresh}
          disabled={active || refreshing}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-app-border px-3 text-[12px] font-medium text-app-text transition-colors hover:bg-app-card-hover focus-visible:outline-2 focus-visible:outline-app-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} aria-hidden />
          Şimdi güncelle
        </button>
      </div>

    </section>
  )
}
