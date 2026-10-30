import { useEffect, useState } from 'react'
import { Button, Segmented, TextField } from '@/components/ui'
import { describeError } from '../../api/gardensApi'
import { useSulamaProfili, useSulamaProfiliKaydet, type Enerji, type ProfilYaniti, type SulamaSistemi } from '../../api/sulamaApi'
import type { Garden } from '../../api/types'
import { ENERJI_AD, SISTEM_AD, sihirbazBaslangici, sihirbazDogrula, sihirbazGovdesi, type SihirbazGirdisi } from '../../lib/sulamaForm'
import { useToast } from '../../components/layout/toastContext'

const ADIMLAR = ['Sistem', 'Dikim', 'Pompa ve enerji', 'Maliyet'] as const

/**
 * Bahçe sulama profili (kurulum sihirbazı). YALNIZ «Sulama planı» sayfasından ve «Bahçe ayarları»ndan açılır.
 * Ağaç sayısı burada sorulmaz: bahçenin mevcut beyanından gelir (konum uydurulmaz). Bilinmeyen alan boş bırakılır; boş alan için sayı üretilmez.
 */
export function SulamaSihirbazi({ garden, onClose }: { garden: Garden; onClose: () => void }) {
  const profil = useSulamaProfili(garden.id)
  return profil.data ? <Sihirbaz garden={garden} yaniti={profil.data} onClose={onClose} /> : <Cerceve onClose={onClose}><p className="px-5 py-6 text-small text-app-text-muted" role="status">{profil.isError ? 'Sulama bilgileri alınamadı.' : 'Yükleniyor…'}</p></Cerceve>
}

function Cerceve({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 max-[560px]:items-end max-[560px]:p-0" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Sulama bilgileri" data-testid="sulama-sihirbazi"
        className="flex max-h-[92dvh] w-full max-w-[520px] flex-col rounded-md border border-app-border bg-app-card max-[560px]:max-w-none max-[560px]:rounded-b-none">
        {children}
      </div>
    </div>
  )
}

