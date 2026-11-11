import { Button } from '@/components/ui'
import { useToast } from '../../../components/layout/toastContext'
import { useSulamaIsle, useSulamaProgramEkle, type PanelYaniti } from '../../../api/sulamaPanelApi'
import { kcCumlesi, vanaEtiketi } from '../../../lib/sulamaPanel'
import { useSulamaHaritaStore } from '../harita/sulamaHaritaStore'

const f = (x: number, n = 0) => x.toLocaleString('tr-TR', { minimumFractionDigits: n, maximumFractionDigits: n })

/** Haritada bir vana seçilince panel o vanaya odaklanır: durum, Kc kaynağı, [Bu vanaya kayıt işle] ve [Bu vanayı programa ekle]. */
export function VanaOdagi({ gardenId, panel }: { gardenId: string; panel: PanelYaniti }) {
  const secili = useSulamaHaritaStore((s) => s.secili)
  const sec = useSulamaHaritaStore((s) => s.setSecili)
  const isle = useSulamaIsle(gardenId)
  const ekle = useSulamaProgramEkle(gardenId)
  const toast = useToast()
  const s = panel.sektorler.find((x) => x.ad === secili)
  if (!secili || !s) return null
  const e = vanaEtiketi(s)
  const bugunSulama = panel.vardiya?.kalemler.some((k) => k.sektor === s.ad) ?? false
  const hata = (m: string) => (err: unknown) => toast.show(err instanceof Error ? err.message : m)
  return (
    <section className="rounded-md border border-app-text bg-app-card p-4" aria-label={`${s.ad} vanası`} data-testid="vana-odagi">
      <div className="flex items-start justify-between gap-2">
        <div><h3 className="text-lead font-semibold" data-testid="vana-odagi-baslik">{e.baslik}</h3><p className="text-small text-app-text-muted">{e.alt}</p></div>
        <button type="button" onClick={() => sec(null)} className="min-h-11 min-w-11 text-small font-semibold underline" data-testid="vana-odagi-kapat">Tüm bahçe</button>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-small">
        <dt className="text-app-text-muted">Alan</dt><dd className="text-right tabular-nums">{f(s.alan_dekar, 1)} dekar</dd>
        <dt className="text-app-text-muted">Stres (7 gün)</dt><dd className="text-right tabular-nums" data-testid="vana-stres7">{s.stres_7g} gün</dd>
        <dt className="text-app-text-muted">Fazla su (7 gün)</dt><dd className="text-right tabular-nums" data-testid="vana-fazla7">{f(s.fazla_su_7g_mm, 1)} mm</dd>
        {s.vana_debi_m3h !== null && (<><dt className="text-app-text-muted">Debi</dt><dd className="text-right tabular-nums">{f(s.vana_debi_m3h, 1)} m³/sa</dd></>)}
      </dl>
      {s.kc && <p className="mt-2 text-small" data-testid="vana-kc">{kcCumlesi(s.kc)}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="primary" disabled={isle.isPending || !panel.vardiya || !bugunSulama} title={!bugunSulama ? 'Bu vana sonraki programda yok' : undefined} onClick={() => isle.mutate({ tarih: panel.vardiya!.tarih, sektor: s.ad }, { onSuccess: () => toast.show(`${s.ad} için sulama kaydı Saha Defteri'ne işlendi.`), onError: hata('Kayıt işlenemedi.') })} data-testid="vana-kayit-isle">Bu vanaya kayıt işle</Button>
        <Button variant="secondary" disabled={ekle.isPending} onClick={() => ekle.mutate({ sektor: s.ad }, { onSuccess: () => toast.show(`${s.ad} programa eklendi.`), onError: hata('Programa eklenemedi.') })} data-testid="vana-programa-ekle">Bu vanayı programa ekle</Button>
      </div>
    </section>
  )
}
