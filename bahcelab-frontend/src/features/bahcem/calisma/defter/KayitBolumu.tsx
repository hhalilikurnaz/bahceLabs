import { useState } from 'react'
import type { FotoOnerisi } from '../../api/sahaApi'
import { KAYIT_TURLERI, KAYIT_TUR_AD, KAYIT_TUR_ISARET, fotoOner, useKayitOlustur, useKayitSil, useSahaKayitlari, type KayitTuru } from '../../api/sahaApi'
import { gunAy } from '../../lib/format'
import { bugunIstanbul, turSuz } from '../../lib/saha'
import { FotoSerit } from './FotoSerit'
import type { KonumSecimi } from './useKonumSecimi'

/** Yeni saha kaydı: tür, tarih, not, konum (haritada nokta ya da alan) ve en çok 5 fotoğraf. */
export function KayitFormu({ gardenId, konum }: { gardenId: string; konum: KonumSecimi }) {
  const olustur = useKayitOlustur(gardenId)
  const [tur, setTur] = useState<KayitTuru>('gozlem')
  const [tarih, setTarih] = useState(bugunIstanbul())
  const [not, setNot] = useState('')
  const [sure, setSure] = useState('')
  const [m3, setM3] = useState('')
  const [fotolar, setFotolar] = useState<File[]>([])
  const [oneri, setOneri] = useState<FotoOnerisi | null>(null)
  const eksikAlan = konum.mod === 'alan' && !konum.konum
  const eksikNokta = konum.mod === 'nokta' && !konum.konum
  const sayiAl = (t: string): number | undefined => {
    const n = Number(t.trim().replace(',', '.'))
    return t.trim() !== '' && Number.isFinite(n) && n > 0 ? n : undefined
  }
  const ayrinti = tur === 'sulama' && (sayiAl(sure) !== undefined || sayiAl(m3) !== undefined) ? { sure_dk: sayiAl(sure), m3: sayiAl(m3) } : undefined
  const kaydet = () =>
    olustur.mutate(
      { girdi: { tur, tarih, konum: konum.konum, aciklama: not.trim() || null, ayrinti }, fotolar },
      { onSuccess: () => (setNot(''), setSure(''), setM3(''), setFotolar([]), setOneri(null), konum.temizle()) },
    )
  return (
    <form onSubmit={(e) => (e.preventDefault(), kaydet())} className="grid gap-2" aria-label="Yeni saha kaydı" data-testid="kayit-formu">
      <div role="group" aria-label="Kayıt türü" className="flex flex-wrap gap-1.5">
        {KAYIT_TURLERI.map((t) => (
          <button key={t} type="button" aria-pressed={tur === t} onClick={() => setTur(t)} data-testid={`kayit-tur-${t}`} className={`min-h-9 border px-2.5 text-[12px] font-semibold max-[560px]:min-h-11 ${tur === t ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]' : 'border-[var(--rule-2)] text-[var(--ink-2)] hover:border-[var(--ink)]'}`}>
            <span aria-hidden>{KAYIT_TUR_ISARET[t]}</span> {KAYIT_TUR_AD[t]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid text-caption font-semibold text-[var(--ink-3)]">
          Tarih
          <input type="date" value={tarih} max={bugunIstanbul()} onChange={(e) => setTarih(e.target.value)} data-testid="kayit-tarih" className="mt-0.5 h-9 border border-[var(--rule-2)] bg-transparent px-2 text-[13px] font-normal text-[var(--ink)] max-[560px]:h-11" />
        </label>
        <div role="group" aria-label="Konum" className="flex flex-wrap gap-1.5">
          <button type="button" aria-pressed={konum.mod === 'yok'} onClick={() => konum.temizle()} data-testid="konum-yok" className={`min-h-9 border px-2.5 text-[12px] font-semibold max-[560px]:min-h-11 ${konum.mod === 'yok' ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]' : 'border-[var(--rule-2)]'}`}>Konumsuz</button>
          <button type="button" aria-pressed={konum.mod === 'nokta'} onClick={() => konum.setMod('nokta')} data-testid="konum-nokta" className={`min-h-9 border px-2.5 text-[12px] font-semibold max-[560px]:min-h-11 ${konum.mod === 'nokta' ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]' : 'border-[var(--rule-2)]'}`}>Haritada nokta</button>
          <button type="button" aria-pressed={konum.mod === 'alan'} onClick={() => konum.setMod('alan')} data-testid="konum-alan" className={`min-h-9 border px-2.5 text-[12px] font-semibold max-[560px]:min-h-11 ${konum.mod === 'alan' ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]' : 'border-[var(--rule-2)]'}`}>Haritada alan</button>
        </div>
      </div>
      {konum.mod === 'nokta' && <p className="text-small text-[var(--ink-2)]" data-testid="konum-ipucu">{konum.nokta ? 'Nokta seçildi; yerini değiştirmek için haritaya yeniden dokunun.' : 'Haritaya dokunarak noktayı işaretleyin.'}</p>}
      {konum.mod === 'alan' && (
        <p className="text-small text-[var(--ink-2)]" data-testid="konum-ipucu">
          {konum.koseler.length < 3 ? `Alanın köşelerine dokunun (en az 3; şu an ${konum.koseler.length}).` : `${konum.koseler.length} köşe seçildi.`}{' '}
          {konum.koseler.length > 0 && <button type="button" onClick={konum.geriAl} className="font-semibold underline underline-offset-2">Son köşeyi geri al</button>}
        </p>
      )}
      {tur === 'sulama' && (
        <div className="flex flex-wrap items-end gap-3" data-testid="sulama-miktar">
          <label className="grid text-caption font-semibold text-[var(--ink-3)]">Süre (dakika)<input inputMode="decimal" value={sure} onChange={(e) => setSure(e.target.value)} data-testid="sulama-sure" className="mt-0.5 h-9 w-28 border border-[var(--rule-2)] bg-transparent px-2 text-[13px] max-[560px]:h-11" /></label>
          <label className="grid text-caption font-semibold text-[var(--ink-3)]">ya da miktar (m³)<input inputMode="decimal" value={m3} onChange={(e) => setM3(e.target.value)} data-testid="sulama-m3" className="mt-0.5 h-9 w-28 border border-[var(--rule-2)] bg-transparent px-2 text-[13px] max-[560px]:h-11" /></label>
          <p className="basis-full text-caption text-[var(--ink-3)]">Süre ya da miktar girilirse sulama planının toprak kovasına eklenir; girilmezse yalnız not olarak kalır.</p>
        </div>
      )}
      <label className="grid text-caption font-semibold text-[var(--ink-3)]">
        Not
        <textarea value={not} onChange={(e) => setNot(e.target.value)} maxLength={1000} rows={2} data-testid="kayit-notu" placeholder="Ne gördünüz ya da yaptınız?" className="mt-0.5 w-full border border-[var(--rule-2)] bg-transparent p-2 text-[13px] font-normal text-[var(--ink)]" />
      </label>
      {oneri && (oneri.tarih || oneri.konum || oneri.konum_bahceden_uzak) && (
        <div role="status" className="border border-[var(--rule-2)] bg-[var(--paper-2)] p-2 text-small" data-testid="foto-onerisi">
          <p>{oneri.aciklama}</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {oneri.tarih && <button type="button" onClick={() => oneri.tarih && setTarih(oneri.tarih)} data-testid="oneri-tarih" className="btn quiet max-[560px]:!h-11">Tarihi kullan ({oneri.tarih})</button>}
            {oneri.konum && <button type="button" onClick={() => { konum.setMod('nokta'); konum.setNokta(oneri.konum!.coordinates as [number, number]) }} data-testid="oneri-konum" className="btn quiet max-[560px]:!h-11">Konumu kullan</button>}
            <button type="button" onClick={() => setOneri(null)} className="btn quiet max-[560px]:!h-11">Kullanma</button>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex min-h-9 cursor-pointer items-center border border-[var(--rule-2)] px-2.5 text-[12px] font-semibold hover:border-[var(--ink)] max-[560px]:min-h-11">
          {fotolar.length ? `${fotolar.length} fotoğraf seçildi` : 'Fotoğraf ekle'}
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" data-testid="kayit-foto" onChange={(e) => {
            const secilen = Array.from(e.target.files ?? []).slice(0, 5)
            setFotolar(secilen)
            setOneri(null)
            // Fotoğrafın EXIF tarih/konumu ÖNERİ olarak sorulur (sunucu okur; kayda ancak onayınızla yazılır)
            if (secilen[0]) void fotoOner(gardenId, secilen[0]).then(setOneri).catch(() => setOneri(null))
          }} />
        </label>
        <button type="submit" disabled={olustur.isPending || eksikAlan || eksikNokta} data-testid="kayit-kaydet" className="btn primary max-[560px]:!h-11">Kaydı ekle</button>
      </div>
      {olustur.isError && <p role="alert" className="text-small text-[var(--st-dikkat)]">Kaydedilemedi: {(olustur.error as Error).message}</p>}
    </form>
  )
}

/** Kayıt listesi (yeniden eskiye): tür süzgeci, haritada göster ve silme. */
export function KayitListesi({ gardenId, secili, sec }: { gardenId: string; secili: string | null; sec: (id: string) => void }) {
  const sorgu = useSahaKayitlari(gardenId)
  const sil = useKayitSil(gardenId)
  const [turler, setTurler] = useState<Set<KayitTuru>>(new Set())
  const liste = turSuz(sorgu.data ?? [], turler)
  const degistir = (t: KayitTuru) => setTurler(new Set(turler.has(t) ? [...turler].filter((x) => x !== t) : [...turler, t]))
  return (
    <section aria-label="Saha kayıtları" data-testid="kayit-listesi">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Kayıt türü süzgeci">
        {KAYIT_TURLERI.map((t) => (
          <button key={t} type="button" aria-pressed={turler.has(t)} onClick={() => degistir(t)} data-testid={`kayit-suz-${t}`} className={`min-h-9 border px-2 text-caption font-semibold max-[560px]:min-h-11 ${turler.has(t) ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]' : 'border-[var(--rule-2)] text-[var(--ink-2)]'}`}>{KAYIT_TUR_AD[t]}</button>
        ))}
      </div>
      {sorgu.isLoading ? (
        <div role="status" aria-label="Kayıtlar yükleniyor" className="mt-2 h-16 animate-pulse bg-[var(--paper-3)]" />
      ) : liste.length === 0 ? (
        <p className="mt-2 text-[13px] text-[var(--ink-3)]" data-testid="kayit-bos">{(sorgu.data ?? []).length === 0 ? 'Henüz saha kaydı yok. Gözlem, ilaçlama, gübreleme, sulama, hasat ve tuzak kayıtlarınız burada, haritada konumuyla görünür.' : 'Bu süzgeçle eşleşen kayıt yok.'}</p>
      ) : (
        <ul className="mt-1">
          {liste.map((k) => (
            <li key={k.id} className={`border-b border-[var(--rule)] py-2 ${secili === k.id ? 'bg-[var(--paper-2)]' : ''}`} data-testid="kayit-satiri" data-tur={k.tur} data-id={k.id}>
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span aria-hidden>{KAYIT_TUR_ISARET[k.tur]}</span>
                <b className="text-[13px]">{KAYIT_TUR_AD[k.tur]}</b>
                <span className="mono text-caption text-[var(--ink-3)]">{gunAy(k.tarih, 'always')}</span>
                <span className="text-caption text-[var(--ink-3)]">{k.konum_tur === 'nokta' ? 'noktada' : k.konum_tur === 'alan' ? 'alan' : 'konumsuz'}</span>
              </div>
              {k.aciklama && <p className="mt-0.5 text-[13px]">{k.aciklama}</p>}
              <FotoSerit fotolar={k.fotograflar} />
              <div className="mt-1 flex gap-1">
                {k.konum && <button type="button" onClick={() => sec(k.id)} data-testid="kayit-haritada" className="min-h-9 px-2 text-[12px] font-semibold underline underline-offset-2 max-[560px]:min-h-11">Haritada göster</button>}
                <button type="button" onClick={() => window.confirm('Bu kayıt silinsin mi?') && sil.mutate(k.id)} data-testid="kayit-sil" className="min-h-9 px-2 text-[12px] font-semibold text-[var(--st-dikkat)] underline underline-offset-2 max-[560px]:min-h-11">Sil</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
