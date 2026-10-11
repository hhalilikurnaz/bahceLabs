import { Card, ErrorState, Skeleton, Switch } from '@/components/ui'
import { usePreferences, useSetPreference } from '../../api/notificationsApi'

/** Ayarlar: hangi bildirim türleri üretilsin (kapalı türler yeni bildirim oluşturmaz). */
export function NotificationPreferences() {
  const { data, isLoading, isError, refetch } = usePreferences()
  const set = useSetPreference()
  return (
    <Card aria-label="Bildirim tercihleri" className="space-y-2 p-4" data-testid="notification-preferences">
      <p className="text-caption font-semibold uppercase tracking-wide text-app-text-dim">Bildirim tercihleri</p>
      {isLoading ? (
        <Skeleton className="h-32" />
      ) : isError || !data ? (
        <ErrorState title="Tercihler alınamadı" description="Tekrar deneyin." onRetry={() => void refetch()} />
      ) : (
        <ul className="divide-y divide-app-border">
          {data.map((pref) => (
            <li key={pref.tur} className="py-1">
              <Switch label={pref.ad} hint={pref.aciklama} checked={pref.acik} onChange={(acik) => set.mutate({ tur: pref.tur, acik })} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
