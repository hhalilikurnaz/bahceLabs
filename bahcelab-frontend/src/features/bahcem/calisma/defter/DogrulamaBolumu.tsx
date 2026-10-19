import { useMemo, useState } from 'react'
import { useDogrula, useDogrulamaKartlari, SONUC_AD, type DogrulamaKarti, type Sonuc } from '../../api/sahaApi'
import { gunAy } from '../../lib/format'
import { FotoSerit } from './FotoSerit'

const SONUCLAR: Sonuc[] = ['gerceklesti', 'gerceklesmedi', 'bilinmiyor']
const GUVEN: Record<string, string> = { yuksek: 'güven yüksek', orta: 'güven orta', dusuk: 'güven düşük' }

function Kart({ gardenId, kart }: { gardenId: string; kart: DogrulamaKarti }) {
  const dogrula = useDogrula(gardenId)
  const [secim, setSecim] = useState<Sonuc | null>(null)
  const [not, setNot] = useState(kart.aciklama ?? '')
  const [foto, setFoto] = useState<File | null>(null)
  const acik = secim !== null
  const tarih = kart.baslangic === kart.bitis ? gunAy(kart.baslangic, 'always') : `${gunAy(kart.baslangic, 'always')} – ${gunAy(kart.bitis, 'always')}`
  const kaydet = () => secim && dogrula.mutate({ kart, sonuc: secim, aciklama: not.trim() || null, foto }, { onSuccess: () => (setSecim(null), setFoto(null)) })
  return (
    <li className="border-b border-[var(--rule)] py-2.5" data-testid="dogrulama-karti" data-anahtar={kart.hedef_anahtar} data-sonuc={kart.sonuc ?? 'yok'} data-durum={kart.durum}>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <b className="text-[13.5px]">{kart.baslik}</b>
        <span className="mono text-[11.5px] text-[var(--ink-3)]">{tarih}</span>
        {kart.guven && <span className="text-[11.5px] text-[var(--ink-3)]">{GUVEN[kart.guven]}</span>}
        {kart.durum === 'bekliyor' && <span className="text-[11.5px] font-semibold text-[var(--st-izle)]" data-testid="bekliyor-rozeti">doğrulama bekliyor</span>}
        {kart.durum === 'uyari' && <span className="text-[11.5px] text-[var(--ink-3)]">uyarı</span>}
      </div>
      <p className="mt-0.5 text-[12.5px] text-[var(--ink-2)]">Uydu haklı mıydı?</p>
      <div className="mt-1 flex flex-wrap gap-1.5" role="group" aria-label={`${kart.baslik}: Uydu haklı mıydı?`}>
        {SONUCLAR.map((s) => (
          <button key={s} type="button" aria-pressed={(secim ?? kart.sonuc) === s} onClick={() => setSecim(s)} data-testid={`sonuc-${s}`} className={`min-h-9 border px-2.5 text-[12px] font-semibold max-[560px]:min-h-11 ${(secim ?? kart.sonuc) === s ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]' : 'border-[var(--rule-2)] text-[var(--ink-2)] hover:border-[var(--ink)]'}`}>
            {SONUC_AD[s]}
          </button>
        ))}
      </div>
      {kart.sonuc && !acik && (
        <div className="mt-1 text-[12.5px] text-[var(--ink-2)]" data-testid="dogrulama-yanit">
          {kart.aciklama && <p>Not: {kart.aciklama}</p>}
          <FotoSerit fotolar={kart.fotograflar} />
        </div>
      )}
      {acik && (
        <div className="mt-2 grid gap-1.5" data-testid="dogrulama-formu">
          <label className="text-[11.5px] font-semibold text-[var(--ink-3)]" htmlFor={`not-${kart.hedef_anahtar}`}>Not (isteğe bağlı)</label>
          <textarea id={`not-${kart.hedef_anahtar}`} value={not} onChange={(e) => setNot(e.target.value)} maxLength={1000} rows={2} placeholder="Sahada ne gördünüz?" className="w-full border border-[var(--rule-2)] bg-transparent p-2 text-[13px]" />
          <label className="inline-flex min-h-9 w-fit cursor-pointer items-center border border-[var(--rule-2)] px-2.5 text-[12px] font-semibold hover:border-[var(--ink)] max-[560px]:min-h-11">
            {foto ? `Fotoğraf: ${foto.name.slice(0, 24)}` : 'Fotoğraf ekle'}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" data-testid="dogrulama-foto" onChange={(e) => setFoto(e.target.files?.[0] ?? null)} />
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={kaydet} disabled={dogrula.isPending} data-testid="dogrulama-kaydet" className="btn primary max-[560px]:!h-11">Kaydet</button>
            <button type="button" onClick={() => setSecim(null)} className="btn quiet max-[560px]:!h-11">Vazgeç</button>
          </div>
          {dogrula.isError && <p role="alert" className="text-[12.5px] text-[var(--st-dikkat)]">Kaydedilemedi: {(dogrula.error as Error).message}</p>}
        </div>
      )}
    </li>
  )
}

