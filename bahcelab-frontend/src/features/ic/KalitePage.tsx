import { useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AkislarSekmesi } from './AkislarSekmesi'
import { BahcelerSekmesi } from './BahcelerSekmesi'
import { EtaSekmesi } from './EtaSekmesi'
import { KurallarSekmesi } from './KurallarSekmesi'
import { UyumSekmesi } from './UyumSekmesi'

const SEKMELER = [
  { id: 'akislar', ad: 'Akışlar', ic: <AkislarSekmesi /> },
  { id: 'uyum', ad: 'Kaynak uyumu', ic: <UyumSekmesi /> },
  { id: 'kurallar', ad: 'Kurallar', ic: <KurallarSekmesi /> },
  { id: 'bahceler', ad: 'Bahçeler', ic: <BahcelerSekmesi /> },
  { id: 'eta', ad: 'ETa', ic: <EtaSekmesi /> },
] as const

/** İÇ KALİTE EKRANI (9J Dilim 2, ADR 0030): veri ve model kalitesi izleme sekmeleri. Kullanıcıya gösterilmez; yalnız iç ekip (sunucu 403). */
export function KalitePage() {
  const [params, setParams] = useSearchParams()
  const secili = SEKMELER.find((s) => s.id === params.get('sekme')) ?? SEKMELER[0]
  const liste = useRef<HTMLDivElement>(null)
  const git = (i: number) => {
    const s = SEKMELER[(i + SEKMELER.length) % SEKMELER.length]!
    setParams({ sekme: s.id }, { replace: true })
    liste.current?.querySelector<HTMLElement>(`#sekme-${s.id}`)?.focus()
  }
  return (
    <main className="mx-auto w-full max-w-[1280px] p-4 text-small" data-testid="ic-izleme">
      <h1 className="text-h1 font-semibold">İç kalite · veri ve model izleme</h1>
      <p className="mt-1 text-app-text-muted">Kullanıcıya gösterilmez. Kullanıcıya yalnız bir şey bozukken bahçe panelinde tek satır «Veri uyarısı» çıkar (Ayrıntı → Durum'daki «Veri durumu» akordeonu) (ADR 0030).</p>
      <div ref={liste} role="tablist" aria-label="İzleme bölümleri" className="mt-3 flex flex-wrap gap-1 border-b border-app-border">
        {SEKMELER.map((s, i) => (
          <button
            key={s.id} id={`sekme-${s.id}`} role="tab" type="button" aria-selected={s.id === secili.id} aria-controls={`panel-${s.id}`} tabIndex={s.id === secili.id ? 0 : -1}
            onClick={() => setParams({ sekme: s.id }, { replace: true })}
            onKeyDown={(e) => { if (e.key === 'ArrowRight') { e.preventDefault(); git(i + 1) } else if (e.key === 'ArrowLeft') { e.preventDefault(); git(i - 1) } }}
            className={`min-h-11 rounded-t-md border-x border-t px-4 font-semibold ${s.id === secili.id ? 'border-app-border bg-app-card text-app-text' : 'border-transparent text-app-text-muted hover:bg-app-card-hover'}`}
            data-testid={`sekme-${s.id}`}
          >{s.ad}</button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${secili.id}`} aria-labelledby={`sekme-${secili.id}`} className="mt-4" data-testid={`panel-${secili.id}`}>{secili.ic}</div>
    </main>
  )
}
