import { Card, InfoHint, Skeleton } from '@/components/ui'
import { formatDate } from '../../lib/dates'
import { TREND } from '../../lib/config'
import { INDEX_DEFS, formatIndexValue, type IndexId } from '../../lib/indices'
import type { Alert, Scene } from '../../api/indeksApi'
import { changeOverDays, latestIndexValue } from '../../lib/scenes'

interface LatestValueCardProps {
  indeks: IndexId
  scenes: Scene[] | undefined
  loading: boolean
  processing: boolean
  /** Sunucunun uyarıları: kırmızı/sarı renk yalnızca burada uyarı varsa kullanılır (tek durum kaynağı) */
  alerts: Alert[]
}

/** Seçili parametrenin en güncel değeri, önceki döneme göre değişimi ve kısa açıklaması. Veri yoksa nedenini söyler. */
export function LatestValueCard({ indeks, scenes, loading, processing, alerts }: LatestValueCardProps) {
  const def = INDEX_DEFS[indeks]
  const latest = latestIndexValue(scenes, indeks)
  const change = changeOverDays(scenes, indeks, TREND.compareDays, TREND.toleranceDays)
  const scene = latest ? scenes?.find((s) => s.tarih === latest.tarih) : undefined

  const alert = alerts.find((x) => x.indeks === indeks || x.indeksler.includes(indeks))
  let deltaText: string | null = null
  let toneClass = 'text-app-text-muted'
  let note: string | null = null
  if (change?.percent != null) {
    const rounded = Math.round(change.percent * 10) / 10
    const flat = Math.abs(rounded) < TREND.flatPercent
    const arrow = flat ? '▬' : rounded > 0 ? '▲' : '▼'
    const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : ''
    deltaText = `${arrow} ${sign}%${Math.abs(rounded).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} · ${TREND.compareDays} gün önceye göre`
    if (alert) {
      toneClass = alert.oncelik === 'yuksek' ? 'text-app-danger' : 'text-app-warn'
      note = 'Dikkat: bu düşüş uyarı eşiğini aştı.'
    } else {
      note = flat ? 'Değişmedi.' : 'Mevsim normali içinde.'
    }
  }

  return (
    <Card aria-label={`${def.ad}: en güncel değer`} data-testid="latest-value" className="p-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-body font-semibold text-app-text">
          {def.ad} <span className="text-small font-medium text-app-text-dim">{def.teknik}</span>
        </h3>
        <InfoHint label={`${def.ad} ne demek?`} text={def.aciklama} className="-mr-2 -mt-2" />
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-14" />
      ) : latest ? (
        <>
          <p className="tabular mt-1 font-display text-metric text-app-text">{formatIndexValue(indeks, latest.ortalama)}</p>
          <p className="text-small text-app-text-muted" data-testid="latest-date">
            {formatDate(latest.tarih)} · en güncel görüntü
            {scene?.bulutOrani != null && ` · bulut %${Math.round(scene.bulutOrani)}`}
          </p>
          {deltaText ? (
            <p className={`tabular mt-1 text-small font-semibold ${toneClass}`} data-testid="latest-change">
              {deltaText}
              {note && <span className="block font-normal">{note}</span>}
            </p>
          ) : (
            <p className="mt-1 text-small text-app-text-dim">Karşılaştırılacak önceki görüntü yok.</p>
          )}
        </>
      ) : (
        <p className="mt-2 text-body text-app-text-muted">
          {processing
            ? 'İlk uydu görüntüleri hazırlanıyor…'
            : 'Henüz kullanılabilir görüntü yok. Bu dönem bulutlu olabilir; yeni görüntü geldikçe burada görünür.'}
        </p>
      )}
    </Card>
  )
}
