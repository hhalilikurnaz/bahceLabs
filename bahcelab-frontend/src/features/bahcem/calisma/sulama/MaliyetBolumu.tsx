import { type Aralik, type PlanYaniti } from '../../api/sulamaApi'
import { sayi } from '../../lib/format'

const AY = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']

/** Aralık çubuğu: tek sayı değil p10–p90 aralığı, ortanca işaretli. */
function AralikCubugu({ a, birim, testId }: { a: Aralik; birim: string; testId: string }) {
  const genis = Math.max(1, a.ust - a.alt)
  const orta = ((a.orta - a.alt) / genis) * 100
  return (
    <div data-testid={testId}>
      <p className="text-h2 font-semibold tabular-nums">{sayi(a.alt, 0)}–{sayi(a.ust, 0)} <small className="text-small font-medium text-app-text-dim">{birim}</small></p>
      <div className="relative mt-2 h-2 rounded-full bg-app-border" aria-hidden><span className="absolute inset-y-0 left-0 right-0 rounded-full bg-app-text-dim/60" /><span className="absolute -top-1 h-4 w-0.5 bg-app-text" style={{ left: `${orta}%` }} /></div>
      <p className="mt-1 text-caption text-app-text-muted">ortanca {sayi(a.orta, 0)} {birim}</p>
    </div>
  )
}

function AylikCubuklar({ aylik, genislik = 560 }: { aylik: PlanYaniti['aylik']; genislik?: number }) {
  const maks = Math.max(1, ...aylik.flatMap((a) => [a.plan_m3, a.uygulanan_m3 ?? 0, a.gecen_yil_plan_m3 ?? 0]))
  const [sol, alt, H] = [8, 22, 150]
  const w = (genislik - sol) / Math.max(1, aylik.length)
  const y = (v: number) => H - alt - (v / maks) * (H - alt - 18)
  const bw = Math.max(6, (w - 10) / 3)
  return (
    <svg viewBox={`0 0 ${genislik} ${H}`} className="block w-full" role="img" aria-label="Aylık su, m³: bu yılın planı, uyguladığınız ve geçen yılın planı" data-testid="aylik-cubuklar">
      <line x1={sol} x2={genislik} y1={H - alt} y2={H - alt} stroke="var(--color-app-border-strong)" />
      {aylik.map((a, i) => {
        const x = sol + i * w + 5
        return (
          <g key={a.ay} opacity={a.tahmin ? 0.5 : 1}>
            {a.gecen_yil_plan_m3 != null && <rect x={x} y={y(a.gecen_yil_plan_m3)} width={bw} height={H - alt - y(a.gecen_yil_plan_m3)} fill="var(--color-app-border-strong)" data-testid="aylik-gecen" />}
            <rect x={x + bw} y={y(a.plan_m3)} width={bw} height={H - alt - y(a.plan_m3)} fill="var(--color-app-text)" data-testid="aylik-plan" />
            {a.uygulanan_m3 != null && <rect x={x + 2 * bw} y={y(a.uygulanan_m3)} width={bw} height={H - alt - y(a.uygulanan_m3)} fill="var(--color-app-card)" stroke="var(--color-app-text)" strokeWidth={1.5} data-testid="aylik-uygulanan" />}
            <text x={x + 1.5 * bw} y={H - 6} textAnchor="middle" fontSize={12} fill="var(--color-app-text-dim)">{AY[a.ay - 1]}</text>
          </g>
        )
      })}
    </svg>
  )
}

