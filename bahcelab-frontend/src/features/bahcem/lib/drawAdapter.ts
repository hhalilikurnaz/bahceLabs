/**
 * terra-draw sürümüne bağımlı tek nokta: "çizimi bitir".
 *
 * Kurulu sürümde (terra-draw 1.37) çokgen çizimini kodla bitirmek için doğrudan bir API YOKTUR; bitirme yalnızca
 * Enter tuşu (`keyEvents.finish`) ile tetiklenir. Odak bir düğmedeyken gerçek Enter o düğmeye gideceğinden,
 * aynı tuş olayı haritanın tuvaline gönderilir. Sürüm yükseltilince doğrudan API varsa yalnızca bu dosya değişir
 * (`tests/drawAdapter.test.ts` ve e2e "küçük alan" senaryosu bunu korur).
 */

/** `dispatchEvent` yeterlidir: tuval (HTMLCanvasElement) ya da testte sahte hedef. */
export interface KeyTarget {
  dispatchEvent(event: Event): boolean
}

export const FINISH_KEY = 'Enter'

/** terra-draw'ın okuduğu alanlarla (`key`) tuş olayı üretir; ortam KeyboardEvent'e sahip olmasa da çalışır. */
function keyEvent(type: 'keydown' | 'keyup'): Event {
  return Object.assign(new Event(type, { bubbles: true, cancelable: true }), { key: FINISH_KEY })
}

/** Çizimi bitirir: tuş basma ve bırakma olaylarını hedefe gönderir. */
export function finishDrawing(target: KeyTarget | null | undefined): boolean {
  if (!target) return false
  target.dispatchEvent(keyEvent('keydown'))
  target.dispatchEvent(keyEvent('keyup'))
  return true
}
