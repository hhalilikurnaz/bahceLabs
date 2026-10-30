import { useState } from 'react'
import { useKayitOlustur, useSahaTuru, useZiyaret, type TurNoktasi } from '../../api/sahaApi'
import { bugunIstanbul, mesafe } from '../../lib/saha'

const TUR_AD: Record<TurNoktasi['tur'], string> = { zayif_kesim: 'Zayıf kesim', stres_yamasi: 'Stres yaması', bekliyor: 'Doğrulama bekliyor' }

function Nokta({ gardenId, nokta, acik, ac, kayitSec }: { gardenId: string; nokta: TurNoktasi; acik: boolean; ac: () => void; kayitSec: (id: string) => void }) {
  const ziyaret = useZiyaret(gardenId)
  const olustur = useKayitOlustur(gardenId)
  const [not, setNot] = useState('')
  const [foto, setFoto] = useState<File | null>(null)
  const bekle = ziyaret.isPending || olustur.isPending
  const notluKaydet = () =>
    olustur.mutate(
      { girdi: { tur: 'gozlem', tarih: bugunIstanbul(), konum: { type: 'Point', coordinates: [nokta.lng, nokta.lat] }, aciklama: not.trim() || null }, fotolar: foto ? [foto] : [] },
      { onSuccess: (kayit) => ziyaret.mutate({ nokta_anahtar: nokta.anahtar, kayit_id: kayit.id, ziyaret_edildi: true }, { onSuccess: () => (setNot(''), setFoto(null)) }) },
    )
  return (
    <li className={`border-b border-[var(--rule)] ${nokta.ziyaret_edildi ? 'opacity-70' : ''}`} data-testid="tur-noktasi" data-anahtar={nokta.anahtar} data-ziyaret={String(nokta.ziyaret_edildi)} data-tur={nokta.tur}>
      <button type="button" onClick={ac} aria-expanded={acik} className="flex min-h-11 w-full items-start gap-2.5 py-2 text-left">
        <span aria-hidden className="mono grid h-6 w-6 shrink-0 place-items-center rounded-full border border-[var(--ink)] text-[12px] font-bold" style={{ background: nokta.ziyaret_edildi ? 'var(--paper-3)' : 'var(--lemon)' }}>{nokta.ziyaret_edildi ? '✓' : nokta.sira}</span>
        <span className="min-w-0 flex-1">
          <b className="block text-small">{TUR_AD[nokta.tur]}</b>
          <span className="block text-small text-[var(--ink-2)]">{nokta.neden}</span>
        </span>
        <span className="mono shrink-0 text-caption text-[var(--ink-3)]">{nokta.ziyaret_edildi ? 'tamam' : `+${mesafe(nokta.mesafe_m)}`}</span>
      </button>
      {acik && (
        <div className="grid gap-1.5 pb-3 pl-[34px]" data-testid="tur-noktasi-ayrinti">
          {nokta.ziyaret_edildi ? (
            <div className="flex flex-wrap items-center gap-2 text-small">
              <span>Ziyaret edildi.</span>
              {nokta.kayit_id && <button type="button" onClick={() => kayitSec(nokta.kayit_id!)} data-testid="tur-kayda-git" className="font-semibold underline underline-offset-2">Kaydı gör</button>}
              <button type="button" disabled={bekle} onClick={() => ziyaret.mutate({ nokta_anahtar: nokta.anahtar, ziyaret_edildi: false })} data-testid="tur-geri-al" className="font-semibold underline underline-offset-2">Geri al</button>
            </div>
          ) : (
            <>
              <label className="text-caption font-semibold text-[var(--ink-3)]" htmlFor={`tn-${nokta.anahtar}`}>Not</label>
              <textarea id={`tn-${nokta.anahtar}`} value={not} onChange={(e) => setNot(e.target.value)} maxLength={1000} rows={2} placeholder="Ne gördünüz? Kısa not…" className="w-full border border-[var(--rule-2)] bg-transparent p-2 text-[13px]" data-testid="tur-notu" />
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex min-h-9 cursor-pointer items-center border border-[var(--rule-2)] px-2.5 text-[12px] font-semibold hover:border-[var(--ink)] max-[560px]:min-h-11">
                  {foto ? 'Fotoğraf seçildi' : 'Fotoğraf'}
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" data-testid="tur-foto" onChange={(e) => setFoto(e.target.files?.[0] ?? null)} />
                </label>
                <button type="button" disabled={bekle} onClick={notluKaydet} data-testid="tur-kaydet" className="btn primary max-[560px]:!h-11">Kaydet · ziyaret edildi</button>
                <button type="button" disabled={bekle} onClick={() => ziyaret.mutate({ nokta_anahtar: nokta.anahtar, ziyaret_edildi: true })} data-testid="tur-ziyaret" className="btn quiet max-[560px]:!h-11">Yalnız ziyaret edildi</button>
              </div>
              {(ziyaret.isError || olustur.isError) && <p role="alert" className="text-small text-[var(--st-dikkat)]">Kaydedilemedi, tekrar deneyin.</p>}
            </>
          )}
        </div>
      )}
    </li>
  )
}

