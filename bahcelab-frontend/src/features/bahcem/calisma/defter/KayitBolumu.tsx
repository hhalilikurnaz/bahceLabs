import { useEffect, useState } from 'react'
import type { FotoOnerisi, KayitGirdisi } from '../../api/sahaApi'
import { KAYIT_TURLERI, KAYIT_TUR_AD, KAYIT_TUR_ISARET, fotoOner, useGunlukSozlugu, useKayitOlustur, useKayitSil, useSahaKayitlari, type KayitTuru } from '../../api/sahaApi'
import { useSulamaSektorleri } from '../../api/sulamaPanelApi'
import { gunAy } from '../../lib/format'
import { fotoKucult } from '../../lib/foto'
import { bugunIstanbul, turSuz } from '../../lib/saha'
import { taslakOku, taslakSil, taslakYaz } from '../../lib/taslak'
import { FotoSerit } from './FotoSerit'
import type { KonumSecimi } from './useKonumSecimi'

/** Dokunma hedefi ≥ 44 px (tüm genişliklerde): çip, segment ve düğmeler `min-h-11`. */
const CIP = 'min-h-11 border px-3 text-[12px] font-semibold'
const cip = (aktif: boolean) => `${CIP} ${aktif ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]' : 'border-[var(--rule-2)] hover:border-[var(--ink)]'}`
const GIRDI = 'mt-0.5 min-h-11 border border-[var(--rule-2)] bg-transparent px-2 text-[14px]'
const MAX_FOTO = 5

/**
 * Yeni saha kaydı (çekmecede açılır): tür; gözlemde kategori → etiket + şiddet + yaygınlık + isteğe bağlı vana; tarih; konum («Konumumu kullan» / haritadan nokta / alan);
 * not; kamera ya da galeriden en çok 5 fotoğraf (istemcide küçültülür). Alanlar cihazda taslak olarak saklanır; başarılı kayıtta temizlenir.
 */
