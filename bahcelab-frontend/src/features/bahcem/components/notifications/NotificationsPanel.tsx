import { Bell, CircleAlert, Info, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, EmptyState, ErrorState, SelectField, Skeleton, Switch, cx } from '@/components/ui'
import { useMarkAllRead, useMarkRead, useNotifications, type AppNotification, type NotificationFilters } from '../../api/notificationsApi'
import { useGardens } from '../../api/useGardens'
import { timeAgo } from '../../lib/dates'

const TYPES = [
  { value: 'hava_don', label: 'Don uyarısı' },
  { value: 'hava_sicak', label: 'Aşırı sıcak uyarısı' },
  { value: 'zararli_riski', label: 'Zararlı / hastalık riski' },
  { value: 'indeks_dususu', label: 'Uydu uyarısı' },
  { value: 'sulama', label: 'Sulama' },
] as const

const ICON = { kritik: CircleAlert, uyari: TriangleAlert, bilgi: Info } as const
const TONE = { kritik: 'text-app-danger', uyari: 'text-app-warn', bilgi: 'text-app-accent' } as const

function Item({ item, gardenName, onOpen }: { item: AppNotification; gardenName: string | null; onOpen: (item: AppNotification) => void }) {
  const Icon = ICON[item.oncelik]
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(item)}
        data-testid="notification-item"
        data-read={item.okundu}
        data-priority={item.oncelik}
        className={cx(
          'flex w-full items-start gap-3 rounded-md border p-3 text-left transition-colors hover:bg-app-card-hover',
          item.okundu ? 'border-app-border bg-app-panel' : 'border-app-accent/40 bg-app-card shadow-e1',
        )}
      >
        <Icon className={cx('mt-0.5 h-5 w-5 shrink-0', TONE[item.oncelik])} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2">
            <span className={cx('text-body text-app-text', !item.okundu && 'font-semibold')}>{item.baslik}</span>
            {!item.okundu && <span className="rounded-full bg-app-accent px-2 py-0.5 text-caption font-semibold text-white">Yeni</span>}
          </span>
          <span className="mt-0.5 line-clamp-3 block text-small text-app-text-muted">{item.metin}</span>
          <span className="mt-1 block text-caption text-app-text-dim">
            {item.turAdi}
            {gardenName ? ` · ${gardenName}` : ''} · {timeAgo(item.olusturma) ?? ''}
          </span>
        </span>
      </button>
    </li>
  )
}

/** Bildirim merkezi: filtre (tür, bahçe, yalnız okunmamış), sayfalı liste; tıklayınca okundu ve ilgili bahçe/sekme açılır. */
export function NotificationsPanel() {
  const navigate = useNavigate()
  const { data: gardens } = useGardens()
  const [filters, setFilters] = useState<NotificationFilters>({ tur: '', bahce: '', yalnizOkunmamis: false, sayfa: 1 })
  const { data, isLoading, isError, refetch, isFetching } = useNotifications(filters)
  const markRead = useMarkRead()
  const markAll = useMarkAllRead()
  const names = new Map((gardens ?? []).map((g) => [g.id, g.ad]))
  const patch = (next: Partial<NotificationFilters>) => setFilters((f) => ({ ...f, sayfa: 1, ...next }))

  function open(item: AppNotification) {
    if (!item.okundu) markRead.mutate(item.id)
    navigate(item.baglanti)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="notifications-panel">
      <header className="space-y-3 border-b border-app-border p-4">
        <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-2">
          <div className="min-w-0">
            <h2 className="font-display text-h1 text-app-text">Bildirimler</h2>
            <p className="text-small text-app-text-muted" data-testid="unread-summary">
              {data ? (data.okunmamis > 0 ? `${data.okunmamis} okunmamış` : 'Hepsi okundu') : ' '}
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
          <ErrorState title="Bildirimler alınamadı" description="İnternet bağlantınızı kontrol edip tekrar deneyin." retrying={isFetching} onRetry={() => void refetch()} />
        ) : data.ogeler.length === 0 ? (
          <EmptyState
            icon={<Bell className="h-6 w-6" aria-hidden />}
            title={filters.tur || filters.bahce || filters.yalnizOkunmamis ? 'Bu süzgeçle bildirim yok' : 'Henüz bildirim yok'}
            description="Don, sıcak, zararlı riski, uydu uyarısı ve sulama ihtiyacı oluştuğunda burada listelenir."
          />
        ) : (
          <>
            <ul className="space-y-2" data-testid="notification-list">
              {data.ogeler.map((item) => (
                <Item key={item.id} item={item} gardenName={item.bahceId ? (names.get(item.bahceId) ?? null) : null} onOpen={open} />
              ))}
            </ul>
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