function Sihirbaz({ garden, yaniti, onClose }: { garden: Garden; yaniti: ProfilYaniti; onClose: () => void }) {
  const kaydet = useSulamaProfiliKaydet(garden.id)
  const toast = useToast()
  const [adim, setAdim] = useState(0)
  const [g, setG] = useState<SihirbazGirdisi>(() => sihirbazBaslangici(yaniti.profil))
  const [hata, setHata] = useState<string | null>(null)
  const hatalar = sihirbazDogrula(g)
  const set = <K extends keyof SihirbazGirdisi>(k: K, v: SihirbazGirdisi[K]) => setG((o) => ({ ...o, [k]: v }))
  const damla = g.sistem === 'damla'

  function bitir() {
    if (Object.keys(hatalar).length > 0) return
    setHata(null)
    kaydet.mutate(sihirbazGovdesi(g), {
      onSuccess: () => {
        toast.show('Sulama profili kaydedildi.')
        onClose()
      },
      onError: (e) => setHata(describeError(e)),
    })
  }

  return (
    <Cerceve onClose={onClose}>
    <header className="border-b border-app-border px-5 py-4">
      <h2 className="text-h2 font-semibold">Sulama bilgileri · {garden.ad}</h2>
      <ol className="mt-2 flex gap-1 text-caption" aria-label="Adımlar">
        {ADIMLAR.map((a, i) => (
          <li key={a} aria-current={i === adim ? 'step' : undefined} className={`flex-1 border-b-2 pb-1 ${i === adim ? 'border-app-primary font-semibold text-app-text' : i < adim ? 'border-app-text-dim text-app-text-muted' : 'border-app-border text-app-text-dim'}`}>{i + 1}. {a}</li>
        ))}
      </ol>
    </header>
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
      {(
        <>
          {adim === 0 && (
            <fieldset className="space-y-3">
              <legend className="mb-1 text-small font-semibold">Hangi sistemle sulıyorsunuz?</legend>
              <Segmented<SulamaSistemi> label="Sulama sistemi" value={g.sistem} onChange={(v) => set('sistem', v)} className="w-full" options={(Object.keys(SISTEM_AD) as SulamaSistemi[]).map((v) => ({ value: v, label: SISTEM_AD[v] }))} />
              <p className="text-small text-app-text-muted">Sistem verimi (damla %90 · mini yağmurlama %80 · salma %55) katalogda ön değerdir; brüt su = net ihtiyaç ÷ verim.</p>
            </fieldset>
          )}
          {adim === 1 && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Sıra aralığı (m)" inputMode="decimal" value={g.siraAralik} onChange={(e) => set('siraAralik', e.target.value)} error={hatalar.siraAralik} />
                <TextField label="Ağaç aralığı (m)" inputMode="decimal" value={g.agacAralik} onChange={(e) => set('agacAralik', e.target.value)} error={hatalar.agacAralik} />
              </div>
              {damla && (
                <div className="grid grid-cols-2 gap-3">
                  <TextField label="Ağaç başına damlatıcı" inputMode="numeric" value={g.damlaticiSayisi} onChange={(e) => set('damlaticiSayisi', e.target.value)} error={hatalar.damlaticiSayisi} />
                  <TextField label="Damlatıcı debisi (L/sa)" inputMode="decimal" value={g.damlaticiDebi} onChange={(e) => set('damlaticiDebi', e.target.value)} error={hatalar.damlaticiDebi} />
                </div>
              )}
              <p className="rounded-md border border-app-border bg-app-canvas px-3 py-2 text-small" data-testid="sihirbaz-agac">
                {yaniti.agac_sayisi ? <>Ağaç sayısı bahçe bilgilerinden: <b>{yaniti.agac_sayisi}</b>. Ağaç başına litre bu sayıya göre hesaplanır.</> : <>Ağaç sayısı beyan edilmemiş; ağaç başına litre ve damlatıcı süresi gösterilmez. «Bahçe bilgileri»nden ekleyebilirsiniz.</>}
              </p>
              {yaniti.agac_kontrol.mesaj && <p className="text-small text-app-warn" role="status">{yaniti.agac_kontrol.mesaj}</p>}
              {damla && !(g.damlaticiSayisi && g.damlaticiDebi) && <p className="text-small text-app-text-muted">Damlatıcı sayısı ve debisini bilmiyorsanız boş bırakın; plan mm ve m³ olarak gelir, süre gösterilmez.</p>}
            </div>
          )}
          {adim === 2 && (
            <div className="space-y-3">
              <label className="flex min-h-11 items-center gap-2 text-body"><input type="checkbox" className="h-5 w-5" checked={g.pompaBilinmiyor} onChange={(e) => set('pompaBilinmiyor', e.target.checked)} data-testid="pompa-bilmiyorum" /> Pompa bilgisini bilmiyorum</label>
              {!g.pompaBilinmiyor ? (
                <div className="grid grid-cols-2 gap-3">
                  <TextField label="Pompa gücü (kW)" inputMode="decimal" value={g.pompaKw} onChange={(e) => set('pompaKw', e.target.value)} error={hatalar.pompaKw} />
                  <TextField label="Pompa debisi (m³/sa)" inputMode="decimal" value={g.pompaDebi} onChange={(e) => set('pompaDebi', e.target.value)} error={hatalar.pompaDebi} />
                </div>
              ) : <p className="text-small text-app-text-muted">Pompa bilinmeden kWh ve TL hesaplanmaz; yalnız su (m³) gösterilir.</p>}
              <Segmented<Enerji> label="Enerji kaynağı" value={g.enerji} onChange={(v) => set('enerji', v)} className="w-full" options={(Object.keys(ENERJI_AD) as Enerji[]).map((v) => ({ value: v, label: ENERJI_AD[v] }))} />
            </div>
          )}
          {adim === 3 && (
            <div className="space-y-3">
              {g.enerji === 'sebeke' ? (
                <>
                  <div className="rounded-md border border-app-border bg-app-canvas px-3 py-2 text-small" data-testid="tarife-kutusu">
                    <b>{yaniti.tarife.ad}</b>
                    {yaniti.tarife.guncel ? (
                      <p>Birim fiyat {yaniti.tarife.birim_fiyat_tl_kwh} TL/kWh · geçerlilik {yaniti.tarife.gecerlilik_baslangic ?? '—'} → {yaniti.tarife.gecerlilik_bitis ?? 'süresiz'} · <a className="underline" href={yaniti.tarife.kaynak_url} target="_blank" rel="noreferrer">kaynak</a></p>
                    ) : (
                      <p data-testid="tarife-guncel-degil">{yaniti.tarife.mesaj} <a className="underline" href={yaniti.tarife.kaynak_url} target="_blank" rel="noreferrer">EPDK tarife tabloları</a></p>
                    )}
                  </div>
                  <TextField label="Elektrik birim fiyatı (TL/kWh)" hint={g.kwhFiyat ? 'Sizin girdiğiniz fiyat' : yaniti.tarife.guncel ? 'Boş bırakırsanız yukarıdaki tarife kullanılır' : 'Faturanızdaki birim fiyat'} inputMode="decimal" value={g.kwhFiyat} onChange={(e) => set('kwhFiyat', e.target.value)} error={hatalar.kwhFiyat} />
                </>
              ) : (
                <TextField label={`${ENERJI_AD[g.enerji]} maliyeti (TL/m³ su)`} hint="Sizin girdiğiniz maliyet; boşsa TL gösterilmez" inputMode="decimal" value={g.m3Maliyet} onChange={(e) => set('m3Maliyet', e.target.value)} error={hatalar.m3Maliyet} />
              )}
              <TextField label="Su ücreti, sulama birliği (TL/m³) · isteğe bağlı" inputMode="decimal" value={g.suUcreti} onChange={(e) => set('suUcreti', e.target.value)} error={hatalar.suUcreti} />
            </div>
          )}
          {hata && <p role="alert" className="text-small font-medium text-app-danger">{hata}</p>}
        </>
      )}
    </div>
    <footer className="flex justify-between gap-2 border-t border-app-border px-5 py-3">
      <Button variant="ghost" onClick={adim === 0 ? onClose : () => setAdim(adim - 1)}>{adim === 0 ? 'Vazgeç' : 'Geri'}</Button>
      {adim < ADIMLAR.length - 1
        ? <Button variant="primary" onClick={() => setAdim(adim + 1)} data-testid="sihirbaz-ileri">İleri</Button>
        : <Button variant="primary" loading={kaydet.isPending} disabled={Object.keys(hatalar).length > 0} onClick={bitir} data-testid="sihirbaz-kaydet">Kaydet</Button>}
    </footer>
    </Cerceve>
  )
}
