import { Link } from 'react-router-dom'
import { useSulamaPlani } from '../../../api/sulamaApi'
import { sulamaKarar } from '../../../lib/karar'
import { gardenPagePath } from '../../../lib/routes'
import { IkincilKart } from '../parcalar'

/** Su sekmesindeki «Sulama planı» kartı: karar cümlesi + sonraki sulama + «Plana git». Hesap ve ayrıntı tam sayfadadır (burada tekrar edilmez). */
export function SulamaKarti({ gardenId }: { gardenId: string }) {
  const q = useSulamaPlani(gardenId)
  const p = q.data
  return (
    <IkincilKart baslik="Sulama planı" testId="sulama-karti">
      {q.isLoading ? <p className="text-small text-app-text-muted" role="status">Plan yükleniyor…</p>
        : q.isError || !p ? <p className="text-small text-app-danger" role="alert">Sulama planı alınamadı.</p>
        : (
          <>
            <p className="text-body font-semibold" data-testid="sulama-karti-karar">{sulamaKarar(p)}</p>
            {p.durum === 'veri_yok' && p.neden && <p className="mt-1 text-small text-app-text-muted">{p.neden}</p>}
          </>
        )}
      <Link to={gardenPagePath(gardenId, 'sulama-plani')} data-testid="plana-git" className="mt-2 inline-flex min-h-11 items-center rounded-md border border-app-border-strong px-3 text-small font-semibold hover:border-app-text">{p?.durum === 'profil_yok' ? 'Sulama bilgilerini gir' : 'Plana git'}</Link>
    </IkincilKart>
  )
}
