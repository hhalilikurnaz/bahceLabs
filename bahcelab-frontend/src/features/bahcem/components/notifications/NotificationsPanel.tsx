import { bildirimKarar } from '../../lib/karar'
import { Bell, CircleAlert, Info, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, EmptyState, ErrorState, SelectField, Skeleton, Switch, cx } from '@/components/ui'
import { useMarkAllRead, useMarkRead, useNotifications, useSetNotificationState, type AppNotification, type NotificationFilters, type NotificationView } from '../../api/notificationsApi'
import { useGardens } from '../../api/useGardens'
import { timeAgo } from '../../lib/dates'

const TYPES = [
  { value: 'hava_don', label: 'Don uyarısı' },
  { value: 'hava_sicak', label: 'Aşırı sıcak uyarısı' },
  { value: 'zararli_riski', label: 'Zararlı / hastalık riski' },
  { value: 'indeks_dususu', label: 'Uydu uyarısı' },
  { value: 'sulama', label: 'Sulama' },
  { value: 'sulama_plani', label: 'Sulama günü yaklaştı' },
  { value: 'sulama_sapma', label: 'Plandan ciddi sapma' },
  { value: 'cok_yillik', label: 'Çok yıllık analiz' },
  { value: 'olay', label: 'Olay' },
  { value: 'kademe_dususu', label: 'Durum kademesi düşüşü' },
  { value: 'ozet', label: 'Günlük özet' },
] as const

const ICON = { kritik: CircleAlert, onemli: TriangleAlert, bilgi: Info } as const
const TONE = { kritik: 'text-app-danger', onemli: 'text-app-warn', bilgi: 'text-app-accent' } as const
/** Önem rozeti: renk + metin (renk körlüğü). Kritik anında gelir; önemli ve bilgi günlük özette. */
const ONEM = { kritik: 'Kritik', onemli: 'Önemli', bilgi: 'Bilgi' } as const

const VIEWS: { value: NotificationView; label: string }[] = [
  { value: 'aktif', label: 'Aktif' },
  { value: 'ertelendi', label: 'Ertelenen' },
  { value: 'cozuldu', label: 'Çözülen' },
]
const actionBtn = 'min-h-9 rounded-md border border-app-border px-2.5 text-caption font-semibold text-app-text hover:bg-app-card-hover max-[560px]:min-h-11'

