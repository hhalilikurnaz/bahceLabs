import { useBahceler } from './icApi'
import { Yuklenir } from './izlemeOrtak'
import { GUVEN_AD } from './izlemeBicim'

const RENK = { yuksek: 'bg-app-success', orta: 'bg-app-warn', dusuk: 'bg-app-danger' } as const
const ISARET = { yuksek: '●', orta: '▲', dusuk: '✕' } as const

export function BahcelerSekmesi() {
  const q = useBahceler()
  return (
    <Yuklenir q={q} baslik="Bahçe güveni">
      {(v) => {
        const toplam = Math.max(v.toplam_bahce, 1)
        return (
          <div data-testid="ic-bahceler">
            <section className="rounded-md border border-app-border bg-app-card p-4" aria-label="Güven dağılımı">
              <h2 className="text-lead font-semibold">Güven dağılımı <span className="font-normal text-app-text-muted">· {v.toplam_bahce} bahçe</span></h2>
              <p className="mt-1 text-app-text-muted">Etiket kullanıcı panelleriyle AYNI güven servisinden gelir (Durum ekranının ek «bileşen verisi» koşulu hariç temel koşullar).</p>
              <div className="mt-3 flex h-4 w-full overflow-hidden rounded-sm bg-app-card-hover" role="img" aria-label={`yüksek ${v.dagilim.yuksek}, orta ${v.dagilim.orta}, düşük ${v.dagilim.dusuk}`}>
                {(['yuksek', 'orta', 'dusuk'] as const).map((k) => v.dagilim[k] > 0 && <span key={k} className={RENK[k]} style={{ width: `${(v.dagilim[k] / toplam) * 100}%` }} />)}
              </div>
              <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-1" data-testid="guven-dagilim">
                {(['yuksek', 'orta', 'dusuk'] as const).map((k) => <li key={k} data-guven={k}><span aria-hidden>{ISARET[k]} </span>{GUVEN_AD[k]}: <b className="tabular-nums">{v.dagilim[k]}</b></li>)}
              </ul>
            </section>
            <section className="mt-4 overflow-x-auto rounded-md border border-app-border bg-app-card p-4" aria-label="En düşük güvenli bahçeler">
              <h2 className="text-lead font-semibold">En düşük güvenli bahçeler</h2>
              {v.en_dusuk.length === 0 ? <p className="mt-2" data-testid="bahce-yok">Bu çalışma alanında bahçe yok.</p> : (
                <table className="mt-2 w-full min-w-[720px] text-left">
                  <thead className="text-app-text-muted"><tr>{['Bahçe', 'Güven', 'Koşul', 'Eksik koşullar (neden)'].map((h) => <th key={h} className="pb-1 pr-3 font-semibold">{h}</th>)}</tr></thead>
                  <tbody>
                    {v.en_dusuk.map((b) => (
                      <tr key={b.garden_id} className="border-t border-app-border align-top" data-testid="bahce-satir" data-guven={b.etiket}>
                        <td className="py-1.5 pr-3 font-semibold">{b.ad}</td>
                        <td className="pr-3"><span aria-hidden>{ISARET[b.etiket]} </span>{GUVEN_AD[b.etiket]}</td>
                        <td className="pr-3 tabular-nums">{b.puan}/{b.toplam}</td>
                        <td>{b.eksik.length === 0 ? <span className="text-app-text-muted">eksik koşul yok</span> : <ul className="list-disc pl-4">{b.eksik.map((e) => <li key={e}>{e}</li>)}</ul>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </div>
        )
      }}
    </Yuklenir>
  )
}
