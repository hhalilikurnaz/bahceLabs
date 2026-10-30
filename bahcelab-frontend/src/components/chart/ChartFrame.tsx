import type { ReactNode } from 'react'
import { cx } from '@/components/ui/cx'
import { ErrorState } from '@/components/ui/ErrorState'

/** StaleBadge: veri yaşı rozeti (kaynak · N gün önce). Eşik (ön değer) aşılınca amber tonlu; simge + metin (renk tek başına anlam taşımaz). */
export function StaleBadge({ kaynak, gun, esikGun = 14 }: { kaynak: string; gun: number | null; esikGun?: number }) {
  const eski = gun !== null && gun >= esikGun
  return (
    <span className={cx('inline-flex items-center gap-1 text-caption font-medium', eski ? 'text-app-warn' : 'text-app-text-dim')} data-testid="veri-yasi" data-eski={String(eski)}>
      <span aria-hidden>{eski ? '▲' : '◷'}</span>
      {kaynak}{gun === null ? '' : gun === 0 ? ' · bugün' : ` · ${gun} gün önce`}
    </span>
  )
}

/** ChartFrame: kart. Başlık = grafiğin MESAJI (tek cümle); birim/kaynak tek satır; yöntem «?» ayrıntısında. */
export function ChartFrame({ mesaj, birim, kaynak, gun, ayrinti, children, className, testId }: { mesaj: string; birim?: string; kaynak?: string; gun?: number | null; ayrinti?: ReactNode; children: ReactNode; className?: string; testId?: string }) {
  return (
    <section className={cx('rounded-md border border-app-border bg-app-card p-4', className)} data-testid={testId}>
      <h3 className="text-lead font-semibold text-app-text">{mesaj}</h3>
      {(birim || kaynak) && (
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-caption text-app-text-dim">
          {birim && <span>{birim}</span>}
          {kaynak && gun !== undefined ? <StaleBadge kaynak={kaynak} gun={gun} /> : kaynak && <span>{kaynak}</span>}
        </p>
      )}
      <div className="mt-2">{children}</div>
      {ayrinti && (
        <details className="mt-2 text-small text-app-text-muted">
          <summary className="inline-flex min-h-8 cursor-pointer list-none items-center gap-1 text-app-text-dim" aria-label="Grafiğin ayrıntısı"><span aria-hidden className="grid h-5 w-5 place-items-center rounded-full border border-app-border-strong text-caption font-semibold">?</span><span>Nasıl okunur</span></summary>
          <div className="mt-1.5 space-y-1">{ayrinti}</div>
        </details>
      )}
    </section>
  )
}

/** ChartState: «yok», «bayat», «hata» AYRI görünür; her birinde neden + ne zaman gelir (ilke 8). Hata asla boş durum olarak çizilmez. */
export function ChartState({ tur, neden, nezaman, error, onRetry, retrying, yukseklik = 160 }: { tur: 'yok' | 'bayat' | 'hata' | 'yukleniyor'; neden?: string; nezaman?: string; error?: unknown; onRetry?: () => void; retrying?: boolean; yukseklik?: number }) {
  if (tur === 'yukleniyor') return <div role="status" aria-label="Grafik yükleniyor" className="m-skeleton rounded-md bg-app-card-hover" style={{ height: yukseklik }} />
  if (tur === 'hata') return <ErrorState title="Grafik alınamadı" error={error} onRetry={onRetry} retrying={retrying} className="py-4" />
  return (
    <div role="status" data-testid={`grafik-${tur}`} className="grid place-items-center rounded-md border border-dashed border-app-border px-4 text-center text-small text-app-text-muted" style={{ minHeight: yukseklik }}>
      <p><b className="block text-app-text">{tur === 'bayat' ? 'Veri eski' : 'Veri yok'}</b>{neden}{nezaman ? ` ${nezaman}` : ''}</p>
    </div>
  )
}