function Item({ item, gardenName, onOpen, onState }: { item: AppNotification; gardenName: string | null; onOpen: (item: AppNotification, baglanti?: string) => void; onState: (item: AppNotification, durum: 'goruldu' | 'cozuldu' | 'ertelendi', gun?: number) => void }) {
  const Icon = ICON[item.oncelik]
  return (
    <li className={cx('rounded-md border', item.okundu ? 'border-app-border bg-app-panel' : 'border-app-accent/40 bg-app-card shadow-e1')} data-testid="notification-item" data-read={item.okundu} data-state={item.durum} data-priority={item.oncelik}>
      {item.tur === 'ozet' && item.ogeler.length > 0 ? (
        <div className="flex w-full items-start gap-3 rounded-md p-3 text-left">
          <Icon className={cx('mt-0.5 h-5 w-5 shrink-0', TONE[item.oncelik])} aria-hidden />
          <div className="min-w-0 flex-1">
            <button type="button" onClick={() => onOpen(item)} data-testid="notification-open" className="flex w-full flex-wrap items-center gap-x-2 text-left">
              <span className={cx('rounded-[3px] border border-app-border px-1.5 py-px text-caption font-semibold', TONE[item.oncelik])} data-testid="notification-onem" data-onem={item.oncelik}>Özet</span>
              <span className={cx('text-body text-app-text', !item.okundu && 'font-semibold')}>{item.baslik}</span>
              {item.durum === 'olustu' && <span className="rounded-full bg-app-accent px-2 py-0.5 text-caption font-semibold text-white">Yeni</span>}
            </button>
            {/* Özet maddeleri: her biri kendi harita bağlantısını (olay / katman + tarih) açar */}
            <ul className="mt-1 space-y-0.5" data-testid="ozet-ogeleri">
              {item.ogeler.map((o, i) => (
                <li key={`${o.baglanti}-${i}`}>
                  <button type="button" onClick={() => onOpen(item, o.baglanti)} data-testid="ozet-ogesi" data-onem={o.onem} data-baglanti={o.baglanti} className="flex min-h-9 w-full items-baseline gap-2 rounded-md text-left text-small text-app-text-muted hover:bg-app-card-hover hover:text-app-text max-[560px]:min-h-11">
                    <span aria-hidden className={cx('text-caption', TONE[o.onem])}>{o.onem === 'onemli' ? '▲' : '●'}</span>
                    <span className="min-w-0 underline-offset-2 group-hover:underline">{o.baslik}</span>
                    <span aria-hidden className="ml-auto shrink-0 text-app-text-dim">↗</span>
                  </button>
                </li>
              ))}
            </ul>
            <span className="mt-1 block text-caption text-app-text-dim">
              {item.turAdi}
              {gardenName ? ` · ${gardenName}` : ''} · {timeAgo(item.olusturma) ?? ''}
            </span>
          </div>
        </div>
      ) : (
      <button type="button" onClick={() => onOpen(item)} data-testid="notification-open" className="flex w-full items-start gap-3 rounded-md p-3 text-left transition-colors hover:bg-app-card-hover">
        <Icon className={cx('mt-0.5 h-5 w-5 shrink-0', TONE[item.oncelik])} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2">
            <span className={cx('rounded-[3px] border border-app-border px-1.5 py-px text-caption font-semibold', TONE[item.oncelik])} data-testid="notification-onem" data-onem={item.oncelik}>{item.tur === 'ozet' ? 'Özet' : ONEM[item.oncelik]}</span>
            <span className={cx('text-body text-app-text', !item.okundu && 'font-semibold')}>{item.baslik}</span>
            {item.durum === 'olustu' && <span className="rounded-full bg-app-accent px-2 py-0.5 text-caption font-semibold text-white">Yeni</span>}
          </span>
          <span className="mt-0.5 line-clamp-3 block text-small text-app-text-muted">{item.metin}</span>
          <span className="mt-1 block text-caption text-app-text-dim">
            {item.turAdi}
            {gardenName ? ` · ${gardenName}` : ''} · {timeAgo(item.olusturma) ?? ''}
            {item.durum === 'ertelendi' && item.ertelendiBitis ? ` · ${new Date(item.ertelendiBitis).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} tarihine ertelendi` : ''}
          </span>
        </span>
      </button>
      )}
      <div className="flex flex-wrap gap-2 px-3 pb-3 pl-11" data-testid="notification-actions">
        {item.durum === 'cozuldu' || item.durum === 'ertelendi' ? (
          <button type="button" className={actionBtn} onClick={() => onState(item, 'goruldu')}>{item.durum === 'cozuldu' ? 'Yeniden aç' : 'Ertelemeyi kaldır'}</button>
        ) : (
          <>
            <button type="button" className={actionBtn} onClick={() => onState(item, 'cozuldu')}>Çözüldü</button>
            <button type="button" className={actionBtn} onClick={() => onState(item, 'ertelendi', 1)}>1 gün ertele</button>
            <button type="button" className={actionBtn} onClick={() => onState(item, 'ertelendi', 3)}>3 gün ertele</button>
          </>
        )}
      </div>
    </li>
  )
}

