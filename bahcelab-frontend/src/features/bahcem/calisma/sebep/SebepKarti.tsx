import { BAGIMSIZLIK_AD, GUVEN_SOZ, SEBEP_YANITLARI, useOlaySebep, useSebepYaniti, type KontrolSebep, type SebepCikti, type SebepSirasi } from '../../api/sebepApi'
import { gunAy } from '../../lib/format'

const KONTROL_SIRASI: KontrolSebep[] = ['don', 'su', 'besin', 'hastalik', 'mekanik', 'goruntu']

/** Sebep başına sözcük: yüzde YOK. Seçilen sebep güven sözcüğünü taşır; diğerleri «destek var ama yetersiz» / «kanıt yok» / «kanıt aleyhte». */
function sebepSozu(s: SebepSirasi, c: SebepCikti): { soz: string; isaret: string; sinif: string } {
  if (c.secim === s.sebep) return { soz: GUVEN_SOZ[c.guven], isaret: c.guven === 'zayif' ? '△' : '●', sinif: 'text-app-text' }
  const lehte = s.kanitlar.some((k) => k.yon === 'lehte')
  const aleyhte = s.kanitlar.some((k) => k.yon === 'aleyhte')
  if (lehte) return { soz: 'destek var, yetersiz', isaret: '◐', sinif: 'text-app-text-muted' }
  if (aleyhte) return { soz: 'kanıt aleyhte', isaret: '○', sinif: 'text-app-text-muted' }
  return { soz: 'kanıt yok', isaret: '○', sinif: 'text-app-text-muted' }
}

function KanitSatiri({ k }: { k: SebepSirasi['kanitlar'][number] }) {
  return (
    <li className="flex items-baseline gap-2 py-1" data-testid="sebep-kanit" data-yon={k.yon} data-bagimsizlik={k.bagimsizlik.split(':')[0]}>
      <span aria-hidden className="w-4 shrink-0 text-center font-semibold">{k.yon === 'lehte' ? '✓' : '✕'}</span>
      <span className="min-w-0 flex-1">
        <span className="sr-only">{k.yon === 'lehte' ? 'Lehte: ' : 'Aleyhte: '}</span>
        {k.metin}
        {k.baglanti && <> · <a href={k.baglanti} target="_blank" rel="noreferrer" className="font-semibold text-app-accent underline-offset-2 hover:underline">kaynak</a></>}
      </span>
      <span className={`shrink-0 rounded-[4px] border px-1.5 py-px text-caption font-semibold ${k.bagimsizlik.startsWith('bagimsiz') ? 'border-app-text text-app-text' : 'border-app-border text-app-text-muted'}`} data-testid="sebep-bagimsizlik">
        {BAGIMSIZLIK_AD[k.bagimsizlik] ?? k.bagimsizlik}
      </span>
    </li>
  )
}

function SebepSatiri({ s, c }: { s: SebepSirasi; c: SebepCikti }) {
  const m = sebepSozu(s, c)
  return (
    <li className="border-t border-app-border first:border-t-0" data-testid="sebep-satiri" data-sebep={s.sebep} data-secili={String(c.secim === s.sebep)}>
      <details>
        <summary className="flex min-h-11 cursor-pointer items-baseline gap-2 py-2 max-[560px]:min-h-12">
          <span aria-hidden className={`w-4 shrink-0 text-center ${m.sinif}`}>{m.isaret}</span>
          <b className="text-body">{s.ad}</b>
          <span className={`text-small font-semibold ${m.sinif}`} data-testid="sebep-soz">{m.soz}</span>
          {c.secim === s.sebep && s.bagimsiz_kanit === 0 && <span className="text-caption text-app-text-muted">(bağımsız kanıt yok)</span>}
        </summary>
        {s.kanitlar.length === 0 ? (
          <p className="pb-2 pl-6 text-small text-app-text-muted">Bu sebep için lehte ya da aleyhte kanıt bulunamadı.</p>
        ) : (
          <ul className="pb-2 pl-1 text-small leading-snug" aria-label={`${s.ad} kanıt satırları`}>
            {s.kanitlar.map((k) => <KanitSatiri key={k.kod} k={k} />)}
          </ul>
        )}
      </details>
    </li>
  )
}