/**
 * Bugünkü saha turu: açık uyarılardan (zayıf kesim, stres yaması, doğrulama bekleyen olay) otomatik nokta listesi, en yakın komşu sırası, harita rotası.
 * Noktada not + fotoğraf kaydı bırakılır ve «ziyaret edildi» işaretlenir; kayıt noktadan açılır.
 */
export function TurBolumu({ gardenId, kayitSec, noktaSec, seciliNokta, baslangic, setBaslangic }: {
  gardenId: string
  kayitSec: (id: string) => void
  noktaSec: (anahtar: string | null) => void
  seciliNokta: string | null
  baslangic: { lng: number; lat: number } | null
  setBaslangic: (b: { lng: number; lat: number } | null) => void
}) {
  const sorgu = useSahaTuru(gardenId, baslangic)
  const tur = sorgu.data
  const [konumHata, setKonumHata] = useState<string | null>(null)
  const konumum = () => {
    setKonumHata(null)
    if (!navigator.geolocation) return setKonumHata('Tarayıcı konum vermiyor.')
    navigator.geolocation.getCurrentPosition((p) => setBaslangic({ lng: p.coords.longitude, lat: p.coords.latitude }), () => setKonumHata('Konum izni verilmedi; sıra bahçe merkezinden kuruldu.'), { timeout: 8000 })
  }
  const bekleyen = tur ? tur.noktalar.length - tur.ziyaret_edilen : 0
  return (
    <section aria-label="Saha turu" data-testid="tur-bolumu">
      <span className="eyebrow">BUGÜNKÜ SAHA TURU</span>
      {sorgu.isLoading ? (
        <div role="status" aria-label="Tur yükleniyor" className="mt-2 h-20 animate-pulse bg-[var(--paper-3)]" />
      ) : !tur || tur.noktalar.length === 0 ? (
        <>
          <h2 className="serif mt-1 text-[22px] leading-tight" data-testid="tur-baslik">Bugün için tur noktası yok.</h2>
          <p className="mt-1 text-[13px] text-[var(--ink-2)]" data-testid="tur-bos">Açık bir zayıf kesim, stres yaması ya da doğrulama bekleyen düşüş görünmüyor. Bunlardan biri çıkınca noktalar burada kendiliğinden listelenir.</p>
        </>
      ) : (
        <>
          <h2 className="serif mt-1 text-[22px] leading-tight" data-testid="tur-baslik">{bekleyen} nokta · {mesafe(tur.toplam_m)} · yaklaşık {tur.sure_dk} dakika</h2>
          <p className="mt-1 text-small text-[var(--ink-2)]">{tur.not_}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2" aria-live="polite">
            <button type="button" onClick={konumum} data-testid="tur-konumum" className="btn quiet max-[560px]:!h-11">Konumumdan sırala</button>
            {baslangic && <button type="button" onClick={() => setBaslangic(null)} className="btn quiet max-[560px]:!h-11">Bahçe merkezinden</button>}
            <button type="button" onClick={() => window.print()} className="btn quiet max-[560px]:!h-11">Yazdır</button>
            <span className="mono text-caption text-[var(--ink-3)]" data-testid="tur-ilerleme">{tur.ziyaret_edilen}/{tur.noktalar.length} tamam</span>
          </div>
          {konumHata && <p role="status" className="mt-1 text-[12px] text-[var(--ink-3)]">{konumHata}</p>}
          <ol className="mt-2" data-testid="tur-listesi">
            {tur.noktalar.map((n) => (
              <Nokta key={n.anahtar} gardenId={gardenId} nokta={n} acik={seciliNokta === n.anahtar} ac={() => noktaSec(seciliNokta === n.anahtar ? null : n.anahtar)} kayitSec={kayitSec} />
            ))}
          </ol>
          <p className="mt-1 text-caption text-[var(--ink-3)]">{tur.esik_durumu}</p>
        </>
      )}
    </section>
  )
}
