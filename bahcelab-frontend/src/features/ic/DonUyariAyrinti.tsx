import { useDonUyari, type Wilson } from './icApi'
import { gunAy, sayi, yuzde } from './izlemeBicim'
import { Yuklenir } from './izlemeOrtak'

const YANIT_AD = { oldu: 'oldu', olmadi: 'olmadı', bilmiyorum: 'bilmiyorum' } as const

/** Oran + %95 güven aralığı + ADR referans çizgisi (tek ölçek 0–1): nokta = gözlenen oran, çubuk = Wilson aralığı, kesikli çizgi = ADR 0031 beklentisi. Örnek yetersizse «yetersiz örnek» yazılır. */
function GuvenAraligi({ ad, w, referans, referansAd, testId }: { ad: string; w: Wilson; referans: number; referansAd: string; testId: string }) {
  const X = (v: number) => 8 + v * 284
  return (
    <figure className="min-w-0" data-testid={testId} data-yeterli={String(w.yeterli)}>
      <figcaption className="text-small"><b>{ad}</b>: {w.oran === null ? 'veri yok' : <><b className="tabular-nums">{yuzde(w.oran)}</b> <span className="text-app-text-muted">({w.k}/{w.n}; %95 aralık {yuzde(w.alt)}–{yuzde(w.ust)})</span></>}{w.oran !== null && !w.yeterli && <span className="text-app-warn"> · yetersiz örnek</span>}</figcaption>
      <svg viewBox="0 0 300 44" className="mt-1 w-full max-w-[340px]" role="img" aria-label={`${ad}: ${w.oran === null ? 'veri yok' : `${yuzde(w.oran)}, %95 aralık ${yuzde(w.alt)} ile ${yuzde(w.ust)}`}; ${referansAd} ${yuzde(referans)}`}>
        <line x1={X(0)} x2={X(1)} y1="26" y2="26" className="stroke-current text-app-border-strong" strokeWidth="1" />
        {[0, 0.25, 0.5, 0.75, 1].map((t) => <g key={t}><line x1={X(t)} x2={X(t)} y1="22" y2="30" className="stroke-current text-app-border-strong" /><text x={X(t)} y="42" textAnchor="middle" className="fill-current text-app-text-muted" fontSize="11">{Math.round(t * 100)}</text></g>)}
        <line x1={X(referans)} x2={X(referans)} y1="4" y2="30" strokeDasharray="3 3" strokeWidth="1.6" className="stroke-current text-app-danger" />
        <text x={referans > 0.6 ? X(referans) - 4 : X(referans) + 4} textAnchor={referans > 0.6 ? 'end' : 'start'} y="12" fontSize="11" className="fill-current text-app-danger">{referansAd} {yuzde(referans)}</text>
        {w.oran !== null && w.alt !== null && w.ust !== null && (
          <g className="text-app-accent"><line x1={X(w.alt)} x2={X(w.ust)} y1="26" y2="26" strokeWidth="5" className="stroke-current" opacity="0.45" /><circle cx={X(w.oran)} cy="26" r="4.5" className="fill-current" /></g>
        )}
      </svg>
    </figure>
  )
}

/** `don_uyari` satırının açılır ayrıntısı (mevcut sekmede; yeni ekran değil): birikimli FAR/POD + %95 güven aralığı + ADR 0031 referansı + gece gece tablo. */
export function DonUyariAyrinti() {
  const q = useDonUyari(true)
  return (
    <Yuklenir q={q} baslik="Don uyarısı ayrıntısı">
      {(v) => (
        <div className="py-2" data-testid="don-uyari-ayrinti">
          <div className="grid gap-3 md:grid-cols-3">
            <GuvenAraligi ad="Yanlış alarm (kullanıcı yanıtı)" w={v.kullanici.far} referans={v.referans.far} referansAd="ADR kıyı FAR" testId="don-far-kullanici" />
            <GuvenAraligi ad="Yanlış alarm (istasyon gözlemi)" w={v.istasyon.far} referans={v.referans.far} referansAd="ADR kıyı FAR" testId="don-far-istasyon" />
            <GuvenAraligi ad="Yakalama (POD, istasyon gözlemi)" w={v.istasyon.pod} referans={v.referans.pod} referansAd="ADR kıyı POD" testId="don-pod-istasyon" />
          </div>
          <p className="mt-2 text-app-text-muted">{v.kullanici.aciklama} Uyarı gecesi {v.kullanici.uyari_gece}, yanıt {v.kullanici.yanit} (oldu {v.kullanici.oldu} · olmadı {v.kullanici.olmadi} · bilmiyorum {v.kullanici.bilmiyorum}). {v.istasyon.aciklama} Gözlemli gece {v.istasyon.gozlemli_gece}, don gecesi {v.istasyon.don_gecesi}.</p>
          <p className="text-app-text-muted">Referans: {v.referans.kaynak}. Aralık: Wilson %95. Küçük örneklemde geniştir; n &lt; {v.referans.min_n} iken «yetersiz örnek».</p>
          {v.geceler.length === 0 ? <p className="mt-2" data-testid="don-uyari-bos">Henüz «izle» ya da «uyarı» seviyesinde gece yok.</p> : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[760px] text-left" data-testid="don-uyari-geceler">
                <thead className="text-app-text-muted"><tr>{['Tarih', 'Bahçe', 'En soğuk model (°C)', 'Kademe', 'Kritik eşik (°C)', 'Kullanıcı yanıtı', 'En yakın istasyon (sabah en düşüğü)'].map((h) => <th key={h} className="pb-1 pr-3 font-semibold">{h}</th>)}</tr></thead>
                <tbody>
                  {v.geceler.map((g) => (
                    <tr key={g.gece + g.bahce} className="border-t border-app-border align-top" data-testid="don-uyari-gece-satiri" data-kademe={g.kademe}>
                      <td className="py-1 pr-3 whitespace-nowrap tabular-nums">{gunAy(g.gece)}</td>
                      <td className="pr-3">{g.bahce}</td>
                      <td className="pr-3 tabular-nums">{sayi(g.en_soguk_c, 1)}</td>
                      <td className="pr-3 font-semibold"><span aria-hidden>{g.kademe === 'uyarı' ? '✕ ' : '▲ '}</span>{g.kademe}</td>
                      <td className="pr-3 tabular-nums">{sayi(g.kritik_c, 1)}</td>
                      <td className="pr-3">{g.yanit ? YANIT_AD[g.yanit] : '—'}</td>
                      <td>{g.istasyon ? `${g.istasyon.ad} (${sayi(g.istasyon.mesafe_km, 0)} km): ${sayi(g.istasyon.tmin_c, 1)} °C` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Yuklenir>
  )
}
