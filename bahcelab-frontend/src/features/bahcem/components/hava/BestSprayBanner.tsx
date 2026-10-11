import { SprayCan } from 'lucide-react'
import { Card } from '@/components/ui'
import type { Weather } from '../../api/weatherApi'
import { todayIstanbul } from '../../lib/dates'
import { bestSprayTime, noSprayReason } from '../../lib/spray'

/** Hava sekmesinin üstündeki büyük satır: haftanın en iyi ilaçlama zamanı; yoksa nedeni. */
export function BestSprayBanner({ weather }: { weather: Weather }) {
  const today = todayIstanbul()
  const best = bestSprayTime(
    weather.gunler.map((d) => ({ tarih: d.tarih, uygunSaat: d.ilaclama.uygunSaat, enIyiAralik: d.ilaclama.enIyiAralik })),
    today,
  )
  return (
    <Card aria-label="Bu hafta ilaçlama zamanı" data-testid="best-spray" className="flex items-start gap-3 border-app-accent/40 bg-app-accent-soft p-4">
      <SprayCan className="mt-1 h-6 w-6 shrink-0 text-app-accent" aria-hidden />
      <div className="min-w-0">
        {best ? (
          <>
            <p className="font-display text-h1 text-app-text">
              Bu hafta ilaçlama için en iyi zaman:{' '}
              <span className="text-[color:var(--color-spray-ok)]" data-testid="best-spray-time">
                {best.gun} {best.aralik[0]}–{best.aralik[1]}
              </span>
            </p>
            <p className="text-small text-app-text-muted">Rüzgâr, yağış ve sıcaklık koşullarına göre en uzun uygun gündüz aralığı yalnızca gün doğumu–batımı arası; yaklaşık bir değerlendirmedir, ürün etiketindeki koşullar esastır.</p>
          </>
        ) : (
          <>
            <p className="font-display text-h1 text-app-text" data-testid="best-spray-none">
              Bu hafta ilaçlama için uygun zaman görünmüyor
            </p>
            <p className="text-small text-app-text-muted" data-testid="best-spray-reason">
              {noSprayReason(weather.saatlik)}
            </p>
          </>
        )}
      </div>
    </Card>
  )
}
