import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { koseleriCokgene } from '../../lib/saha'
import { taslakOku } from '../../lib/taslak'

export type KonumModu = 'yok' | 'nokta' | 'alan'

/** Haritadan konum seçimi: «nokta» tek dokunuş, «alan» köşe köşe (en az 3). Mod 'yok' iken haritaya dokunmak bir şey seçmez. */
export function useKonumSecimi(gardenId?: string) {
  const [taslak] = useState(() => (gardenId ? taslakOku(window.localStorage, gardenId) : null)) // yarım kalan kaydın konumu geri gelir
  const [mod, setMod] = useState<KonumModu>(taslak?.konumMod === 'nokta' ? 'nokta' : 'yok')
  const [nokta, setNokta] = useState<[number, number] | null>(taslak?.konumMod === 'nokta' ? taslak.nokta : null)
  const [koseler, setKoseler] = useState<[number, number][]>([])
  const [dogruluk, setDogruluk] = useState<number | null>(taslak?.konumMod === 'nokta' ? taslak.dogruluk : null) // GPS doğruluğu (m); haritadan seçimde null
  const [gpsDurum, setGpsDurum] = useState<'bos' | 'araniyor' | 'hata'>('bos')
  const [gpsHata, setGpsHata] = useState<string | null>(null)

  const modRef = useRef<KonumModu>('yok')
  useEffect(() => {
    modRef.current = mod // dokunma işleyicisi her zaman güncel modu okur (durum güncelleyicisinde yan etki YOK: geliştirmede iki kez çalışırdı)
  }, [mod])
  const haritaTikla = useCallback((lng: number, lat: number) => {
    if (modRef.current === 'nokta') {
      setNokta([lng, lat])
      setDogruluk(null)
    } else if (modRef.current === 'alan') setKoseler((k) => [...k, [lng, lat]])
  }, [])
  const temizle = useCallback(() => {
    setNokta(null)
    setKoseler([])
    setDogruluk(null)
    setGpsDurum('bos')
    setGpsHata(null)
    setMod('yok')
  }, [])
  /** «Konumumu kullan»: cihaz GPS'i; nokta moduna geçer ve doğruluğu (m) saklar. Harita gerekmez (çevrimdışıyken de çalışır). */
  const gpsKullan = useCallback(() => {
    setGpsHata(null)
    if (!navigator.geolocation) {
      setGpsDurum('hata')
      setGpsHata('Bu cihaz konum vermiyor.')
      return
    }
    setGpsDurum('araniyor')
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setMod('nokta')
        setNokta([p.coords.longitude, p.coords.latitude])
        setDogruluk(Math.round(p.coords.accuracy * 10) / 10)
        setGpsDurum('bos')
      },
      (e) => {
        setGpsDurum('hata')
        setGpsHata(e.code === 1 ? 'Konum izni verilmedi. Haritadan nokta seçebilirsiniz.' : 'Konum alınamadı. Haritadan nokta seçebilirsiniz.')
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    )
  }, [])
  const geriAl = useCallback(() => setKoseler((k) => k.slice(0, -1)), [])

  const konum = useMemo<GeoJSON.Point | GeoJSON.Polygon | null>(() => {
    if (mod === 'nokta' && nokta) return { type: 'Point', coordinates: nokta }
    if (mod === 'alan') return koseleriCokgene(koseler)
    return null
  }, [mod, nokta, koseler])

  return { mod, setMod, nokta, setNokta, koseler, haritaTikla, temizle, geriAl, konum, dogruluk, gpsDurum, gpsHata, gpsKullan }
}
export type KonumSecimi = ReturnType<typeof useKonumSecimi>
