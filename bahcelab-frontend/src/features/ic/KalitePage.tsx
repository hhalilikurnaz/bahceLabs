import { useState } from 'react'
import { ErrorState } from '@/components/ui'
import { useEtaBahceler, useEtaDetay, type EtaSahne } from './icApi'

const f = (x: number | null, n = 2): string => (x === null ? '—' : x.toLocaleString('tr-TR', { minimumFractionDigits: n, maximumFractionDigits: n }))
const pct = (x: number): string => `%${Math.round(x * 100)}`
const AY_AD: Record<string, string> = { '01': 'Oca', '02': 'Şub', '03': 'Mar', '04': 'Nis', '05': 'May', '06': 'Haz', '07': 'Tem', '08': 'Ağu', '09': 'Eyl', '10': 'Eki', '11': 'Kas', '12': 'Ara' }

function SahneSatiri({ s, esik }: { s: EtaSahne; esik: number }) {
  const sicrama = s.delta_etf !== null && Math.abs(s.delta_etf) > esik
  return (
    <tr className="border-t border-app-border align-top" data-testid="ic-sahne" data-durum={s.durum}>
      <td className="whitespace-nowrap py-1.5 pr-3 tabular-nums">{s.tarih}</td>
      <td className="pr-3">{s.platform ?? '—'}</td>
      <td className="pr-3">{s.durum === 'hesaplandi' ? 'hesaplandı' : s.durum === 'elendi' ? 'elendi' : 'ham'}</td>
      <td className="pr-3 tabular-nums">{pct(s.gecerli_oran)}</td>
      <td className="pr-3 tabular-nums" title="1 − iç tampon / tüm bahçe pikseli">{pct(s.karisik_pay)}</td>
      <td className="pr-3 tabular-nums">{s.ic_piksel}/{s.bahce_piksel}</td>
      <td className="pr-3 tabular-nums">{f(s.ndvi)}</td>
      <td className="pr-3 tabular-nums">{s.lst_k === null ? '—' : f(s.lst_k - 273.15, 1)}</td>
      <td className="pr-3 tabular-nums">{f(s.dt_k, 1)}</td>
      <td className="pr-3 tabular-nums">{f(s.c_sahne, 3)} / {f(s.c_uzun, 3)}</td>
      <td className="pr-3 font-semibold tabular-nums">{f(s.etf)}{s.etf_sigma !== null && Number.isFinite(s.etf_sigma) ? ` ±${f(s.etf_sigma)}` : ''}</td>
      <td className={`pr-3 tabular-nums ${sicrama ? 'font-semibold text-app-danger' : ''}`} data-testid={sicrama ? 'ic-sicrama' : undefined}>{s.delta_etf === null ? '—' : `${s.delta_etf > 0 ? '+' : ''}${f(s.delta_etf)}`}{sicrama ? ' ▲ eşik üstü' : ''}</td>
      <td className="pr-3 tabular-nums">{f(s.eta_mm)}</td>
      <td className="text-app-text-muted">{s.neden ?? ''}</td>
    </tr>
  )
}