export function KayitFormu({ gardenId, konum, kaydedildi }: { gardenId: string; konum: KonumSecimi; kaydedildi?: () => void }) {
  const olustur = useKayitOlustur(gardenId)
  const sozluk = useGunlukSozlugu().data
  const sektorler = useSulamaSektorleri(gardenId).data?.sektorler.filter((s) => s.id) ?? []
  const [t0] = useState(() => taslakOku(window.localStorage, gardenId)) // yarım kalan kayıt cihazdan geri gelir
  const [tur, setTur] = useState<KayitTuru>((t0?.tur as KayitTuru | undefined) ?? 'gozlem')
  const [tarih, setTarih] = useState(bugunIstanbul())
  const [not, setNot] = useState(t0?.not ?? '')
  const [kategori, setKategori] = useState(t0?.kategori ?? '')
  const [etiket, setEtiket] = useState(t0?.etiket ?? '')
  const [siddet, setSiddet] = useState(t0?.siddet ?? '')
  const [yayginlik, setYayginlik] = useState(t0?.yayginlik ?? '')
  const [sektor, setSektor] = useState(t0?.sektor ?? '')
  const [sure, setSure] = useState(t0?.sure ?? '')
  const [m3, setM3] = useState(t0?.m3 ?? '')
  const [mm, setMm] = useState(t0?.mm ?? '')
  const [fotolar, setFotolar] = useState<File[]>([])
  const [fotoIsleniyor, setFotoIsleniyor] = useState(false)
  const [oneri, setOneri] = useState<FotoOnerisi | null>(null)

  useEffect(() => {
    taslakYaz(window.localStorage, gardenId, { tur, kategori, etiket, siddet, yayginlik, sektor, not, sure, m3, mm, konumMod: konum.mod === 'alan' ? 'yok' : konum.mod, nokta: konum.nokta, dogruluk: konum.dogruluk })
  }, [gardenId, tur, kategori, etiket, siddet, yayginlik, sektor, not, sure, m3, mm, konum.mod, konum.nokta, konum.dogruluk])

  const kat = sozluk?.kategoriler.find((k) => k.kod === kategori)
  const eksikAlan = konum.mod === 'alan' && !konum.konum
  const eksikNokta = konum.mod === 'nokta' && !konum.konum
  const gozlemEksik = tur === 'gozlem' && (!kat || !etiket || (kat.siddet_zorunlu && (!siddet || !yayginlik)))
  const sayiAl = (t: string): number | undefined => {
    const n = Number(t.trim().replace(',', '.'))
    return t.trim() !== '' && Number.isFinite(n) && n > 0 ? n : undefined
  }
  const yagisMm = tur === 'yagis' ? sayiAl(mm) ?? (mm.trim() === '0' ? 0 : undefined) : undefined
  const yagisGecersiz = tur === 'yagis' && (yagisMm === undefined || yagisMm > 500)
  const ayrinti = tur === 'yagis' ? { mm: yagisMm } : tur === 'sulama' && (sayiAl(sure) !== undefined || sayiAl(m3) !== undefined) ? { sure_dk: sayiAl(sure), m3: sayiAl(m3) } : undefined
  const sifirla = () => {
    setNot(''); setSure(''); setM3(''); setMm(''); setFotolar([]); setOneri(null); setEtiket(''); setSiddet(''); setYayginlik(''); setSektor('')
    konum.temizle()
    taslakSil(window.localStorage, gardenId)
  }
  const kaydet = () => {
    const girdi: KayitGirdisi = {
      tur, tarih, konum: konum.konum, aciklama: not.trim() || null, ayrinti,
      gozlem: tur === 'gozlem' ? { kategori, etiket, siddet: siddet || null, yayginlik: yayginlik || null, sector_id: sektor || null, konum_dogruluk_m: konum.mod === 'nokta' ? konum.dogruluk : null } : undefined,
    }
    olustur.mutate({ girdi, fotolar }, { onSuccess: () => {
      sifirla()
      kaydedildi?.()
    } })
  }
  const fotoSec = async (dosyalar: File[]) => {
    const secilen = dosyalar.slice(0, MAX_FOTO - fotolar.length)
    if (secilen.length === 0) return
    setFotoIsleniyor(true)
    try {
      const kucuk = await Promise.all(secilen.map((d) => (sozluk ? fotoKucult(d, sozluk.foto_uzun_kenar_px, sozluk.foto_hedef_bayt) : d))) // EXIF konumu da silinir
      setFotolar((f) => [...f, ...kucuk].slice(0, MAX_FOTO))
      // Fotoğrafın EXIF tarih/konumu ÖNERİ olarak sorulur (sunucu okur; kayda ancak onayınızla yazılır) — ORİJİNAL dosyadan (küçültme EXIF'i siler)
      void fotoOner(gardenId, secilen[0]).then(setOneri).catch(() => setOneri(null))
    } finally {
      setFotoIsleniyor(false)
    }
  }
  return (
    <form onSubmit={(e) => (e.preventDefault(), kaydet())} className="grid gap-3" aria-label="Yeni saha kaydı" data-testid="kayit-formu">
      <div role="group" aria-label="Kayıt türü" className="flex flex-wrap gap-1.5">
        {KAYIT_TURLERI.map((t) => (
          <button key={t} type="button" aria-pressed={tur === t} onClick={() => setTur(t)} data-testid={`kayit-tur-${t}`} className={cip(tur === t)}>
            <span aria-hidden>{KAYIT_TUR_ISARET[t]}</span> {KAYIT_TUR_AD[t]}
          </button>
        ))}
      </div>
      {tur === 'gozlem' && (
        <div className="grid gap-2" data-testid="gozlem-alanlari">
          {!sozluk ? (
            <p role="status" className="text-small text-[var(--ink-3)]">Etiket listesi yükleniyor…</p>
          ) : (
            <>
              <div role="group" aria-label="Gözlem kategorisi" className="flex flex-wrap gap-1.5">
                {sozluk.kategoriler.map((k) => (
                  <button key={k.kod} type="button" aria-pressed={kategori === k.kod} onClick={() => {
                    setKategori(k.kod)
                    setEtiket(k.etiketler.length === 1 ? k.etiketler[0].kod : '')
                  }} data-testid={`gozlem-kategori-${k.kod}`} className={cip(kategori === k.kod)}>{k.ad}</button>
                ))}
              </div>
              {kat && (
                <label className="grid text-caption font-semibold text-[var(--ink-3)]">
                  Etiket
                  <select value={etiket} onChange={(e) => setEtiket(e.target.value)} data-testid="gozlem-etiket" className={GIRDI}>
                    <option value="">Seçin…</option>
                    {kat.etiketler.map((e) => <option key={e.kod} value={e.kod}>{e.ad}</option>)}
                  </select>
                </label>
              )}
              {kat && (
                <>
                  <div role="group" aria-label="Şiddet" className="flex flex-wrap items-center gap-1.5">
                    <span className="text-caption font-semibold text-[var(--ink-3)]">Şiddet{kat.siddet_zorunlu ? '' : ' (isteğe bağlı)'}</span>
                    {sozluk.siddet.map((x) => <button key={x.kod} type="button" aria-pressed={siddet === x.kod} onClick={() => setSiddet(siddet === x.kod ? '' : x.kod)} data-testid={`gozlem-siddet-${x.kod}`} className={cip(siddet === x.kod)}>{x.ad}</button>)}
                  </div>
                  <div role="group" aria-label="Yaygınlık" className="flex flex-wrap items-center gap-1.5">
                    <span className="text-caption font-semibold text-[var(--ink-3)]">Yaygınlık{kat.siddet_zorunlu ? '' : ' (isteğe bağlı)'}</span>
                    {sozluk.yayginlik.map((x) => <button key={x.kod} type="button" aria-pressed={yayginlik === x.kod} onClick={() => setYayginlik(yayginlik === x.kod ? '' : x.kod)} data-testid={`gozlem-yayginlik-${x.kod}`} className={cip(yayginlik === x.kod)}>{x.ad}</button>)}
                  </div>
                </>
              )}
              {sektorler.length > 0 && (
                <label className="grid text-caption font-semibold text-[var(--ink-3)]">
                  Vana (isteğe bağlı)
                  <select value={sektor} onChange={(e) => setSektor(e.target.value)} data-testid="gozlem-vana" className={GIRDI}>
                    <option value="">Belirtme</option>
                    {sektorler.map((s) => <option key={s.id!} value={s.id!}>{s.ad}</option>)}
                  </select>
                </label>
              )}
              {gozlemEksik && <p className="text-caption text-[var(--ink-3)]" data-testid="gozlem-eksik">{!kat ? 'Önce bir kategori seçin.' : !etiket ? 'Bir etiket seçin.' : 'Şiddet ve yaygınlık seçin.'}</p>}
            </>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid text-caption font-semibold text-[var(--ink-3)]">
          Tarih
          <input type="date" value={tarih} max={bugunIstanbul()} onChange={(e) => setTarih(e.target.value)} data-testid="kayit-tarih" className={GIRDI} />
        </label>
      </div>
      <div role="group" aria-label="Konum" className="flex flex-wrap gap-1.5">
        <button type="button" aria-pressed={konum.mod === 'yok'} onClick={() => konum.temizle()} data-testid="konum-yok" className={cip(konum.mod === 'yok')}>Konumsuz</button>
        <button type="button" disabled={konum.gpsDurum === 'araniyor'} onClick={() => konum.gpsKullan()} data-testid="konum-gps" className={cip(konum.mod === 'nokta' && konum.dogruluk !== null)}>{konum.gpsDurum === 'araniyor' ? 'Konum aranıyor…' : 'Konumumu kullan'}</button>
        <button type="button" aria-pressed={konum.mod === 'nokta' && konum.dogruluk === null} onClick={() => konum.setMod('nokta')} data-testid="konum-nokta" className={cip(konum.mod === 'nokta' && konum.dogruluk === null)}>Haritada nokta</button>
        <button type="button" aria-pressed={konum.mod === 'alan'} onClick={() => konum.setMod('alan')} data-testid="konum-alan" className={cip(konum.mod === 'alan')}>Haritada alan</button>
      </div>
      {konum.gpsHata && <p role="status" className="text-small text-[var(--ink-2)]" data-testid="konum-gps-hata">{konum.gpsHata}</p>}
      {konum.mod === 'nokta' && (
        <p className="text-small text-[var(--ink-2)]" data-testid="konum-ipucu">
          {konum.nokta ? (konum.dogruluk !== null ? `Konumunuz alındı (yaklaşık ±${String(konum.dogruluk).replace('.', ',')} m).` : 'Nokta seçildi; yerini değiştirmek için haritaya yeniden dokunun.') : 'Haritaya dokunarak noktayı işaretleyin.'}
        </p>
      )}
      {konum.mod === 'alan' && (
        <p className="text-small text-[var(--ink-2)]" data-testid="konum-ipucu">
          {konum.koseler.length < 3 ? `Alanın köşelerine dokunun (en az 3; şu an ${konum.koseler.length}).` : `${konum.koseler.length} köşe seçildi.`}{' '}
          {konum.koseler.length > 0 && <button type="button" onClick={konum.geriAl} className="inline-flex min-h-11 items-center font-semibold underline underline-offset-2">Son köşeyi geri al</button>}
        </p>
      )}
      {tur === 'yagis' && (
        <div className="flex flex-wrap items-end gap-3" data-testid="yagis-olcumu">
          <label className="grid text-caption font-semibold text-[var(--ink-3)]">Yağış (mm)<input inputMode="decimal" value={mm} onChange={(e) => setMm(e.target.value)} data-testid="yagis-mm" aria-invalid={yagisGecersiz && mm.trim() !== ''} className={`${GIRDI} w-28`} /></label>
          <p className="basis-full text-caption text-[var(--ink-3)]">O gün için sulama planı bu değeri hava serisinden ÖNCE kullanır («bahçede ölçüldü»). Seri ile farkı ay ay biriktirilir; düzeltme ön değer · mühendis onayı bekliyor.</p>
        </div>
      )}
      {tur === 'sulama' && (
        <div className="flex flex-wrap items-end gap-3" data-testid="sulama-miktar">
          <label className="grid text-caption font-semibold text-[var(--ink-3)]">Süre (dakika)<input inputMode="decimal" value={sure} onChange={(e) => setSure(e.target.value)} data-testid="sulama-sure" className={`${GIRDI} w-28`} /></label>
          <label className="grid text-caption font-semibold text-[var(--ink-3)]">ya da miktar (m³)<input inputMode="decimal" value={m3} onChange={(e) => setM3(e.target.value)} data-testid="sulama-m3" className={`${GIRDI} w-28`} /></label>
          <p className="basis-full text-caption text-[var(--ink-3)]">Süre ya da miktar girilirse sulama planının toprak kovasına eklenir; girilmezse yalnız not olarak kalır.</p>
        </div>
      )}
      <label className="grid text-caption font-semibold text-[var(--ink-3)]">
        Not
        <textarea value={not} onChange={(e) => setNot(e.target.value)} maxLength={1000} rows={2} data-testid="kayit-notu" placeholder="Ne gördünüz ya da yaptınız?" className="mt-0.5 min-h-11 w-full border border-[var(--rule-2)] bg-transparent px-2 py-1.5 text-[14px]" />
      </label>
      {oneri && (oneri.tarih || oneri.konum || oneri.konum_bahceden_uzak) && (
        <div role="status" className="border border-[var(--rule-2)] bg-[var(--paper-2)] p-2 text-small" data-testid="foto-onerisi">
          <p>{oneri.aciklama}</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {oneri.tarih && <button type="button" onClick={() => oneri.tarih && setTarih(oneri.tarih)} data-testid="oneri-tarih" className="btn quiet">Tarihi kullan ({oneri.tarih})</button>}
            {oneri.konum && <button type="button" onClick={() => {
              konum.setMod('nokta')
              konum.setNokta(oneri.konum!.coordinates as [number, number])
            }} data-testid="oneri-konum" className="btn quiet">Konumu kullan</button>}
            <button type="button" onClick={() => setOneri(null)} className="btn quiet">Kullanma</button>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <label className={`${CIP} inline-flex cursor-pointer items-center border-[var(--rule-2)] hover:border-[var(--ink)]`}>
          Kamera
          <input type="file" accept="image/*" capture="environment" className="sr-only" data-testid="kayit-kamera" onChange={(e) => { void fotoSec(Array.from(e.target.files ?? [])); e.target.value = '' }} />
        </label>
        <label className={`${CIP} inline-flex cursor-pointer items-center border-[var(--rule-2)] hover:border-[var(--ink)]`}>
          Galeri
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" data-testid="kayit-foto" onChange={(e) => { void fotoSec(Array.from(e.target.files ?? [])); e.target.value = '' }} />
        </label>
        <span className="text-small text-[var(--ink-2)]" data-testid="foto-sayisi" role="status">{fotoIsleniyor ? 'Fotoğraf küçültülüyor…' : fotolar.length ? `${fotolar.length} fotoğraf hazır` : ''}</span>
        {fotolar.length > 0 && <button type="button" onClick={() => {
            setFotolar([])
            setOneri(null)
          }} className="btn quiet" data-testid="foto-temizle">Fotoğrafları kaldır</button>}
      </div>
      <div className="flex items-center gap-2">
        <button type="submit" disabled={olustur.isPending || fotoIsleniyor || eksikAlan || eksikNokta || yagisGecersiz || gozlemEksik} data-testid="kayit-kaydet" className="btn primary">{olustur.isPending ? 'Kaydediliyor…' : 'Kaydı ekle'}</button>
      </div>
      {olustur.isError && <p role="alert" className="text-small text-[var(--st-dikkat)]">Kaydedilemedi: {(olustur.error as Error).message}</p>}
    </form>
  )
}

/** Gözlem etiket özeti: «Zararlı · Kırmızı örümcek · orta · birkaç ağaç». */
function GozlemSatiri({ k }: { k: NonNullable<ReturnType<typeof useSahaKayitlari>['data']>[number] }) {
  const g = k.gozlem
  if (!g) return null
  return (
    <p className="mt-0.5 text-[13px]" data-testid="kayit-etiket" data-kategori={g.kategori} data-etiket={g.etiket} data-kaynak={g.kaynak}>
      <b>{g.kategori_ad}</b> · {g.etiket_ad}{g.siddet_ad ? ` · ${g.siddet_ad.toLowerCase()}` : ''}{g.yayginlik_ad ? ` · ${g.yayginlik_ad.toLowerCase()}` : ''}
      {g.konum_dogruluk_m !== null && <span className="text-[var(--ink-3)]"> · konum ±{String(g.konum_dogruluk_m).replace('.', ',')} m</span>}
      {g.kaynak === 'sistem' && <span className="ml-1 text-caption text-[var(--ink-3)]">(sistem yanıtından)</span>}
    </p>
  )
}

/** Kayıt listesi (yeniden eskiye): tür ve kategori süzgeci, haritada göster ve silme. */
export function KayitListesi({ gardenId, secili, sec, kategoriSuzgeci = true }: { gardenId: string; secili: string | null; sec: (id: string) => void; kategoriSuzgeci?: boolean }) {
  const sozluk = useGunlukSozlugu().data
  const [kategori, setKategori] = useState<string | null>(null)
  const sorgu = useSahaKayitlari(gardenId, { kategori })
  const sil = useKayitSil(gardenId)
  const [turler, setTurler] = useState<Set<KayitTuru>>(new Set())
  const liste = turSuz(sorgu.data ?? [], turler)
  const degistir = (t: KayitTuru) => setTurler(new Set(turler.has(t) ? [...turler].filter((x) => x !== t) : [...turler, t]))
  return (
    <section aria-label="Saha kayıtları" data-testid="kayit-listesi">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Kayıt türü süzgeci">
        {KAYIT_TURLERI.map((t) => (
          <button key={t} type="button" aria-pressed={turler.has(t)} onClick={() => degistir(t)} data-testid={`kayit-suz-${t}`} className={cip(turler.has(t))}>{KAYIT_TUR_AD[t]}</button>
        ))}
      </div>
      {kategoriSuzgeci && sozluk && (
        <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label="Gözlem kategorisi süzgeci">
          {sozluk.kategoriler.map((k) => (
            <button key={k.kod} type="button" aria-pressed={kategori === k.kod} onClick={() => setKategori(kategori === k.kod ? null : k.kod)} data-testid={`kayit-kategori-${k.kod}`} className={cip(kategori === k.kod)}>{k.ad}</button>
          ))}
        </div>
      )}
      {sorgu.isLoading ? (
        <div role="status" aria-label="Kayıtlar yükleniyor" className="mt-2 h-16 animate-pulse bg-[var(--paper-3)]" />
      ) : liste.length === 0 ? (
        <p className="mt-2 text-[13px] text-[var(--ink-3)]" data-testid="kayit-bos">{(sorgu.data ?? []).length === 0 && !kategori ? 'Henüz saha kaydı yok. Gözlem, ilaçlama, gübreleme, sulama, hasat ve tuzak kayıtları burada, konumuyla ve fotoğrafıyla tutulur.' : 'Bu süzgeçle eşleşen kayıt yok.'}</p>
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
              <GozlemSatiri k={k} />
              {k.aciklama && <p className="mt-0.5 text-[13px]">{k.aciklama}</p>}
              <FotoSerit fotolar={k.fotograflar} />
              <div className="mt-1 flex gap-1">
                {k.konum && <button type="button" onClick={() => sec(k.id)} data-testid="kayit-haritada" className="inline-flex min-h-11 items-center px-2 text-[12px] font-semibold underline underline-offset-2">Haritada göster</button>}
                <button type="button" onClick={() => window.confirm('Bu kayıt silinsin mi?') && sil.mutate(k.id)} data-testid="kayit-sil" className="inline-flex min-h-11 items-center px-2 text-[12px] font-semibold text-[var(--st-dikkat)] underline underline-offset-2">Sil</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
