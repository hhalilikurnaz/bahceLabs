import { Card } from '@/components/ui'
import type { RainTotal, WaterBalance } from '../../api/weatherApi'
import { compareToLastYear, formatMm } from '../../lib/weather'

const signed = (value: number) =>
  `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} mm`

/** Su durumu (yağış − buharlaşma, bilgi amaçlı) ve yağış toplamları (geçen yılın aynı dönemiyle). */
export function WaterCard({ balances, totals }: { balances: WaterBalance[]; totals: RainTotal[] }) {
  return (
    <Card className="space-y-5" aria-label="Su durumu ve yağış" data-testid="water-card">
      <div>
        <h3 className="font-display text-h2 text-app-text">Su durumu</h3>
        {balances.length === 0 ? (
          <p className="mt-1.5 text-body text-app-text-muted">Geçmiş yağış ve buharlaşma verisi henüz hazır değil.</p>
        ) : (
          <ul className="mt-2 space-y-2" data-testid="water-balance">
            {balances.map((b) => (
              <li key={b.gun} className="rounded-md bg-app-text/5 px-3 py-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-body text-app-text-muted">Son {b.gun} gün</span>
                  <span className={`tabular text-lead font-semibold ${b.dengeMm < 0 ? 'text-app-warn' : 'text-app-success'}`}>{signed(b.dengeMm)}</span>
                </div>
                <p className="mt-0.5 text-small text-app-text-muted">{b.aciklama}</p>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-caption text-app-text-dim">
          Denge = yağış − buharlaşma (ET₀: referans bitkinin suyu). Bilgi amaçlıdır; sulama reçetesi değildir.
        </p>
      </div>

      <div>
        <h3 className="font-display text-h2 text-app-text">Yağış toplamları</h3>
        <ul className="mt-1 divide-y divide-app-border" data-testid="rain-totals">
          {totals.map((t) => {
            const note = compareToLastYear(t.mm, t.gecenYilMm)
            return (
              <li key={t.etiket} className="flex items-baseline justify-between gap-3 py-2.5">
                <span className="text-body text-app-text-muted">{t.etiket}</span>
                <span className="text-right">
                  <span className="tabular block text-lead font-semibold text-app-text">{formatMm(t.mm)}</span>
                  <span className="block text-small text-app-text-dim">
                    {t.gecenYilMm != null ? `Geçen yıl ${formatMm(t.gecenYilMm)}` : 'Geçen yıl verisi yok'}
                    {note ? ` · ${note}` : ''}
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </Card>
  )
}