/** İÇ KALİTE EKRANI (9J'nin ilk parçası): ETa hattının geçiş listesi, ETf/ETa, piksel payı, kalibrasyon, bağlam/doğrulama ve tutarlılık kapısı. Kullanıcıya gösterilmez; yalnız iç ekip (sunucu 403). */
export function KalitePage() {
  const liste = useEtaBahceler()
  const [secili, setSecili] = useState<string | null>(null)
  const id = secili ?? liste.data?.[0]?.garden_id ?? null
  const detay = useEtaDetay(id)
  if (liste.isLoading) return <p role="status" className="p-6">Yükleniyor…</p>
  if (liste.isError) return <div className="p-6"><ErrorState title="İç kalite ekranı açılamadı" error={liste.error} onRetry={() => void liste.refetch()} /></div>
  if (!liste.data || liste.data.length === 0) return <main className="mx-auto max-w-3xl p-6"><h1 className="text-h1 font-semibold">İç kalite · uydudan ETa</h1><p className="mt-3 text-body" data-testid="ic-bos">ETa hattı henüz hiçbir bahçe için koşmadı (<code>scripts/eta_calistir.py</code>).</p></main>
  const d = detay.data
  const durum = d?.durum
  return (
    <main className="mx-auto max-w-[1280px] p-4 text-small" data-testid="ic-kalite">
      <h1 className="text-h1 font-semibold">İç kalite · uydudan ETa (Landsat / SSEBop)</h1>
      <p className="mt-1 text-app-text-muted">Kullanıcıya gösterilmez. Kapı kapalıyken hiçbir kullanıcı ekranına ETa/ETf taşınmaz (ADR 0028).</p>
      <label className="mt-3 block max-w-sm font-semibold">Bahçe
        <select className="mt-1 min-h-11 w-full rounded-md border border-app-border-strong bg-app-card px-2 text-body" value={id ?? ''} onChange={(e) => setSecili(e.target.value)} data-testid="ic-bahce">
          {liste.data.map((b) => <option key={b.garden_id} value={b.garden_id}>{b.ad} · {f(b.alan_dekar, 1)} da · kapı {b.kapi === 'acik' ? 'AÇIK' : 'KAPALI'}</option>)}
        </select>
      </label>
      {detay.isLoading && <p role="status" className="mt-4">Yükleniyor…</p>}
      {detay.isError && <div className="mt-4"><ErrorState title="Detay alınamadı" error={detay.error} onRetry={() => void detay.refetch()} /></div>}
      {d && durum && (
        <>
          <section className="mt-4 rounded-md border border-app-border bg-app-card p-4" aria-label="Kapı durumu" data-testid="ic-kapi" data-kapi={durum.kapi}>
            <h2 className="text-lead font-semibold">Kullanıcıya açılma kapısı: <span className={durum.kapi === 'acik' ? 'text-app-success' : 'text-app-danger'}>{durum.kapi === 'acik' ? 'AÇIK' : 'KAPALI'}</span></h2>
            <p className="mt-1" data-testid="ic-kapi-neden">{durum.neden}</p>
            <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
              <div><dt className="text-app-text-muted">Tutarlılık (p90 |ΔETf|)</dt><dd className="font-semibold tabular-nums" data-testid="ic-p90">{f(durum.tutarlilik_p90, 3)} <span className="font-normal text-app-text-muted">/ eşik {f(durum.esik, 2)}</span></dd></div>
              <div><dt className="text-app-text-muted">Medyan |ΔETf|</dt><dd className="tabular-nums">{f(durum.tutarlilik_medyan, 3)}</dd></div>
              <div><dt className="text-app-text-muted">Çift sayısı</dt><dd className="tabular-nums">{durum.cift_sayisi}</dd></div>
              <div><dt className="text-app-text-muted">Geçiş (hesaplanan / toplam)</dt><dd className="tabular-nums">{durum.hesaplanan} / {durum.sahne_sayisi}</dd></div>
            </dl>
          </section>
          <section className="mt-4 overflow-x-auto rounded-md border border-app-border bg-app-card p-4" aria-label="Geçiş listesi">
            <h2 className="text-lead font-semibold">Geçişler</h2>
            <table className="mt-2 w-full min-w-[1100px] text-left">
              <thead className="text-app-text-muted"><tr>{['Tarih', 'Uydu', 'Durum', 'Geçerli', 'Karışık pay', 'İç/tüm px', 'NDVI', 'LST °C', 'dT K', 'c (sahne/uzun)', 'ETf ± σ', 'ΔETf', 'ETa mm', 'Neden'].map((h) => <th key={h} className="pb-1 pr-3 font-semibold">{h}</th>)}</tr></thead>
              <tbody>{d.sahneler.map((s) => <SahneSatiri key={`${s.tarih}${s.sahne_id}`} s={s} esik={durum.esik} />)}</tbody>
            </table>
          </section>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <section className="rounded-md border border-app-border bg-app-card p-4" aria-label="Kalibrasyon">
              <h2 className="text-lead font-semibold">Kalibrasyon</h2>
              <table className="mt-2 w-full text-left" data-testid="ic-kalibrasyon">
                <thead className="text-app-text-muted"><tr><th className="pr-3">Tür</th><th className="pr-3">Ay</th><th className="pr-3">Değer</th><th className="pr-3">Yayılım</th><th>n</th></tr></thead>
                <tbody>{d.kalibrasyon.map((k) => <tr key={k.tur + k.anahtar} className="border-t border-app-border"><td className="pr-3">{k.tur === 'c_faktoru' ? 'c-faktörü' : k.tur === 'ta_sapma' ? 'ERA5 Tmax sapması (°C, gözlem − ERA5)' : k.tur === 'era5_yuk' ? 'ERA5 hücre yüksekliği (m)' : k.tur}</td><td className="pr-3">{AY_AD[k.anahtar] ?? '—'}</td><td className="pr-3 tabular-nums">{f(k.deger, 3)}</td><td className="pr-3 tabular-nums">{f(k.yayilim, 3)}</td><td className="tabular-nums">{k.n}</td></tr>)}</tbody>
              </table>
            </section>
            <section className="rounded-md border border-app-border bg-app-card p-4" aria-label="Bağlam ve doğrulama">
              <h2 className="text-lead font-semibold">Bağlam (WaPOR L1, 300 m dekadal) ve doğrulama (ECOSTRESS V003)</h2>
              <p className="mt-1 text-app-text-muted">Bahçe değeri değildir: WaPOR piksel ≈ {f(d.baglam[0]?.piksel_m ?? null, 0)} m; bahçeye değen {d.baglam[0]?.piksel_dokunan ?? 0} piksel.</p>
              <table className="mt-2 w-full text-left" data-testid="ic-baglam">
                <thead className="text-app-text-muted"><tr><th className="pr-3">Dekad</th><th className="pr-3">ET mm/gün</th><th>Geçerli/değen px</th></tr></thead>
                <tbody>{d.baglam.slice(-12).map((b) => <tr key={b.bas} className="border-t border-app-border"><td className="pr-3 tabular-nums">{b.bas}</td><td className="pr-3 tabular-nums">{f(b.et_mm_gun)}</td><td className="tabular-nums">{b.piksel_gecerli}/{b.piksel_dokunan}</td></tr>)}</tbody>
              </table>
              {d.dogrulama.length > 0 && (
                <table className="mt-3 w-full text-left" data-testid="ic-dogrulama">
                  <thead className="text-app-text-muted"><tr><th className="pr-3">ECOSTRESS</th><th className="pr-3">ETdaily mm/gün</th><th>Geçerli/değen px</th></tr></thead>
                  <tbody>{d.dogrulama.map((b) => <tr key={b.sahne_id} className="border-t border-app-border"><td className="pr-3 tabular-nums">{b.tarih}</td><td className="pr-3 tabular-nums">{f(b.et_mm_gun)}</td><td className="tabular-nums">{b.piksel_gecerli}/{b.piksel_dokunan}</td></tr>)}</tbody>
                </table>
              )}
            </section>
          </div>
          <ul className="mt-4 list-disc pl-5 text-app-text-muted">{d.notlar.map((n) => <li key={n}>{n}</li>)}</ul>
        </>
      )}
    </main>
  )
}
