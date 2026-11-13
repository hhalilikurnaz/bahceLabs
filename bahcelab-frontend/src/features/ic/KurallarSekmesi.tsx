import { useKurallar } from './icApi'
import { Yuklenir } from './izlemeOrtak'
import { ayYil, sayi, yuzde } from './izlemeBicim'

export function KurallarSekmesi() {
  const q = useKurallar()
  return (
    <Yuklenir q={q} baslik="Kural performansı">
      {(v) => (
        <div data-testid="ic-kurallar">
          <section className="overflow-x-auto rounded-md border border-app-border bg-app-card p-4" aria-label="Kural özeti">
            <h2 className="text-lead font-semibold">Kural performansı <span className="font-normal text-app-text-muted">· {v.bas} → {v.bit}</span></h2>
            <p className="mt-1 text-app-text-muted">İsabet yalnız kullanıcı/yer gerçeği yanıtı olan kurallarda ve yeterli yanıt sayısında hesaplanır; aksi «ölçülemiyor» (uydurulmaz).</p>
            <table className="mt-2 w-full min-w-[640px] text-left">
              <thead className="text-app-text-muted"><tr>{['Kural', 'Üretilen', 'Yanıtlanan', 'Yanıt oranı', 'İsabet', 'Durum'].map((h) => <th key={h} className="pb-1 pr-3 font-semibold">{h}</th>)}</tr></thead>
              <tbody>
                {v.ozet.map((o) => (
                  <tr key={o.kural} className="border-t border-app-border" data-testid="kural-satir" data-kural={o.kural} data-durum={o.durum}>
                    <td className="py-1.5 pr-3 font-semibold">{o.ad}</td>
                    <td className="pr-3 tabular-nums">{o.uretilen}</td>
                    <td className="pr-3 tabular-nums">{o.yanit}</td>
                    <td className="pr-3 tabular-nums">{o.uretilen ? yuzde(o.yanit / o.uretilen) : '—'}</td>
                    <td className="pr-3 font-semibold tabular-nums">{o.isabet === null ? '—' : yuzde(o.isabet)}</td>
                    <td className={o.durum === 'olculuyor' ? 'text-app-success' : 'text-app-text-muted'}>{o.durum === 'olculuyor' ? '● ölçülüyor' : '○ ölçülemiyor'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <details className="mt-4 rounded-md border border-app-border bg-app-card p-4">
            <summary className="min-h-6 cursor-pointer font-semibold">Aylık döküm ({v.aylik.length} satır)</summary>
            <div className="overflow-x-auto">
              <table className="mt-2 w-full min-w-[720px] text-left" data-testid="kural-aylik">
                <thead className="text-app-text-muted"><tr>{['Ay', 'Kural', 'Üretilen', 'Yanıt', 'İsabet', 'Not'].map((h) => <th key={h} className="pb-1 pr-3 font-semibold">{h}</th>)}</tr></thead>
                <tbody>{v.aylik.map((a) => <tr key={a.kural + a.ay} className="border-t border-app-border"><td className="py-1 pr-3">{ayYil(a.ay)}</td><td className="pr-3">{a.ad}</td><td className="pr-3 tabular-nums">{a.uretilen}</td><td className="pr-3 tabular-nums">{a.yanit}</td><td className="pr-3 tabular-nums">{a.isabet === null ? '—' : `${yuzde(a.isabet)} (n=${a.isabet_n})`}</td><td className="text-app-text-muted">{a.neden || (a.yanit_orani !== null ? `yanıt ${sayi(a.yanit_orani * 100, 0)}%` : '')}</td></tr>)}</tbody>
              </table>
            </div>
          </details>
        </div>
      )}
    </Yuklenir>
  )
}
