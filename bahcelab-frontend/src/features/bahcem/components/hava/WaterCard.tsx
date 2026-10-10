import type { RainTotal, WaterBalance } from '../../api/weatherApi'
import { compareToLastYear, formatMm } from '../../lib/weather'

const signed = (value: number) =>
  `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} mm`

/** Su dengesi (yağış − ET₀, bilgi amaçlı) ve yağış toplamları (geçen yılın aynı dönemiyle). */
export function WaterCard({ balances, totals }: { balances: WaterBalance[]; totals: RainTotal[] }) {
  return (
    <section className="space-y-4 rounded-2xl bg-app-card p-3.5" aria-label="Su dengesi ve yağış">
      <div>
        <h3 className="text-[13px] font-semibold text-app-text">Su dengesi</h3>
        {balances.length === 0 ? (
          <p className="mt-1.5 text-[12px] text-app-text-muted">Geçmiş yağış ve buharlaşma verisi henüz hazır değil.</p>
        ) : (
          <ul className="mt-2 space-y-2" data-testid="water-balance">
            {balances.map((b) => (
              <li key={b.gun} className="rounded-xl bg-app-bg/50 px-3 py-2">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[12px] text-app-text-muted">Son {b.gun} gün</span>
                  <span className={`text-[16px] font-semibold ${b.dengeMm < 0 ? 'text-amber-300' : 'text-emerald-300'}`}>
                    {signed(b.dengeMm)}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] leading-snug text-app-text-dim">{b.aciklama}</p>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[11px] leading-snug text-app-text-dim">
          Yağış − ET₀ (referans buharlaşma-terleme). Bilgi amaçlıdır; sulama reçetesi değildir.
        </p>
      </div>

      <div>
        <h3 className="text-[13px] font-semibold text-app-text">Yağış toplamları</h3>
        <ul className="mt-2 divide-y divide-app-border/60" data-testid="rain-totals">
          {totals.map((t) => {
            const note = compareToLastYear(t.mm, t.gecenYilMm)
            return (
              <li key={t.etiket} className="flex items-baseline justify-between gap-3 py-2 text-[12px]">
                <span className="text-app-text-muted">{t.etiket}</span>
                <span className="text-right">
                  <span className="text-[14px] font-semibold text-app-text">{formatMm(t.mm)}</span>
                  <span className="block text-[11px] text-app-text-dim">
                    {t.gecenYilMm != null ? `Geçen yıl ${formatMm(t.gecenYilMm)}` : 'Geçen yıl verisi yok'}
                    {note ? ` · ${note}` : ''}
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
