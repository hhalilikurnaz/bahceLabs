import type { KaynakCipi as Cip } from '../../../api/suApi'
import { gunAy, kaynakSatiri } from '../../../lib/format'

/** Her grafiğin altında: kaynak · çözünürlük · tarih (+ not: model tahmini, geçiş günü, ön değer). */
export function KaynakCipi({ cip, testId }: { cip: Cip | undefined; testId: string }) {
  if (!cip) return null
  return (
    <p className="mt-1.5 inline-block rounded-full border border-app-border px-2.5 py-0.5 text-[11px] leading-snug text-app-text-muted" data-testid={testId}>
      {kaynakSatiri([cip.ad, cip.cozunurluk, cip.tarih ? gunAy(cip.tarih, 'always') : null, cip.not_])}
    </p>
  )
}