/** Bildirim merkezi: filtre (tür, bahçe, yalnız okunmamış), sayfalı liste; tıklayınca okundu ve ilgili bahçe/sekme açılır. */
export function NotificationsPanel({ onNavigate }: { onNavigate?: () => void } = {}) {
  const navigate = useNavigate()
  const { data: gardens } = useGardens()
  const [filters, setFilters] = useState<NotificationFilters>({ tur: '', bahce: '', yalnizOkunmamis: false, sayfa: 1, gorunum: 'aktif' })
  const { data, isLoading, isError, error, refetch, isFetching } = useNotifications(filters)
  const markRead = useMarkRead()
  const markAll = useMarkAllRead()
  const setState = useSetNotificationState()
  const names = new Map((gardens ?? []).map((g) => [g.id, g.ad]))
  const patch = (next: Partial<NotificationFilters>) => setFilters((f) => ({ ...f, sayfa: 1, ...next }))

  function open(item: AppNotification, baglanti?: string) {
    if (!item.okundu) markRead.mutate(item.id)
    navigate(baglanti ?? item.baglanti) // özet maddesi kendi harita bağlantısına gider
    onNavigate?.()
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="notifications-panel">
      <header className="space-y-3 border-b border-app-border p-4">
        <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-2">
          <div className="min-w-0">
            <h2 className="text-h1 font-semibold text-app-text" data-testid="bildirim-baslik">{bildirimKarar(data ? data.okunmamisUrun : null, data?.okunmamisSistem ?? 0)}</h2>
            <p className="text-small text-app-text-muted" data-testid="unread-summary">
              {data ? (data.okunmamisUrun > 0 ? `${data.okunmamisUrun} okunmamış` : 'Hepsi okundu') : ' '}
              {data && data.okunmamisSistem > 0 ? ` · ${data.okunmamisSistem} sistem uyarısı` : ''}
            </p>
          </div>
          <Button className="shrink-0" onClick={() => markAll.mutate({ tur: filters.tur, bahce: filters.bahce })} disabled={!data || data.okunmamis === 0} loading={markAll.isPending}>
            Tümünü okundu işaretle
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <SelectField label="Tür" value={filters.tur} onChange={(e) => patch({ tur: e.target.value })}>
            <option value="">Tümü</option>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </SelectField>
          <SelectField label="Bahçe" value={filters.bahce} onChange={(e) => patch({ bahce: e.target.value })}>
            <option value="">Tümü</option>
            {(gardens ?? []).map((g) => (
              <option key={g.id} value={g.id}>
                {g.ad}
              </option>
            ))}
          </SelectField>
        </div>
        <div role="tablist" aria-label="Bildirim durumu" className="flex gap-1">
          {VIEWS.map((v) => (
            <button key={v.value} role="tab" type="button" aria-selected={(filters.gorunum ?? 'aktif') === v.value} onClick={() => patch({ gorunum: v.value })} className={cx('min-h-9 rounded-md px-3 text-small font-semibold max-[560px]:min-h-11', (filters.gorunum ?? 'aktif') === v.value ? 'bg-app-text text-app-panel' : 'text-app-text-muted hover:bg-app-card-hover')}>{v.label}</button>
          ))}
        </div>
        <Switch label="Yalnız okunmamışlar" checked={filters.yalnizOkunmamis} onChange={(v) => patch({ yalnizOkunmamis: v })} />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-3" aria-busy={isLoading}>
        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : isError || !data ? (
          <ErrorState title="Bildirimler alınamadı" error={error} retrying={isFetching} onRetry={() => void refetch()} />
        ) : data.ogeler.length === 0 ? (
          <EmptyState
            icon={<Bell className="h-6 w-6" aria-hidden />}
            title={filters.tur || filters.bahce || filters.yalnizOkunmamis ? 'Bu süzgeçle bildirim yok' : (filters.gorunum ?? 'aktif') === 'cozuldu' ? 'Çözülen bildirim yok' : (filters.gorunum ?? 'aktif') === 'ertelendi' ? 'Ertelenen bildirim yok' : 'Henüz bildirim yok'}
            description="Kritik uyarılar (don, şiddetli olay, yüksek risk) anında; önemli ve bilgi bildirimleri her sabah tek özet olarak burada listelenir."
          />
        ) : (
          <>
            {(() => {
              const urun = data.ogeler.filter((i) => !i.sistem)
              const sistem = data.ogeler.filter((i) => i.sistem)
              const satir = (item: AppNotification) => (
                <Item key={item.id} item={item} gardenName={item.bahceId ? (names.get(item.bahceId) ?? null) : null} onOpen={open} onState={(it, durum, erteleme_gun) => setState.mutate({ id: it.id, durum, erteleme_gun })} />
              )
              return (
                <>
                  {urun.length > 0 && <ul className="space-y-2" data-testid="notification-list">{urun.map(satir)}</ul>}
                  {urun.length === 0 && sistem.length > 0 && <p className="mb-2 px-1 text-small text-app-text-muted" data-testid="urun-bildirimi-yok">Bahçenizle ilgili uyarı yok.</p>}
                  {sistem.length > 0 && (
                    <details className="mt-3 rounded-md border border-app-border" open={urun.length === 0} data-testid="sistem-bildirimleri">
                      <summary className="flex min-h-11 cursor-pointer items-center justify-between px-3 text-small font-semibold">
                        <span>Sistem ve veri akışı ({sistem.length})</span>
                        <span className="font-normal text-app-text-muted">bahçe uyarısı değil</span>
                      </summary>
                      <ul className="space-y-2 p-2" data-testid="sistem-listesi">{sistem.map(satir)}</ul>
                    </details>
                  )}
                </>
              )
            })()}
            {data.sayfaSayisi > 1 && (
              <div className="mt-3 flex items-center justify-between gap-2">
                <Button disabled={filters.sayfa <= 1} onClick={() => setFilters((f) => ({ ...f, sayfa: f.sayfa - 1 }))}>
                  Önceki
                </Button>
                <span className="tabular text-small text-app-text-muted">
                  {data.sayfa} / {data.sayfaSayisi}
                </span>
                <Button disabled={filters.sayfa >= data.sayfaSayisi} onClick={() => setFilters((f) => ({ ...f, sayfa: f.sayfa + 1 }))}>
                  Sonraki
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
