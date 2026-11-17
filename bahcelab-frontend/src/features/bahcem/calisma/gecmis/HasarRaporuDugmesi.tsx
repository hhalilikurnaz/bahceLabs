import { useState } from 'react'
import { hasarRaporuIndir } from '../../api/donApi'

/** «Hasar raporu hazırla»: don olayı için PDF taslağı (hava kanıtı, Sentinel-2 önce/sonra, çiftçi fotoğrafları, olay etiketi). Resmi ekspertiz DEĞİLDİR. */
export function HasarRaporuDugmesi({ gardenId, olayId }: { gardenId: string; olayId: string }) {
  const [durum, setDurum] = useState<'bosta' | 'hazirlaniyor' | 'hata'>('bosta')
  return (
    <span className="inline-flex flex-col">
      <button type="button" disabled={durum === 'hazirlaniyor'} data-testid="hasar-raporu" onClick={() => { setDurum('hazirlaniyor'); hasarRaporuIndir(gardenId, olayId).then(() => setDurum('bosta')).catch(() => setDurum('hata')) }}
        className="inline-flex min-h-11 items-center rounded-md border border-app-text px-3 text-small font-semibold hover:bg-app-card-hover disabled:opacity-60">{durum === 'hazirlaniyor' ? 'Rapor hazırlanıyor…' : 'Hasar raporu hazırla'}</button>
      <span className="text-caption text-app-text-muted">TARSİM başvurusuna yardımcı taslak — resmi ekspertiz değildir</span>
      {durum === 'hata' && <span role="alert" className="text-caption text-app-danger" data-testid="hasar-raporu-hata">Rapor hazırlanamadı; tekrar deneyin.</span>}
    </span>
  )
}
