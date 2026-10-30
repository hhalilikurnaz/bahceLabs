import { createContext, useContext } from 'react'

/**
 * Sayfa başına TEK zaman alanı ve senkron imleç (ilke 10): bir grafikte gezinince imleç tarihi buraya yazılır; harita tarih kutusu
 * ve aynı sayfadaki diğer grafikler onu okur. `sec`: noktaya tıklanınca harita o görüntüye geçer.
 */
export interface TimeDomainDegeri {
  /** ISO gün (YYYY-AA-GG) ya da null */
  imlec: string | null
  setImlec: (t: string | null) => void
  sec?: (t: string) => void
}
export const TimeDomainBaglami = createContext<TimeDomainDegeri>({ imlec: null, setImlec: () => undefined })
export const useTimeDomain = (): TimeDomainDegeri => useContext(TimeDomainBaglami)
