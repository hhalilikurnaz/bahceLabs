import { useState } from 'react'
import { useYearDecision, type MultiyearYear } from '../../api/multiyearApi'
import { gunAy } from '../../lib/format'

/**
 * Uyumsuz yıl: mevcut durum yazılır + tek değiştirme eylemi (dahil et / analizden çıkar) + isteğe bağlı olay notu.
 * Yıl sessizce atılmaz; karar zamanıyla kaydedilir ve geri alınabilir.
 */
export function YilSorusu({ gardenId, yil }: { gardenId: string; yil: MultiyearYear }) {
  const karar = useYearDecision(gardenId)
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState(yil.karar_notu ?? '')
  const decided = !yil.karar_bekliyor
  const durum = yil.dahil ? 'analizde' : 'analiz dışında'
  const change = { yil: yil.yil, dahil: !yil.dahil }
  return (
    <li className="rounded-md border border-app-border bg-app-card px-3.5 py-3" data-testid="yil-sorusu" data-yil={yil.yil} data-bekliyor={yil.karar_bekliyor}>
      <p className="text-small">
        <b>{yil.yil}</b> yılı diğer yıllarla uyuşmuyor ve şu an <b data-testid="yil-durumu">{durum}</b>.
        {decided && yil.karar_zamani && <span className="num text-app-text-muted"> Kararınız {gunAy(yil.karar_zamani.slice(0, 10), 'always')} tarihinde kaydedildi.</span>}
      </p>
      <p className="mt-1 text-[12px] text-app-text-muted">
        {yil.dahil && !decided ? 'Son yıllardan biri olduğu için kendiliğinden dışlanmadı. ' : ''}Sel, budama ya da söküm gibi bir olay olabilir.
        {yil.karar_notu && <span data-testid="yil-notu"> Not: {yil.karar_notu}</span>}
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button type="button" disabled={karar.isPending} onClick={() => karar.mutate(change)} data-testid="yil-degistir" className="h-11 rounded-md border border-app-text px-3.5 text-[13px] font-semibold hover:bg-app-card-hover disabled:opacity-50">
          {yil.dahil ? 'Analizden çıkar' : 'Analize dahil et'}
        </button>
        {!noteOpen && <button type="button" onClick={() => setNoteOpen(true)} className="h-11 rounded-md px-3 text-[13px] font-semibold text-app-accent underline-offset-2 hover:underline">{yil.karar_notu ? 'Notu düzenle' : 'Olay notu ekle'}</button>}
        {decided && <button type="button" disabled={karar.isPending} onClick={() => karar.mutate({ yil: yil.yil, dahil: null })} className="h-11 rounded-md px-3 text-[13px] font-semibold text-app-accent underline-offset-2 hover:underline">Geri al</button>}
      </div>
      {noteOpen && (
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            karar.mutate({ yil: yil.yil, dahil: yil.dahil, olay_notu: note }, { onSuccess: () => setNoteOpen(false) })
          }}
        >
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} aria-label={`${yil.yil} olay notu`} placeholder="Örn. Mart’ta sel, bir kısım ağaç söküldü" className="h-11 min-w-0 flex-1 rounded-md border border-app-border-strong bg-app-card px-3 text-[13px]" />
          <button type="submit" disabled={karar.isPending} className="h-11 rounded-md bg-app-text px-3.5 text-[13px] font-semibold text-app-panel disabled:opacity-50">Kaydet</button>
        </form>
      )}
      {karar.isError && <p role="alert" className="mt-2 text-small text-app-danger">Karar kaydedilemedi; tekrar deneyin.</p>}
    </li>
  )
}
