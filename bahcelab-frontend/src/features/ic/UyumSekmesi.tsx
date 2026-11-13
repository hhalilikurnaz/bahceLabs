import { useUyum, type UyumSeri } from './icApi'
import { DurumEtiketi, Yuklenir } from './izlemeOrtak'
import { gunAy, sayi } from './izlemeBicim'

const KONTROL_AD: Record<string, string> = {
  era5_meteostat_tmax: 'ERA5 ↔ Meteostat · Tmax sapması (°C)',
  era5_imerg_aylik: 'ERA5 ↔ IMERG · aylık yağış (göreli)',
  olcer_era5: 'Bahçe yağış ölçeri ↔ ERA5 (göreli)',
  etc_wapor: 'Hesaplanan ETc ↔ WaPOR (göreli)',
}

const G = 640
const Y = 120

/** Sapma serisi: x = tarih sırası, y = sapma; gri bant = ±eşik (drift bandı). Boş (null) sapma noktası çizilmez, çizgi kopar (uydurma enterpolasyon yok). */
function SapmaGrafik({ s }: { s: UyumSeri }) {
  const v = s.noktalar.map((n) => n.sapma)
  const dolu = v.filter((x): x is number => x !== null)
  if (dolu.length === 0) return <p className="mt-2 text-app-text-muted" data-testid="uyum-bos">Hesaplanabilir sapma yok (veri yetersiz): çizim uydurulmaz.</p>
  const m = Math.max(s.esik * 1.4, ...dolu.map(Math.abs))
  const x = (i: number) => (v.length === 1 ? G / 2 : 12 + (i * (G - 24)) / (v.length - 1))
  const y = (d: number) => Y / 2 - (d / m) * (Y / 2 - 8)
  let yol = ''
  v.forEach((d, i) => { yol += d === null ? '' : `${yol === '' || v[i - 1] === null ? 'M' : 'L'}${x(i).toFixed(1)},${y(d).toFixed(1)} ` })
  return (
    <svg viewBox={`0 0 ${G} ${Y}`} className="mt-2 w-full max-w-[640px] text-app-accent" role="img" aria-label={`${KONTROL_AD[s.kontrol] ?? s.kontrol}: son ${v.length} haftanın sapması, eşik ±${sayi(s.esik)}`} data-testid="uyum-grafik">
      <rect x="0" y={y(s.esik)} width={G} height={y(-s.esik) - y(s.esik)} className="fill-current text-app-border" opacity="0.6" />
      <line x1="0" x2={G} y1={y(0)} y2={y(0)} className="stroke-current text-app-text-dim" strokeDasharray="3 3" />
      <path d={yol} fill="none" stroke="currentColor" strokeWidth="2" />
      {s.noktalar.map((n, i) => n.sapma === null ? null : <circle key={n.tarih} cx={x(i)} cy={y(n.sapma)} r="3.5" className={n.durum === 'drift' ? 'fill-current text-app-danger' : 'fill-current text-app-accent'}><title>{`${n.tarih} · sapma ${sayi(n.sapma, 3)} · ${n.durum}`}</title></circle>)}
    </svg>
  )
}

export function UyumSekmesi() {
  const q = useUyum()
  return (
    <Yuklenir q={q} baslik="Kaynak uyumu">
      {(v) => v.seriler.length === 0 ? <p data-testid="uyum-hic">Henüz uyum kaydı yok (haftalık izleme işi koşunca dolar).</p> : (
        <div className="grid gap-4 lg:grid-cols-2" data-testid="ic-uyum">
          {v.seriler.map((s) => {
            const son = s.noktalar[s.noktalar.length - 1]
            return (
              <section key={`${s.kontrol}${s.garden_id ?? ''}`} className="rounded-md border border-app-border bg-app-card p-4" aria-label={KONTROL_AD[s.kontrol] ?? s.kontrol} data-testid="uyum-seri" data-kontrol={s.kontrol} data-durum={s.son_durum}>
                <h2 className="text-lead font-semibold">{KONTROL_AD[s.kontrol] ?? s.kontrol}</h2>
                <p className="mt-0.5 text-app-text-muted">{s.bahce ?? 'Genel (bahçeden bağımsız)'} · eşik ±{sayi(s.esik)} · <DurumEtiketi durum={s.son_durum} /></p>
                <SapmaGrafik s={s} />
                {son && <p className="mt-1 text-app-text-muted">Son: {gunAy(son.tarih)} · değer {sayi(son.deger, 3)} · taban {sayi(son.taban, 3)} · sapma {sayi(son.sapma, 3)} · n={son.n}</p>}
              </section>
            )
          })}
        </div>
      )}
    </Yuklenir>
  )
}
