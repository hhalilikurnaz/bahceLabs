import { useCallback, useMemo, useRef, useState } from 'react'
import { koseleriCokgene } from '../../lib/saha'

export type KonumModu = 'yok' | 'nokta' | 'alan'

/** Haritadan konum seçimi: «nokta» tek dokunuş, «alan» köşe köşe (en az 3). Mod 'yok' iken haritaya dokunmak bir şey seçmez. */
export function useKonumSecimi() {
  const [mod, setMod] = useState<KonumModu>('yok')
  const [nokta, setNokta] = useState<[number, number] | null>(null)
  const [koseler, setKoseler] = useState<[number, number][]>([])

  const modRef = useRef<KonumModu>('yok')
  modRef.current = mod // dokunma işleyicisi her zaman güncel modu okur (durum güncelleyicisinde yan etki YOK: geliştirmede iki kez çalışırdı)
  const haritaTikla = useCallback((lng: number, lat: number) => {
    if (modRef.current === 'nokta') setNokta([lng, lat])
    else if (modRef.current === 'alan') setKoseler((k) => [...k, [lng, lat]])
  }, [])
  const temizle = useCallback(() => {
    setNokta(null)
    setKoseler([])
    setMod('yok')
  }, [])
  const geriAl = useCallback(() => setKoseler((k) => k.slice(0, -1)), [])

  const konum = useMemo<GeoJSON.Point | GeoJSON.Polygon | null>(() => {
    if (mod === 'nokta' && nokta) return { type: 'Point', coordinates: nokta }
    if (mod === 'alan') return koseleriCokgene(koseler)
    return null
  }, [mod, nokta, koseler])

  return { mod, setMod, nokta, setNokta, koseler, haritaTikla, temizle, geriAl, konum }
}
export type KonumSecimi = ReturnType<typeof useKonumSecimi>
