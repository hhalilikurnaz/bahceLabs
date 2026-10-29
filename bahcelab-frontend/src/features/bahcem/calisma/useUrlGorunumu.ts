import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useEdinimler } from '../api/edinimApi'
import { useOlaylar } from '../api/olayApi'
import { useToast } from '../components/layout/toastContext'
import { useCalismaStore } from './calismaStore'
import { KATMAN_SIRASI, type KatmanId } from './katmanlar'

const GUN = /^\d{4}-\d{2}-\d{2}$/
const isKatman = (v: string | null): v is KatmanId => v !== null && (KATMAN_SIRASI as string[]).includes(v)

/**
 * Bağlantıyla gelen harita görünümü (Geçmiş sayfası, bildirim paneli, günlük özet): `?tarih=YYYY-AA-GG`, `?katman=…`, `?yil=2018`, `?olay=<kimlik>`.
 * Parametreler bir kez uygulanır ve adresten silinir. Olay: kaydın görüldüğü ilk net görüntü açılır ve haritada olay kartı gösterilir.
 * Çalışma alanı bahçe değişiminde görünümü sıfırlar; bu kanca ondan SONRA çalışmalıdır (aynı bileşende, sonra bildirilir).
 */
export function useUrlGorunumu(gardenId: string): void {
  const [params, setParams] = useSearchParams()
  const olayId = params.get('olay')
  const edinim = useEdinimler(olayId ? gardenId : null)
  const olaylar = useOlaylar(olayId ? gardenId : null)
  const toast = useToast()
  const { setTarih, setKatman, setYil, setOlay } = useCalismaStore.getState()

  useEffect(() => {
    const tarih = params.get('tarih')
    const katman = params.get('katman')
    const yil = Number(params.get('yil'))
    if (!tarih && !katman && !params.get('yil')) return
    if (isKatman(katman)) setKatman(katman)
    if (tarih && GUN.test(tarih)) setTarih(tarih)
    if (Number.isInteger(yil) && yil >= 2015 && yil <= 2100) setYil(yil)
    const next = new URLSearchParams(params)
    ;['tarih', 'katman', 'yil'].forEach((k) => next.delete(k))
    setParams(next, { replace: true })
  }, [params, setParams, setTarih, setKatman, setYil])

  useEffect(() => {
    if (!olayId || !olaylar.data || !edinim.data) return
    const olay = [...olaylar.data.olaylar, ...olaylar.data.supheler].find((o) => o.id === olayId)
    if (olay) {
      const sahneler = edinim.data.edinimler.map((e) => e.tarih).sort()
      const gorulen = sahneler.find((t) => t >= olay.baslangic) ?? sahneler[sahneler.length - 1] ?? null
      if (olay.katman && isKatman(olay.katman)) setKatman(olay.katman)
      else setKatman('canlilik')
      setTarih(gorulen && gorulen !== sahneler[sahneler.length - 1] ? gorulen : null)
      setOlay({ id: olay.id, ad: olay.tur_adi, baslangic: olay.baslangic, bitis: olay.bitis })
    } else {
      toast.show('Bu olay artık listede yok (olay motoru yeniden hesaplamış olabilir).', { tone: 'warn' }) // bildirim eski, olay kimliği yeniden kurulmuş
    }
    const next = new URLSearchParams(params)
    next.delete('olay')
    setParams(next, { replace: true })
  }, [olayId, olaylar.data, edinim.data, params, setParams, setTarih, setKatman, setOlay, toast])
}
