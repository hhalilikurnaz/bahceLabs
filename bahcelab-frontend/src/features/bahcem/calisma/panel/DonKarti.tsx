import { useDon, useDonGeriBildirim, sayiTr, type DonGecesi, type DonYanit } from '../../api/donApi'
import { gunAy } from '../../lib/format'

const SOZ_META = {
  düşük: { isaret: '○', sinif: 'text-app-text-muted' },
  orta: { isaret: '▲', sinif: 'text-app-warn' },
  yüksek: { isaret: '✕', sinif: 'text-app-danger' },
} as const
const GECE_AD = ['Bu gece', 'Yarın gece']
const YANIT_AD: Record<DonYanit, string> = { oldu: 'Oldu', olmadi: 'Olmadı', bilmiyorum: 'Bilmiyorum' }

function GeceSatiri({ g, i }: { g: DonGecesi; i: number }) {
  const m = SOZ_META[g.olasilik_sozu]
  const ad = GECE_AD[i] ?? `${gunAy(g.gece, 'never')} gecesi`
  return (
    <li className="border-t border-app-border py-2.5 first:border-t-0" data-testid="don-gece" data-seviye={g.seviye} data-soz={g.olasilik_sozu}>
      <p className="text-body">
        <span className="font-semibold">{ad}</span>{i < GECE_AD.length && <span className="text-app-text-muted"> ({gunAy(g.gece, 'never')})</span>}
        {' · '}
        <b className={m.sinif} data-testid="don-soz"><span aria-hidden>{m.isaret} </span>don olasılığı: {g.olasilik_sozu}</b>
      </p>
      <p className="mt-0.5 text-small text-app-text-muted" data-testid="don-gece-ayrinti">
        {g.en_soguk_saat !== null ? `En soğuk saat ≈ ${String(g.en_soguk_saat).padStart(2, '0')}:00` : 'En soğuk saat belirsiz'} · en soğuk model tahmini {sayiTr(g.en_soguk_c)} °C · kritik eşik {sayiTr(g.kritik_c)} °C ({g.organ_adlari.join(', ').toLowerCase()}; evre: {g.evre.replace('_', ' ')})
      </p>
    </li>
  )
}

/** «Önümüzdeki 3 gece» kartı (ADIM 10 Dilim 2): olasılık SÖZCÜKLERİ, en soğuk saat, kritik eşik, temkin notu, «nasıl hesaplandı»; orta/yüksekse kaynaklı «ne yapmalı»; dün uyarı verildiyse «Don oldu mu?». */
export function DonKarti({ gardenId }: { gardenId: string }) {
  const { data, isLoading, isError } = useDon(gardenId)
  const yanitla = useDonGeriBildirim(gardenId)
  if (isLoading) return <p role="status" className="px-1 text-small text-app-text-muted">Gece don tahmini yükleniyor…</p>
  if (isError || !data) return null
  return (
    <section className="rounded-md border border-app-border bg-app-card p-4" aria-label="Önümüzdeki 3 gece" data-testid="don-karti">
      <h2 className="text-lead font-semibold">Önümüzdeki 3 gece</h2>
      {data.geceler.length === 0 ? (
        <p className="mt-2 text-small text-app-text-muted" data-testid="don-veri-yok">{data.veri_yok_nedeni ?? 'Gece don tahmini bulunamadı.'}</p>
      ) : (
        <ul className="mt-1" aria-label="Geceler">
          {data.geceler.map((g, i) => <GeceSatiri key={g.gece} g={g} i={i} />)}
        </ul>
      )}
      {data.dun_soru && (
        <div className="mt-3 rounded-md border border-app-border-strong px-3 py-2" data-testid="don-soru" role="group" aria-label="Don oldu mu?">
          <p className="text-body font-semibold">Dün gece ({gunAy(data.dun_soru.gece, 'never')}) için don uyarısı vermiştik. Don oldu mu?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {data.dun_soru.secenekler.map((s) => (
              <button key={s} type="button" disabled={yanitla.isPending} onClick={() => yanitla.mutate({ gece: data.dun_soru!.gece, yanit: s })} data-testid={`don-yanit-${s}`}
                className="min-h-11 rounded-md border border-app-text px-4 text-small font-semibold hover:bg-app-card-hover disabled:opacity-60">{YANIT_AD[s]}</button>
            ))}
          </div>
          <p className="mt-1 text-caption text-app-text-muted">Yanıtınız Saha Defteri'ne yazılır ve uyarıları iyileştirir.</p>
        </div>
      )}
      {data.geceler.length > 0 && <p className="mt-2 text-small text-app-text-muted" data-testid="don-temkin">{data.temkin_notu}</p>}
      {data.onlemler.length > 0 && (
        <div className="mt-3" data-testid="don-onlemler">
          <h3 className="text-body font-semibold">Ne yapmalı?</h3>
          <p className="mt-0.5 text-caption text-app-text-muted">{data.onlem_notu}</p>
          <ul className="mt-2 grid gap-1.5">
            {data.onlemler.map((o) => (
              <li key={o.kod} data-testid="don-onlem" data-kod={o.kod}>
                <details className="rounded-md border border-app-border px-3">
                  <summary className="min-h-11 cursor-pointer py-2.5 text-small font-semibold">{o.ad}</summary>
                  <div className="pb-3 text-small">
                    <p>{o.ne}</p>
                    <ul className="mt-1.5 list-disc pl-5">{o.kosullar.map((k) => <li key={k}>{k}</li>)}</ul>
                    <p className="mt-1.5 font-semibold">Dikkat</p>
                    <ul className="list-disc pl-5">{o.uyarilar.map((k) => <li key={k}>{k}</li>)}</ul>
                    <p className="mt-1.5 text-caption text-app-text-muted">Kaynak: <a className="underline" href={o.url} target="_blank" rel="noreferrer" data-testid="don-onlem-kaynak">{o.kaynak}</a></p>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </div>
      )}
      <details className="mt-3 text-small text-app-text-muted" data-testid="don-nasil">
        <summary className="min-h-6 cursor-pointer font-semibold underline">Nasıl hesaplandı?</summary>
        <p className="mt-1">{data.nasil}</p>
        <p className="mt-1">Eşikler: {data.esik_durumu} · kural {data.kural_surum}</p>
      </details>
    </section>
  )
}
