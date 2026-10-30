import { useGecmisBaslat, useGecmisDoldurma } from '../../api/gecmisApi'

/**
 * Geçmiş doldurma durumu: sürerken «Geçmiş çekiliyor · %40» (ilerleme çubuğuyla), hata varsa «Devam et», hiç başlamadıysa «Geçmişi çek».
 * Tamamlanınca görünmez. Çekim sürerken grafikler uydurma değer göstermez («veri çekiliyor» boş durumu).
 */
export function GecmisCekiliyor({ gardenId }: { gardenId: string }) {
  const { data } = useGecmisDoldurma(gardenId)
  const baslat = useGecmisBaslat(gardenId)
  if (!data || data.durum === 'tamam') return null
  const calisiyor = data.durum === 'isleniyor'
  return (
    <div role="status" data-testid="gecmis-cekiliyor" data-durum={data.durum} className="rounded-md border border-app-border bg-app-card px-3.5 py-2.5">
      <div className="flex items-center justify-between gap-3 text-[13px]">
        <span className="font-semibold">
          {calisiyor ? `Geçmiş çekiliyor · %${data.yuzde}` : data.durum === 'hata' ? `Geçmiş çekimi yarım kaldı · %${data.yuzde}` : 'Geçmiş henüz çekilmedi'}
        </span>
        {!calisiyor && (
          <button type="button" disabled={baslat.isPending} onClick={() => baslat.mutate()} className="h-11 rounded-md border border-app-border px-3 text-small font-semibold hover:border-app-text disabled:opacity-50">
            {data.durum === 'hata' ? 'Devam et' : 'Geçmişi çek'}
          </button>
        )}
      </div>
      {calisiyor && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-app-border" aria-hidden>
          <div className="h-full bg-app-accent transition-[width]" style={{ width: `${data.yuzde}%` }} />
        </div>
      )}
      <p className="num mt-1.5 text-caption text-app-text-muted">
        {data.tamamlanan_ay}/{data.toplam_ay} ay · {data.net_sahne} net sahne
      </p>
    </div>
  )
}
