import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { GUVEN_AD, useOlaylar, type Olay } from '../../api/olayApi'
import { gunAy } from '../../lib/format'
import { birlesikMi, suz, TUR_SUZGECLERI, turAnahtarlari, yilaGore, zamanOrani, type TurSuzgeci } from '../../lib/gecmis'
import { gardenPath } from '../../lib/routes'

const GUVENLER: Olay['guven'][] = ['yuksek', 'orta', 'dusuk']
const sade = (iso: string) => gunAy(iso, 'always')

function Cip({ aktif, onClick, children, testId }: { aktif: boolean; onClick: () => void; children: React.ReactNode; testId: string }) {
  return (
    <button type="button" aria-pressed={aktif} onClick={onClick} data-testid={testId} className={`min-h-9 rounded-md border px-2.5 text-[12px] font-semibold max-[560px]:min-h-11 ${aktif ? 'border-app-text bg-app-text text-app-panel' : 'border-app-border text-app-text-muted hover:border-app-text'}`}>
      {children}
    </button>
  )
}

/** Çizelge şeridi: 5 şerit (tür), x = zaman; birleşen olay her iki şeritte AYNI olaya bağlı işaretle görünür ama listede tek satırdır. */
function Serit({ olaylar, ilk, son, secili, sec }: { olaylar: Olay[]; ilk: number; son: number; secili: string | null; sec: (id: string) => void }) {
  const yillar = Array.from({ length: son - ilk + 1 }, (_, i) => ilk + i)
  return (
    <div className="relative mt-3" data-testid="olay-serit" role="group" aria-label="Olayların zaman şeridi">
      {TUR_SUZGECLERI.map((t) => (
        <div key={t.id} className="relative flex h-7 items-center border-b border-app-border/60">
          <span className="w-[78px] shrink-0 truncate text-[11px] text-app-text-muted max-[560px]:w-[58px]" title={t.ad}>{t.ad}</span>
          <div className="relative h-full flex-1">
            {olaylar.filter((o) => turAnahtarlari(o).includes(t.id)).map((o) => (
              <button
                key={o.id + t.id}
                type="button"
                onClick={() => sec(o.id)}
                aria-label={`${o.tur_adi}, ${sade(o.baslangic)}`}
                data-testid="olay-isaret"
                className={`absolute top-1/2 grid h-4 min-w-4 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-sm text-[10px] leading-none ${secili === o.id ? 'bg-app-text text-app-panel' : 'text-app-text hover:bg-app-card-hover'}`}
                style={{ left: `${zamanOrani(o.baslangic, ilk, son) * 100}%` }}
              >
                {t.isaret}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="relative ml-[78px] h-4 max-[560px]:ml-[58px]">
        {yillar.filter((_, i) => i % (yillar.length > 8 ? 2 : 1) === 0).map((y) => (
          <span key={y} className="num absolute -translate-x-1/2 text-[10px] text-app-text-dim" style={{ left: `${zamanOrani(`${y}-07-01`, ilk, son) * 100}%` }}>{y}</span>
        ))}
      </div>
    </div>
  )
}

/**
 * Olay zaman çizelgesi (2015→bugün): tür ve güven süzgeçleri, yıla göre liste; birleşen olay tek iz. Satıra dokununca ayrıntı açılır,
 * «Haritada göster» çalışma alanını olayın görüldüğü ilk net görüntüde açar. Atmosfer şüpheleri olay SAYILMAZ (yalnız sayıları not edilir).
 */
export function OlayZamanCizelgesi({ gardenId, yil, yilTemizle }: { gardenId: string; yil: number | null; yilTemizle: () => void }) {
  const sorgu = useOlaylar(gardenId)
  const [turler, setTurler] = useState<Set<TurSuzgeci>>(new Set())
  const [guvenler, setGuvenler] = useState<Set<Olay['guven']>>(new Set())
  const [secili, setSecili] = useState<string | null>(null)
  const tum = useMemo(() => sorgu.data?.olaylar ?? [], [sorgu.data])
  const liste = useMemo(() => suz(tum, turler, guvenler, yil), [tum, turler, guvenler, yil])
  const gruplar = useMemo(() => yilaGore(liste), [liste])
  const yillar = tum.map((o) => Number(o.baslangic.slice(0, 4)))
  const ilk = yillar.length ? Math.min(...yillar) : new Date().getFullYear()
  const son = new Date().getFullYear()
  const degistir = <T,>(set: Set<T>, v: T, yaz: (s: Set<T>) => void) => yaz(new Set(set.has(v) ? [...set].filter((x) => x !== v) : [...set, v]))
  const ac = (id: string) => setSecili(secili === id ? null : id)

  return (
    <section aria-label="Olay zaman çizelgesi" className="rounded-md border border-app-border bg-app-card p-3.5" data-testid="olay-cizelgesi">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[13px] font-semibold">Olaylar · {ilk}–{son}</h3>
        <span className="num text-[11.5px] text-app-text-muted" data-testid="olay-sayisi">{liste.length} olay{sorgu.data && sorgu.data.supheler.length > 0 ? ` · ${sorgu.data.supheler.length} atmosfer şüphesi olay sayılmadı` : ''}</span>
      </div>
      <p className="mt-1 text-[12.5px] text-app-text-muted">Don, aşırı yağış, rüzgâr ve uydudan görülen ani değişimler. Birleşen olaylar (örn. don + optik hasar izi) tek iz olarak gösterilir. Eşikler ön değerdir.</p>
      <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Tür süzgeci">
        {TUR_SUZGECLERI.map((t) => <Cip key={t.id} testId={`tur-${t.id}`} aktif={turler.has(t.id)} onClick={() => degistir(turler, t.id, setTurler)}>{t.isaret} {t.ad}</Cip>)}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label="Güven süzgeci">
        {GUVENLER.map((g) => <Cip key={g} testId={`guven-${g}`} aktif={guvenler.has(g)} onClick={() => degistir(guvenler, g, setGuvenler)}>{GUVEN_AD[g]}</Cip>)}
        {yil !== null && <Cip testId="yil-suzgeci" aktif onClick={yilTemizle}>{yil} ✕</Cip>}
      </div>
      {sorgu.isLoading ? (
        <div role="status" aria-label="Olaylar yükleniyor" className="mt-3 h-24 animate-pulse rounded bg-app-card-hover" />
      ) : liste.length === 0 ? (
        <p className="mt-3 text-[13px] text-app-text-muted" data-testid="olay-bos">{tum.length === 0 ? 'Bu bahçe için kayıtlı olay yok.' : 'Bu süzgeçle eşleşen olay yok.'}</p>
      ) : (
        <>
          <Serit olaylar={liste} ilk={ilk} son={son} secili={secili} sec={ac} />
          <div className="mt-3 space-y-3">
            {gruplar.map((g) => (
              <div key={g.yil}>
                <h4 className="num text-[12px] font-semibold text-app-text-muted">{g.yil}</h4>
                <ul className="mt-1 divide-y divide-app-border/60">
                  {g.olaylar.map((o) => (
                    <li key={o.id} data-testid="olay-satiri" data-tur={o.tur} data-birlesik={String(birlesikMi(o))}>
                      <button type="button" onClick={() => ac(o.id)} aria-expanded={secili === o.id} className="flex min-h-11 w-full items-baseline gap-2 py-1.5 text-left hover:bg-app-card-hover">
                        <span className="num w-[128px] shrink-0 text-[12px] text-app-text-muted max-[560px]:w-[92px]">{o.baslangic === o.bitis ? sade(o.baslangic) : `${gunAy(o.baslangic, 'never')}–${gunAy(o.bitis, 'never')}`}</span>
                        <span className="min-w-0 flex-1 text-[13px] font-medium">{o.tur_adi}</span>
                        <span className="shrink-0 text-[11.5px] text-app-text-muted">{GUVEN_AD[o.guven]}</span>
                      </button>
                      {secili === o.id && (
                        <div className="mb-2 rounded border border-app-border bg-app-panel px-3 py-2 text-[12.5px] leading-snug" data-testid="olay-ayrinti">
                          <p>{o.baslangic === o.bitis ? sade(o.baslangic) : `${sade(o.baslangic)} – ${sade(o.bitis)}`} · {o.kaynak_sayisi} kaynak kaydı{o.alan_da ? ` · yaklaşık ${o.alan_da.toFixed(1).replace('.', ',')} da` : ''}{o.siddet ? ` · ${o.siddet}` : ''}</p>
                          {o.durum === 'bekliyor' && <p className="mt-1 text-app-text-muted">Sonraki net görüntü doğrulayacak (doğrulama bekliyor).</p>}
                          <Link to={`${gardenPath(gardenId)}?olay=${o.id}`} data-testid="olay-haritada" className="mt-1.5 inline-flex min-h-11 items-center rounded-md border border-app-text px-3 text-[12.5px] font-semibold hover:bg-app-card-hover">Haritada göster ↗</Link>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
