import { ChevronDown, CircleHelp, Gauge } from 'lucide-react'
import { useId, useState } from 'react'
import { Button, Card, ErrorState, Skeleton, cx } from '@/components/ui'
import { useGardenStatus, type GardenStatus } from '../../api/agroApi'
import { StatusBadge } from '../garden/StatusBadge'

const TRUST_LABEL = { yuksek: 'Güven: yüksek', orta: 'Güven: orta', dusuk: 'Güven: düşük' } as const

function TrustMeter({ level }: { level: GardenStatus['guven']['seviye'] }) {
  const filled = { dusuk: 1, orta: 2, yuksek: 3 }[level]
  return (
    <span className="inline-flex items-center gap-1" role="img" aria-label={TRUST_LABEL[level]}>
      {[1, 2, 3].map((i) => (
        <i key={i} className={cx('h-2 w-5 rounded-full', i <= filled ? 'bg-app-accent' : 'bg-app-border-strong/40')} aria-hidden />
      ))}
    </span>
  )
}

/** Bahçe durumu skoru: büyük sayı, etiket, tek cümle özet, açılır bileşen dökümü ve güven göstergesi. Veri yetersizse nedeniyle. */
export function ScoreCard({ gardenId }: { gardenId: string }) {
  const { data, isLoading, isError, refetch, isFetching } = useGardenStatus(gardenId)
  const [open, setOpen] = useState(false)
  const panelId = useId()

  if (isLoading) return <Skeleton className="h-44" aria-label="Bahçe durumu yükleniyor" />
  if (isError || !data) {
    return (
      <Card>
        <ErrorState title="Bahçe durumu alınamadı" description="İnternet bağlantınızı kontrol edip tekrar deneyin." retrying={isFetching} onRetry={() => void refetch()} />
      </Card>
    )
  }

  if (!data.veriYeterli || data.skor === null) {
    return (
      <Card aria-label="Bahçe durumu skoru" data-testid="score-card" data-state="insufficient" className="space-y-2 border-dashed p-4">
        <div className="flex items-center gap-2">
          <Gauge className="h-5 w-5 text-app-text-dim" aria-hidden />
          <h3 className="font-display text-h2 text-app-text">Bahçe durumu</h3>
        </div>
        <p className="font-display text-h1 text-app-text-muted" data-testid="score-insufficient">
          Veri yetersiz
        </p>
        <p className="text-body text-app-text-muted" data-testid="score-reason">
          {data.veriYetersizNedeni}
        </p>
        <p className="flex items-center gap-2 text-caption text-app-text-dim">
          <TrustMeter level={data.guven.seviye} /> {data.guven.aciklama}
        </p>
      </Card>
    )
  }

  return (
    <Card aria-label="Bahçe durumu skoru" data-testid="score-card" data-state={data.durum} className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-1.5 text-body font-semibold text-app-text">
            <Gauge className="h-4 w-4 text-app-accent" aria-hidden /> Bahçe durumu
          </h3>
          <p className="mt-1 flex items-baseline gap-1">
            <span className="tabular font-display text-score text-app-text" data-testid="score-value">
              {data.skor}
            </span>
            <span className="text-body text-app-text-dim">/ 100</span>
          </p>
        </div>
        <StatusBadge status={data.durum} />
      </div>
      <p className="text-body text-app-text" data-testid="score-summary">
        {data.ozet}
      </p>
      <p className="flex flex-wrap items-center gap-2 text-caption text-app-text-muted" data-testid="score-trust">
        <TrustMeter level={data.guven.seviye} />
        <span>
          {data.guven.aciklama}
          {data.guven.sonGoruntuYasiGun !== null && ` Son net görüntü ${data.guven.sonGoruntuYasiGun === 0 ? 'bugün' : `${data.guven.sonGoruntuYasiGun} gün önce`}.`}
        </span>
      </p>
      <Button
        variant="ghost"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        icon={<ChevronDown className={cx('h-4 w-4 transition-transform', open && 'rotate-180')} aria-hidden />}
        className="-ml-2"
      >
        Neden bu skor?
      </Button>
      {open && (
        <ul id={panelId} className="space-y-2" data-testid="score-breakdown">
          {data.bilesenler.map((b) => (
            <li key={b.kod} className="rounded-md bg-app-text/5 p-2.5" data-testid="score-component" data-code={b.kod}>
              <div className="flex items-center justify-between gap-2 text-small">
                <span className="font-semibold text-app-text">{b.ad}</span>
                <span className="tabular text-app-text-muted">
                  {b.kullanilabilir && b.puan !== null ? `${b.puan}/100 · ağırlık %${Math.round(b.agirlik * 100)}` : 'değerlendirilemedi'}
                </span>
              </div>
              {b.kullanilabilir && b.puan !== null && (
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-app-border" aria-hidden>
                  <div className="h-full rounded-full bg-app-accent" style={{ width: `${b.puan}%` }} />
                </div>
              )}
              <p className="mt-1 text-small text-app-text-muted">{b.neden}</p>
            </li>
          ))}
          <li className="flex items-start gap-1.5 text-caption text-app-text-dim">
            <CircleHelp className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            Skor, bahçenin kendi geçmişiyle karşılaştırılarak hesaplanır; başka bahçelerle kıyaslanmaz. Değerlendirilemeyen bileşenler hesaba katılmaz.
          </li>
        </ul>
      )}
    </Card>
  )
}
