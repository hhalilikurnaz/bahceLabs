import { useEffect } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useGardens } from '../../api/useGardens'
import { useBahcemRoute } from '../../hooks/useBahcemRoute'
import { gardenPath, isGardenTab } from '../../lib/routes'
import { useBahcemStore } from '../../stores/bahcemStore'
import { useToast } from './toastContext'

/**
 * Rota → durum eşlemesi: seçili bahçe URL'den gelir (`/bahcem/:id/:sekme`).
 * Bilinmeyen bahçe liste yüklendikten sonra listeye yönlendirilir; geçersiz sekme "durum"a düşer.
 */
export function RouteSync() {
  const { gardenId, rawTab } = useBahcemRoute()
  const selectGarden = useBahcemStore((s) => s.selectGarden)
  const { data: gardens, isSuccess, isFetching } = useGardens()
  const navigate = useNavigate()
  const toast = useToast()

  useEffect(() => {
    selectGarden(gardenId)
  }, [gardenId, selectGarden])

  const missing = gardenId !== null && isSuccess && !isFetching && !gardens.some((g) => g.id === gardenId)
  useEffect(() => {
    if (!missing) return
    toast.show('Bu bahçe bulunamadı; listeye döndünüz.', { tone: 'warn' })
    navigate('/bahcem', { replace: true })
  }, [missing, navigate, toast])

  if (gardenId && rawTab !== undefined && !isGardenTab(rawTab)) return <Navigate to={gardenPath(gardenId)} replace />
  return null
}