function KontrolListesi({ c }: { c: SebepCikti }) {
  return (
    <details className="mt-3 rounded-md border border-app-border px-3" data-testid="sebep-kontrol">
      <summary className="flex min-h-11 cursor-pointer items-center text-body font-semibold">Sahada şunlara bakın</summary>
      <div className="pb-2 text-small leading-snug">
        <p className="text-app-text-muted">Besin, hastalık/zararlı ve budama/hasat uydudan ayırt edilemez; bunlar bir sebep olarak SEÇİLMEZ, yalnızca sahada kontrol listesidir.</p>
        {KONTROL_SIRASI.filter((k) => c.kontrol_listesi[k]?.maddeler.length).map((k) => (
          <div key={k} className="mt-2" data-testid="sebep-kontrol-grup" data-sebep={k}>
            <h4 className="font-semibold">{c.kontrol_listesi[k].ad}</h4>
            <ul className="mt-0.5 list-disc pl-5">
              {c.kontrol_listesi[k].maddeler.map((m) => (
                <li key={m.metin}>
                  {m.metin}{' '}
                  {m.url && m.kaynak ? <a href={m.url} target="_blank" rel="noreferrer" className="font-semibold text-app-accent underline-offset-2 hover:underline">({m.kaynak})</a> : <span className="text-app-text-muted">(kaynak yok)</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  )
}

function SebepYanitiSatiri({ gardenId, c }: { gardenId: string; c: SebepCikti }) {
  const yanitla = useSebepYaniti(gardenId, c.olay.id)
  return (
    <div className="mt-3" role="group" aria-label="Sebep neydi?" data-testid="sebep-yaniti">
      <p className="text-body font-semibold">Sebep buydu: hangisi?</p>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {SEBEP_YANITLARI.map((y) => (
          <button key={y.kod} type="button" aria-pressed={c.kullanici_yaniti === y.kod} disabled={yanitla.isPending} onClick={() => yanitla.mutate(y.kod)} data-testid={`sebep-yanit-${y.kod}`}
            className={`min-h-11 rounded-md border px-3 text-small font-semibold disabled:opacity-60 ${c.kullanici_yaniti === y.kod ? 'border-app-text bg-app-text text-app-panel' : 'border-app-text hover:bg-app-card-hover'}`}>
            {y.ad}
          </button>
        ))}
      </div>
      <p className="mt-1 text-caption text-app-text-muted" role="status">
        {c.kullanici_yaniti ? 'Yanıtınız Saha Defteri’ne yazıldı; değiştirebilirsiniz.' : 'Yanıtınız Saha Defteri’ne yazılır ve sebep ayrıştırmayı iyileştirir.'}
      </p>
    </div>
  )
}

/**
 * «Olası sebepler (kesin değil)» (ADIM 10B, ADR 0033). Sıralı sebepler (yüzde yok); her sebepte lehte/aleyhte kanıt satırları + bağımsızlık etiketi; «Sahada şunlara bakın» listesi; «Sebep buydu» yanıtı.
 * Görüntü kapısı devredeyse YALNIZ tek satır: «Görüntü kaynaklı olabilir — bir sonraki net görüntüyü bekleyin» + tahmini sonraki geçiş. S2 düşüşü içermeyen olayda (404) hiçbir şey çizilmez.
 */
export function SebepKarti({ gardenId, olayId, baslik = true }: { gardenId: string; olayId: string; baslik?: boolean }) {
  const { data, isLoading, isError } = useOlaySebep(gardenId, olayId)
  if (isLoading) return <p role="status" className="py-2 text-small text-app-text-muted">Olası sebepler hesaplanıyor…</p>
  if (isError || !data) return null
  if (data.kapi.kapali) {
    return (
      <p className="py-1 text-small leading-snug" data-testid="sebep-kapi" role="status">
        <b>{data.kapi.mesaj}</b>
        {data.kapi.beklenen_gecis && <span className="num text-app-text-muted"> Beklenen geçiş: {gunAy(data.kapi.beklenen_gecis, 'never')} (tahmini).</span>}
      </p>
    )
  }
  return (
    <section aria-label="Olası sebepler" data-testid="sebep-karti" data-secim={data.secim ?? 'belirsiz'} data-guven={data.guven}>
      {baslik && <h3 className="text-body font-semibold">Olası sebepler (kesin değil)</h3>}
      {data.secim === null && (
        <p className="mt-1 text-small leading-snug" data-testid="sebep-belirsiz"><b>Belirsiz:</b> veriler tek bir sebebi ayırt etmeye yetmiyor. {data.belirsiz_nedeni}</p>
      )}
      {data.guven_dusuruldu && <p className="mt-1 text-small text-app-text-muted" data-testid="sebep-kararsiz">Sıralama küçük ağırlık değişimlerinde değişiyor; bu yüzden güven sözcüğü bir kademe düşürüldü.</p>}
      <ul className="mt-1" aria-label="Sebepler (olasılık sırasıyla)">
        {data.siralama.map((s) => <SebepSatiri key={s.sebep} s={s} c={data} />)}
      </ul>
      <KontrolListesi c={data} />
      <SebepYanitiSatiri gardenId={gardenId} c={data} />
      <p className="mt-2 text-caption leading-snug text-app-text-muted">{data.aciklama}</p>
    </section>
  )
}
