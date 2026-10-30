import { useState } from 'react'

/** İlk görünüşte BİR KEZ çizim: gerçek veri ilk geldiğinde true, sonrasında sabit (veri değişince tekrar animasyon yok). */
export function useIlkCizim(hazir: boolean): boolean {
  const [goruldu, setGoruldu] = useState(false)
  if (hazir && !goruldu) setGoruldu(true) // render sırasında durum güncellemesi (React'in önerdiği «türetilmiş durum» kalıbı); bir kez
  return hazir || goruldu
}
