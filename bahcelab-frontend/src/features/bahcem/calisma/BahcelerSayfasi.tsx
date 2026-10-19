import { useEffect } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Skeleton } from '@/components/ui'
import { useGardens } from '../api/useGardens'
import { useToast } from '../components/layout/toastContext'
import { GARDEN_TAB_LABELS, gardenPath, isGardenPage, isGardenTab, type GardenPage } from '../lib/routes'
import { BahceCubugu } from './BahceCubugu'
import { CalismaAlani } from './CalismaAlani'
import { GecmisSayfasi } from './GecmisSayfasi'
import { DefterSayfasi } from './DefterSayfasi'

/** `/bahceler/:id[/:sekme|gecmis|defter]` */
export function BahceSayfasi() {
  const { id, sekme } = useParams()
  const { data: gardens, isSuccess, isFetching } = useGardens()
  const navigate = useNavigate()
  const toast = useToast()
  const garden = gardens?.find((g) => g.id === id)
  const missing = isSuccess && !isFetching && !garden

  useEffect(() => {
    if (!missing) return
    toast.show('Bu bahçe bulunamadı.', { tone: 'warn' })
    navigate('/bahceler', { replace: true })
  }, [missing, navigate, toast])

  if (!garden || !gardens) return <Skeleton className="m-6 h-40" aria-label="Bahçe yükleniyor" />
  if (sekme !== undefined && !isGardenTab(sekme) && !isGardenPage(sekme)) return <Navigate to={gardenPath(garden.id)} replace />
  const page: GardenPage | null = isGardenPage(sekme) ? sekme : null
  const tab = isGardenTab(sekme) ? sekme : 'durum'
  return (
    <>
      <h1 className="sr-only">{garden.ad} · {page === 'gecmis' ? 'Geçmiş' : page === 'defter' ? 'Saha Defteri' : GARDEN_TAB_LABELS[tab]}</h1>
      <BahceCubugu garden={garden} gardens={gardens} tab={page ? null : tab} />
      {page === 'gecmis' ? <GecmisSayfasi garden={garden} /> : page === 'defter' ? <DefterSayfasi garden={garden} /> : <CalismaAlani garden={garden} gardens={gardens} tab={tab} />}
    </>
  )
}
