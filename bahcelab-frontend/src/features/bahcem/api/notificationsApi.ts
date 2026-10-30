import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/apiClient'
import type { ApiDigestItem, ApiNotification, ApiNotificationList, ApiNotificationPriority, ApiPreference } from './dto/notifications'

export interface AppNotification {
  id: string
  bahceId: string | null
  tur: string
  turAdi: string
  oncelik: ApiNotificationPriority
  baslik: string
  metin: string
  baglanti: string
  okundu: boolean
  /** Veri akışı (sistem) bildirimi: ürün (bahçe) uyarılarından ayrı gösterilir, rozete ve toast'a girmez */
  sistem: boolean
  /** Yaşam döngüsü: oluştu → görüldü → çözüldü / ertelendi (süre dolunca yeniden oluştu) */
  durum: 'olustu' | 'goruldu' | 'cozuldu' | 'ertelendi'
  ertelendiBitis: string | null
  olusturma: string
  /** Günlük özet kartı: kapsanan maddeler (özet dışında boş) */
  ogeler: ApiDigestItem[]
}

export type NotificationView = 'aktif' | 'ertelendi' | 'cozuldu'

export interface NotificationPage {
  sayfa: number
  sayfaSayisi: number
  toplam: number
  okunmamis: number
  /** Rozet yalnız ürün uyarılarını sayar */
  okunmamisUrun: number
  okunmamisSistem: number
  ogeler: AppNotification[]
}

export interface NotificationFilters {
  tur: string
  bahce: string
  yalnizOkunmamis: boolean
  sayfa: number
  gorunum?: NotificationView
}

export interface Preference {
  tur: string
  ad: string
  aciklama: string
  acik: boolean
}

const mapItem = (n: ApiNotification): AppNotification => ({
  id: n.id, bahceId: n.bahce_id, tur: n.tur, turAdi: n.tur_adi, oncelik: n.oncelik, baslik: n.baslik, metin: n.metin,
  baglanti: n.baglanti, okundu: n.okundu, sistem: n.sistem ?? n.tur === 'besleme', durum: n.durum, ertelendiBitis: n.ertelendi_bitis, olusturma: n.olusturma, ogeler: n.ogeler ?? [],
})

export const PAGE_SIZE = 20
export const POLL_MS = 60_000
export const NOTIFICATIONS_KEY = ['notifications'] as const

async function fetchPage(filters: NotificationFilters, size = PAGE_SIZE): Promise<NotificationPage> {
  const params = new URLSearchParams({ sayfa: String(filters.sayfa), boyut: String(size) })
  if (filters.tur) params.set('tur', filters.tur)
  if (filters.bahce) params.set('bahce', filters.bahce)
  if (filters.yalnizOkunmamis) params.set('okunmamis', 'true')
  if (filters.gorunum && filters.gorunum !== 'aktif') params.set('durum', filters.gorunum)
  const raw = await apiRequest<ApiNotificationList>(`/notifications?${params}`)
  return { sayfa: raw.sayfa, sayfaSayisi: raw.sayfa_sayisi, toplam: raw.toplam, okunmamis: raw.okunmamis_sayisi, okunmamisUrun: raw.okunmamis_urun_sayisi ?? raw.okunmamis_sayisi, okunmamisSistem: raw.okunmamis_sistem_sayisi ?? 0, ogeler: raw.ogeler.map(mapItem) }
}

export function useNotifications(filters: NotificationFilters) {
  return useQuery({
    queryKey: [...NOTIFICATIONS_KEY, 'liste', filters],
    queryFn: () => fetchPage(filters),
    placeholderData: keepPreviousData,
    refetchInterval: POLL_MS,
  })
}

/** Rozet ve toast için hafif yoklama: yalnızca en yeni okunmamışlar. */
export function useUnreadPoll() {
  return useQuery({
    queryKey: [...NOTIFICATIONS_KEY, 'okunmamis'],
    queryFn: () => fetchPage({ tur: '', bahce: '', yalnizOkunmamis: true, sayfa: 1 }, 10),
    refetchInterval: POLL_MS,
    staleTime: POLL_MS / 2,
  })
}

export function useMarkRead() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiRequest(`/notifications/${id}/okundu`, { method: 'POST' }),
    onSuccess: () => client.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
  })
}

/** Yaşam döngüsü geçişi: görüldü · çözüldü · ertelendi (gün). */
export function useSetNotificationState() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, durum, erteleme_gun }: { id: string; durum: 'goruldu' | 'cozuldu' | 'ertelendi'; erteleme_gun?: number }) =>
      apiRequest(`/notifications/${id}/durum`, { method: 'POST', body: JSON.stringify({ durum, erteleme_gun }) }),
    onSuccess: () => client.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
  })
}

export function useMarkAllRead() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (filters: { tur: string; bahce: string }) => {
      const params = new URLSearchParams()
      if (filters.tur) params.set('tur', filters.tur)
      if (filters.bahce) params.set('bahce', filters.bahce)
      return apiRequest(`/notifications/okundu${params.size ? `?${params}` : ''}`, { method: 'POST' })
    },
    onSuccess: () => client.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
  })
}

export function usePreferences() {
  return useQuery({ queryKey: [...NOTIFICATIONS_KEY, 'tercihler'], queryFn: () => apiRequest<ApiPreference[]>('/notifications/tercihler'), staleTime: 60_000 })
}

export function useSetPreference() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ tur, acik }: { tur: string; acik: boolean }) =>
      apiRequest<ApiPreference[]>(`/notifications/tercihler/${tur}`, { method: 'PUT', body: JSON.stringify({ acik }) }),
    onSuccess: (data) => client.setQueryData([...NOTIFICATIONS_KEY, 'tercihler'], data),
  })
}
