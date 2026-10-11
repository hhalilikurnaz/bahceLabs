import { ApiError } from '@/lib/apiClient'

/** Hata nesnesini anlaşılır Türkçe metne çevirir; ağ hatası ayrı söylenir. */
export function authErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (err.status === 429) return 'Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar deneyin.'
    if (err.status >= 500) return 'Sunucuda bir sorun oluştu. Biraz sonra tekrar deneyin.'
    return err.message || fallback
  }
  if (err instanceof TypeError) return 'Sunucuya ulaşılamıyor. İnternet bağlantınızı kontrol edip tekrar deneyin.'
  return err instanceof Error && err.message ? err.message : fallback
}