/** «Uydu haklı mıydı?»: her olay, uyarı ve doğrulama bekleyen kayıt için bir kart; yanıt olay anahtarıyla saklanır ve doğruluk özetini besler. */
export function DogrulamaBolumu({ gardenId }: { gardenId: string }) {
  const sorgu = useDogrulamaKartlari(gardenId)
  const [hepsi, setHepsi] = useState(false)
  const kartlar = useMemo(() => sorgu.data?.kartlar ?? [], [sorgu.data])
  const gosterilen = useMemo(() => (hepsi ? kartlar : kartlar.filter((k) => k.sonuc === null)), [kartlar, hepsi])
  return (
    <section aria-label="Uydu haklı mıydı?" data-testid="dogrulama-bolumu">
      <span className="eyebrow">UYDU HAKLI MIYDI?</span>
      <h2 className="serif mt-1 text-[22px] leading-tight">Uydunun gördüğünü siz doğrulayın.</h2>
      <p className="mt-1 text-[13px] text-[var(--ink-2)]">Her olay ve uyarı için sahada ne gördüğünüzü işaretleyin. Yanıtlarınız uydunun hangi türde ne kadar doğru çıktığını ölçer; ceza ya da puan üretmez.</p>
      <div className="mt-2 flex gap-1.5" role="group" aria-label="Kart süzgeci">
        <button type="button" aria-pressed={!hepsi} onClick={() => setHepsi(false)} data-testid="kartlar-bekleyen" className={`min-h-9 border px-2.5 text-[12px] font-semibold max-[560px]:min-h-11 ${!hepsi ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]' : 'border-[var(--rule-2)]'}`}>Yanıt bekleyen ({sorgu.data?.bekleyen ?? 0})</button>
        <button type="button" aria-pressed={hepsi} onClick={() => setHepsi(true)} data-testid="kartlar-hepsi" className={`min-h-9 border px-2.5 text-[12px] font-semibold max-[560px]:min-h-11 ${hepsi ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]' : 'border-[var(--rule-2)]'}`}>Hepsi ({kartlar.length})</button>
      </div>
      {sorgu.isLoading ? (
        <div role="status" aria-label="Kartlar yükleniyor" className="mt-3 h-20 animate-pulse bg-[var(--paper-3)]" />
      ) : gosterilen.length === 0 ? (
        <p className="mt-3 text-[13px] text-[var(--ink-3)]" data-testid="dogrulama-bos">{kartlar.length === 0 ? 'Henüz doğrulanacak olay ya da uyarı yok.' : 'Yanıt bekleyen kart yok. «Hepsi» ile yanıtlananları görebilirsiniz.'}</p>
      ) : (
        <ul className="mt-2" data-testid="dogrulama-listesi">
          {gosterilen.slice(0, hepsi ? 200 : 40).map((k) => <Kart key={`${k.hedef_tur}:${k.hedef_anahtar}:${k.sonuc ?? ''}`} gardenId={gardenId} kart={k} />)}
        </ul>
      )}
    </section>
  )
}