/** Maliyet: m³, kWh, TL (bu hafta) · aylık çubuklar (plan / uyguladığınız / geçen yıl) · sezon tahmini ARALIK. TL yalnız fiyat ve pompa biliniyorsa; yoksa nedeni yazılır. */
export function MaliyetBolumu({ plan, onProfil }: { plan: PlanYaniti; onProfil: () => void }) {
  const m = plan.hafta_maliyet
  const p = plan.projeksiyon
  return (
    <div className="grid gap-3" data-testid="maliyet-bolumu">
      <section className="rounded-md border border-app-border bg-app-card p-4" aria-label="Bu hafta" data-testid="maliyet-hafta">
        <h3 className="text-lead font-semibold">Önümüzdeki 7 gün</h3>
        {m ? (
          <>
            <dl className="mt-2 grid grid-cols-3 gap-3 max-[560px]:grid-cols-1">
              <div><dt className="text-caption text-app-text-muted">su</dt><dd className="text-h2 font-semibold tabular-nums" data-testid="maliyet-m3">{sayi(m.m3, 0)} m³</dd></div>
              <div><dt className="text-caption text-app-text-muted">elektrik</dt><dd className="text-h2 font-semibold tabular-nums" data-testid="maliyet-kwh">{m.kwh == null ? '—' : `${sayi(m.kwh, 0)} kWh`}</dd></div>
              <div><dt className="text-caption text-app-text-muted">maliyet</dt><dd className="text-h2 font-semibold tabular-nums" data-testid="maliyet-tl">{m.toplam_tl == null ? '—' : `${sayi(m.toplam_tl, 0)} TL`}</dd></div>
            </dl>
            {m.toplam_tl != null && <p className="mt-1 text-caption text-app-text-muted">{m.fiyat_kaynagi === 'kullanici' ? 'Sizin girdiğiniz fiyat' : 'EPDK tarımsal sulama tarifesi'}{m.su_ucreti_tl != null ? ` · su ücreti ${sayi(m.su_ucreti_tl, 0)} TL dahil` : ''}</p>}
            {m.eksik && <p className="mt-2 text-small text-app-warn" data-testid="maliyet-eksik">{m.eksik} <button type="button" onClick={onProfil} className="font-semibold underline">Bilgileri düzenle</button></p>}
          </>
        ) : null}
      </section>
      <section className="rounded-md border border-app-border bg-app-card p-4" aria-label="Aylık su" data-testid="maliyet-aylik">
        <h3 className="text-lead font-semibold">Aylık su <span className="text-small font-normal text-app-text-dim">m³</span></h3>
        {plan.aylik.length ? <div className="mt-2"><AylikCubuklar aylik={plan.aylik} />
          <p className="mt-1 flex flex-wrap gap-x-4 text-caption text-app-text-muted"><span><i className="mr-1 inline-block h-2.5 w-2.5 bg-app-text align-middle" />bu yılın planı</span>{plan.aylik.some((a) => a.uygulanan_m3 != null) && <span><i className="mr-1 inline-block h-2.5 w-2.5 border border-app-text align-middle" />uyguladığınız</span>}<span><i className="mr-1 inline-block h-2.5 w-2.5 bg-app-border-strong align-middle" />geçen yılın planı</span></p></div>
          : <p className="mt-2 text-small text-app-text-muted">Aylık çubuklar için hava verisi gerekir.</p>}
        {plan.uygulanan_sezon_m3 != null && <p className="mt-1 text-small" data-testid="uygulanan-toplam">Bu yıl Saha Defteri’ne işlediğiniz sulama: <b>{sayi(plan.uygulanan_sezon_m3, 0)} m³</b> ({plan.uygulanan_kayit_sayisi} kayıt)</p>}
      </section>
      <section className="rounded-md border border-app-border bg-app-card p-4" aria-label="Sezon tahmini" data-testid="maliyet-sezon">
        <h3 className="text-lead font-semibold">Sezon boyunca</h3>
        {p?.m3 ? (
          <div className="mt-2 grid grid-cols-2 gap-6 max-[560px]:grid-cols-1">
            <AralikCubugu a={p.m3} birim="m³" testId="sezon-aralik-m3" />
            {p.tl ? <AralikCubugu a={p.tl} birim="TL" testId="sezon-aralik-tl" /> : <p className="text-small text-app-text-muted" data-testid="sezon-tl-yok">{m?.eksik ?? 'TL için birim fiyat ve pompa bilgisi gerekir.'}</p>}
          </div>
        ) : <p className="mt-2 text-small text-app-text-muted">Aralık için yeterli geçmiş hava yılı yok.</p>}
        {p?.m3 && <p className="mt-2 text-caption text-app-text-muted" data-testid="sezon-aralik-not">Tek sayı değil aralık: bugünkü planın kuralı {p.ilk_yil}–{p.son_yil} arasındaki {p.yil_sayisi} sezonun gerçek havasıyla oynatıldı; %{p.alt_yuzde}–%{p.ust_yuzde} aralığı gösterilir (kuru yıl üst uçta). Ön değer · mühendis onayı bekliyor.</p>}
      </section>
      <p className="text-caption text-app-text-dim">Kaynaklar: {plan.kaynaklar.map((k) => k.ad).join(' · ')}. Katalog sürümü {plan.katalog_surum}.</p>
    </div>
  )
}
