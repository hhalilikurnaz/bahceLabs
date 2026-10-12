import { useEffect } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Skeleton } from '@/components/ui'
import { useGardens } from '../api/useGardens'
import { useToast } from '../components/layout/toastContext'
import { BosDurum } from '../kabuk/BosDurum'
import { GARDEN_TAB_LABELS, NEW_GARDEN_PATH, gardenPath, isGardenPage, isGardenTab, type GardenPage } from '../lib/routes'
import { BahceCubugu } from './BahceCubugu'
import { CalismaAlani } from './CalismaAlani'
import { DefterSayfasi, GecmisSayfasi } from './TamSayfalar'

/** `/bahceler`: ilk bahçeye yönlenir; bahçe yoksa ekleme davetiyesi. */
export function BahcelerGiris() {
  const { data, isLoading } = useGardens()
  if (isLoading) return <Skeleton className="m-6 h-40" aria-label="Bahçeler yükleniyor" />
  if (data && data.length > 0) return <Navigate to={gardenPath(data[0].id)} replace />
  return (
    <BosDurum gravur="agac" baslik="İlk bahçenizi ekleyin" fayda="Sınırı haritada çizin ya da KML/KMZ/GeoJSON dosyası yükleyin; uydu görüntüleri birkaç dakikada işlenir." testId="bahce-yok">
      <Link to={NEW_GARDEN_PATH} className="inline-flex h-10 items-center rounded-md bg-app-primary px-4 text-[14px] font-semibold text-app-on-primary">Bahçe ekle</Link>
    </BosDurum>
  )
}

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
      {page === 'gecmis' ? <GecmisSayfasi /> : page === 'defter' ? <DefterSayfasi garden={garden} /> : <CalismaAlani garden={garden} gardens={gardens} tab={tab} />}
    </>
  )
}
