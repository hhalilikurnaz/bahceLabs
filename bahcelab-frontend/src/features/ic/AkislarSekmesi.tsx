import { useAkislar, type AkisNokta, type AkislarYanit } from './icApi'
import { DurumEtiketi, Yuklenir } from './izlemeOrtak'
import { DURUM_META, gunAy, sayi } from './izlemeBicim'

/** Gecikme zaman çizelgesi: akış başına günlük anlık görüntüler (izleme_akis); her gün bir kare, durumu renk + title ile. Kayıt olmayan gün boş bırakılır (uydurulmaz). */
function Zaman({ veri }: { veri: AkislarYanit }) {
  const gunler = Array.from(new Set(veri.zaman.map((z) => z.tarih))).sort()
  const akislar = veri.guncel
  const nokta = new Map<string, AkisNokta>(veri.zaman.map((z) => [`${z.akis}|${z.tarih}`, z]))
  if (gunler.length === 0) return <p className="mt-2 text-app-text-muted" data-testid="zaman-bos">Henüz günlük anlık görüntü yok (günlük izleme işi koşunca dolar).</p>
  return (
    <div className="mt-2 overflow-x-auto" data-testid="akis-zaman">
      <p className="text-app-text-muted">{gunAy(gunler[0]!)} → {gunAy(gunler[gunler.length - 1]!)} · {gunler.length} günlük kayıt · kare = o günün durumu</p>
      <ul className="mt-2 space-y-1.5">
        {akislar.map((a) => {
          const sat = gunler.map((g) => nokta.get(`${a.akis}|${g}`))
          const say = (d: string) => sat.filter((x) => x?.durum === d).length
          return (
            <li key={a.akis} className="flex items-center gap-3" data-testid="akis-zaman-satir">
              <span className="w-44 shrink-0 font-semibold">{a.ad}</span>
              <span role="img" aria-label={`${a.ad}: ${gunler.length} günde ${say('taze')} taze, ${say('gecikmeli')} gecikmeli, ${say('kopuk')} kopuk, ${say('bos')} veri yok`} className="flex gap-px">
                {sat.map((x, i) => <span key={gunler[i]} title={`${gunler[i]} · ${x ? `${DURUM_META[x.durum]?.ad ?? x.durum}${x.gecikme_gun !== null ? ` · ${sayi(x.gecikme_gun, 1)} gün gecikme` : ''}` : 'kayıt yok'}`} className={`h-4 w-2 rounded-sm ${x ? DURUM_META[x.durum]?.hucre ?? 'bg-app-border' : 'bg-app-card-hover'}`} />)}
              </span>
              <span className="tabular-nums text-app-text-muted">{say('kopuk') + say('gecikmeli')} sorunlu gün</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function AkislarSekmesi() {
  const q = useAkislar()
  return (
    <Yuklenir q={q} baslik="Akışlar">
      {(v) => (
        <div data-testid="ic-akislar">
          <section className="overflow-x-auto rounded-md border border-app-border bg-app-card p-4" aria-label="Akış durum tablosu">
            <h2 className="text-lead font-semibold">Akış durumu <span className="font-normal text-app-text-muted">· {v.bugun}</span></h2>
            <table className="mt-2 w-full min-w-[820px] text-left">
              <thead className="text-app-text-muted"><tr>{['Akış', 'Durum', 'Son veri', 'Gecikme (gün)', 'Beklenen / kabul / kopuk (gün)', 'Boşluk (gün)', 'Neden'].map((h) => <th key={h} className="pb-1 pr-3 font-semibold">{h}</th>)}</tr></thead>
              <tbody>
                {v.guncel.map((a) => (
                  <tr key={a.akis} className="border-t border-app-border align-top" data-testid="akis-satir" data-akis={a.akis} data-durum={a.durum}>
                    <td className="py-1.5 pr-3 font-semibold">{a.ad}</td>
                    <td className="pr-3"><DurumEtiketi durum={a.durum} /></td>
                    <td className="pr-3 tabular-nums">{a.son_veri ?? '—'}</td>
                    <td className="pr-3 tabular-nums">{sayi(a.gecikme_gun, 1)}</td>
                    <td className="pr-3 tabular-nums">{sayi(a.beklenen_gun, 1)} / {sayi(a.kabul_gecikme_gun, 1)} / {sayi(a.kopuk_gun, 1)}</td>
                    <td className="pr-3 tabular-nums">{a.bosluk_gun ?? '—'}</td>
                    <td className="text-app-text-muted">{a.neden}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section className="mt-4 rounded-md border border-app-border bg-app-card p-4" aria-label="Gecikme zaman çizelgesi">
            <h2 className="text-lead font-semibold">Gecikme zaman çizelgesi</h2>
            <Zaman veri={v} />
            <p className="mt-2 flex flex-wrap gap-4 text-app-text-muted">{(['taze', 'gecikmeli', 'kopuk', 'bos'] as const).map((d) => <span key={d} className="flex items-center gap-1.5"><span aria-hidden className={`inline-block h-3 w-3 rounded-sm ${DURUM_META[d]!.hucre}`} />{DURUM_META[d]!.ad}</span>)}</p>
          </section>
        </div>
      )}
    </Yuklenir>
  )
}
