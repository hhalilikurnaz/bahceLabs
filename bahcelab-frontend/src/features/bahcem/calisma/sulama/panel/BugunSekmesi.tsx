import { Button } from '@/components/ui'
import { useToast } from '../../../components/layout/toastContext'
import { describeError } from '../../../api/gardensApi'
import { useSulamaIsle, useSulamaOnayla, type PanelYaniti, type Vardiya } from '../../../api/sulamaPanelApi'
import { sayi } from '../../../lib/format'
import { sureMetni } from '../../../lib/karar'
import { vanaEtiketi } from '../../../lib/sulamaPanel'

const GUN = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']
const gunKisa = (iso: string): string => GUN[new Date(`${iso}T12:00:00Z`).getUTCDay()]

export function VardiyaTablosu({ v, testId = 'vardiya-tablosu' }: { v: Vardiya; testId?: string }) {
  return (
    <div data-testid={testId}>
      <ul className="divide-y divide-app-border rounded-md border border-app-border">
        {v.kalemler.map((k) => (
          <li key={k.sektor} className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 text-small" data-testid="vardiya-kalemi">
            <b className="text-body">{k.sektor === 'Bahçe' ? 'Bahçe' : k.sektor}</b>
            <span className="text-app-text-muted">{k.baslangic ? `${k.baslangic} – ${k.bitis}` : 'saat yok'}{k.sure_dk ? ` · ${sureMetni(k.sure_dk)}` : ''}</span>
            <span className="text-right tabular-nums">{sayi(k.m3, 0)} m³{k.litre_agac != null ? ` · ${sayi(k.litre_agac, 0)} L/ağaç` : ''}</span>
          </li>
        ))}
      </ul>
      {v.zaman_notu && <p className="mt-1 text-caption text-app-text-dim" data-testid="vardiya-notu">{v.zaman_notu}</p>}
    </div>
  )
}

/** Bugün sekmesi: 7 gün şeridi · vana durumları (haritadakiyle AYNI etiket) · sonraki program (vardiya) · [Programı onayla] · [Saha Defteri'ne işle]. */
export function BugunSekmesi({ gardenId, panel }: { gardenId: string; panel: PanelYaniti }) {
  const onayla = useSulamaOnayla(gardenId)
  const isle = useSulamaIsle(gardenId)
  const toast = useToast()
  const v = panel.vardiya
  return (
    <div className="grid gap-3" data-testid="sulama-bugun">
      <section className="rounded-md border border-app-border bg-app-card p-4" aria-label="Bu hafta">
        <h3 className="text-lead font-semibold">7 gün</h3>
        <ol className="mt-2 grid grid-cols-7 gap-1" data-testid="hafta-seridi">
          {panel.hafta.map((d) => (
            <li key={d.tarih} data-testid={d.sulama ? 'hafta-sulama' : 'hafta-gun'} className={`rounded-md border p-1.5 text-center text-caption ${d.sulama ? 'border-app-text bg-app-primary text-app-on-primary' : 'border-app-border bg-app-canvas text-app-text-muted'}`}>
              <b className="block">{d.tarih === panel.bugun ? 'Bugün' : gunKisa(d.tarih)}</b>
              <span className="block tabular-nums">{d.ort_doluluk_pct == null ? '—' : `%${Math.round(d.ort_doluluk_pct)}`}</span>
              <span className="block tabular-nums">{d.yagis_mm != null && d.yagis_mm >= 1 ? `${sayi(d.yagis_mm, 0)} mm` : '·'}</span>
              <span className="block font-semibold">{d.sulama ? 'sulama' : ' '}</span>
            </li>
          ))}
        </ol>
        <p className="mt-1 text-caption text-app-text-dim">Vana ortalaması % kullanılabilir su · yağış · sulama günü</p>
      </section>
      <section className="rounded-md border border-app-border bg-app-card p-4" aria-label="Vanalar">
        <h3 className="text-lead font-semibold">{panel.sektor_tanimli ? 'Vanalar' : 'Bahçe'}</h3>
        <ul className="mt-2 divide-y divide-app-border" data-testid="vana-listesi">
          {panel.sektorler.map((s) => {
            const e = vanaEtiketi(s)
            return (
              <li key={s.ad} className="flex flex-wrap items-baseline justify-between gap-x-3 py-2" data-testid="vana-satiri" data-vana={s.ad} data-etiket={s.etiket ?? ''}>
                <b className="text-body" data-testid="vana-baslik">{e.baslik}</b>
                <span className="text-small text-app-text-muted" data-testid="vana-alt">{e.alt}</span>
                <span className="basis-full text-caption text-app-text-dim">{sayi(s.alan_dekar, 1)} da{s.agac_sayisi != null ? ` · ${s.agac_sayisi} ağaç${s.agac_kaynak === 'orantili' ? ' (alana orantılı)' : ''}` : ''}</span>
              </li>
            )
          })}
        </ul>
        {!panel.sektor_tanimli && <p className="mt-1 text-caption text-app-text-dim" data-testid="vana-not">Vana sektörü çizilmedi: bahçe tek sektör olarak hesaplanır.</p>}
      </section>
      <section className="rounded-md border border-app-border bg-app-card p-4" aria-label="Sonraki program" data-testid="sonraki-program">
        <h3 className="text-lead font-semibold">Sonraki program {v && <span className="text-small font-normal text-app-text-dim">{Number(v.tarih.slice(8, 10))}.{v.tarih.slice(5, 7)} · {v.baslangic}'ten itibaren</span>}</h3>
        {v ? (
          <>
            <div className="mt-2"><VardiyaTablosu v={v} /></div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="primary" loading={onayla.isPending} disabled={v.onayli} onClick={() => onayla.mutate(v.tarih, { onSuccess: () => toast.show('Program onaylandı; sulama günü yaklaşınca bildirim gelir.'), onError: (e) => toast.show(describeError(e), { tone: 'warn' }) })} data-testid="programi-onayla">{v.onayli ? 'Program onaylandı' : 'Programı onayla'}</Button>
              <Button onClick={() => isle.mutate(v.tarih, { onSuccess: (r) => toast.show(r.yazilan > 0 ? `Saha Defteri'ne ${r.yazilan} sulama kaydı işlendi.` : 'Bu program zaten işlenmiş.'), onError: (e) => toast.show(describeError(e), { tone: 'warn' }) })} loading={isle.isPending} data-testid="sahaya-isle">Saha Defteri'ne işle</Button>
            </div>
            <p className="mt-1 text-caption text-app-text-dim">Onaylarsanız sulama günü yaklaşınca uygulama içi bildirim gelir (WhatsApp hatırlatması sonraki sürümde). «İşle» gerçekleşen sulamayı vana başına kaydeder; kova ve alışkanlık buradan beslenir.</p>
          </>
        ) : <p className="mt-2 text-small text-app-text-muted" data-testid="program-yok">Önümüzdeki 10 günde sulama programı yok.</p>}
      </section>
    </div>
  )
}
