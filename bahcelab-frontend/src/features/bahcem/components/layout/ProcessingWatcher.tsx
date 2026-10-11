import { useEffect } from 'react'
import { useIndices } from '../../api/indeksApi'
import { useBahcemStore } from '../../stores/bahcemStore'
import { useToast } from './toastContext'

/** Kayıt/sınır değişikliğinden sonra uydu verisi işlenirken izler; bitince (ya da hata verince) bildirim gösterir. */
export function ProcessingWatcher() {
  const watched = useBahcemStore((s) => s.watched)
  const clear = useBahcemStore((s) => s.clearWatched)
  const toast = useToast()
  const { data } = useIndices(watched?.id ?? null)
  const job = data?.isleme ?? null

  useEffect(() => {
    if (!watched || !job || job.id === watched.ignoreJobId) return
    if (job.durum === 'tamam') {
      toast.show(`“${watched.ad}” için uydu görüntüleri hazır.`)
      clear()
    } else if (job.durum === 'hata') {
      toast.show(`“${watched.ad}” için uydu görüntüleri işlenemedi. Bahçe sayfasından “Şimdi güncelle”yi deneyin.`, { tone: 'warn' })
      clear()
    }
  }, [watched, job, toast, clear])

  return null
}
