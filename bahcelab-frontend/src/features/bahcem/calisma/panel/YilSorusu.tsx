import { useYearDecision, type MultiyearYear } from '../../api/multiyearApi'
import { gunAy } from '../../lib/format'

/** Uyumsuz yıl sorusu: yıl sessizce atılmaz; dahil/hariç kararı kaydedilir ve geri alınabilir. */
export function YilSorusu({ gardenId, yil }: { gardenId: string; yil: MultiyearYear }) {
  const karar = useYearDecision(gardenId)
  const bekliyor = yil.karar_bekliyor
  const simdiDahil = yil.dahil
  return (
    <li className="rounded-md border border-app-border bg-app-card px-3.5 py-3" data-testid="yil-sorusu" data-yil={yil.yil} data-bekliyor={bekliyor}>
      {bekliyor ? (
        <>
          <p className="text-[13.5px]"><b>{yil.yil}</b> yılı diğer yıllarla uyuşmuyor; sel, budama ya da söküm gibi bir olay olabilir. Analize dahil edilsin mi?</p>
          <p className="mt-1 text-[12px] text-app-text-muted">
            {yil.varsayilan_dahil ? 'Son yıllardan biri olduğu için kendiliğinden dışlanmadı; şu an analizde.' : 'Şu an analizin dışında.'}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button type="button" disabled={karar.isPending} onClick={() => karar.mutate({ yil: yil.yil, dahil: true })} className="h-11 rounded-md border border-app-text px-3.5 text-[13px] font-semibold hover:bg-app-card-hover disabled:opacity-50">Analize dahil et</button>
            <button type="button" disabled={karar.isPending} onClick={() => karar.mutate({ yil: yil.yil, dahil: false })} className="h-11 rounded-md border border-app-border px-3.5 text-[13px] font-semibold hover:bg-app-card-hover disabled:opacity-50">Hariç tut</button>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[13px]">
            <b>{yil.yil}</b> yılı {simdiDahil ? 'analize dahil edildi' : 'analizden hariç tutuldu'}
            {yil.karar_zamani && <span className="num text-app-text-muted"> · {gunAy(yil.karar_zamani.slice(0, 10), 'always')}</span>}
          </p>
          <button type="button" disabled={karar.isPending} onClick={() => karar.mutate({ yil: yil.yil, dahil: null })} className="h-11 rounded-md px-3 text-[13px] font-semibold text-app-accent underline-offset-2 hover:underline">Geri al</button>
        </div>
      )}
      {karar.isError && <p role="alert" className="mt-2 text-[12.5px] text-app-danger">Karar kaydedilemedi; tekrar deneyin.</p>}
    </li>
  )
}
