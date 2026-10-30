import { ApiError } from './apiClient'

/** Hatanın kaynağı: kullanıcıya doğru şeyi söylemek için ağ ile sunucu ayrı ele alınır. */
export type HataTuru = 'ag' | 'sunucu' | 'yetki' | 'bulunamadi' | 'istek' | 'bilinmiyor'

export function hataTuru(error: unknown): HataTuru {
  if (error instanceof ApiError) {
    if (error.status >= 500) return 'sunucu'
    if (error.status === 401 || error.status === 403) return 'yetki'
    if (error.status === 404) return 'bulunamadi'
    return 'istek'
  }
  if (error instanceof TypeError) return 'ag' // fetch ağ hatasında TypeError fırlatır
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'ag'
  return 'bilinmiyor'
}

const ACIKLAMA: Record<HataTuru, string> = {
  ag: 'Sunucuya ulaşılamadı; internet bağlantınızı kontrol edip tekrar deneyin.',
  sunucu: 'Sunucu şu an yanıt veremiyor; sorun sizde değil. Birkaç dakika sonra tekrar deneyin.',
  yetki: 'Oturumunuz bu bilgiye erişemiyor; yeniden giriş yapmayı deneyin.',
  bulunamadi: 'İstenen kayıt bulunamadı.',
  istek: 'İstek sunucu tarafından kabul edilmedi; tekrar deneyin.',
  bilinmiyor: 'Beklenmeyen bir sorun oluştu; tekrar deneyin.',
}

export const hataAciklamasi = (error: unknown): string => ACIKLAMA[hataTuru(error)]
