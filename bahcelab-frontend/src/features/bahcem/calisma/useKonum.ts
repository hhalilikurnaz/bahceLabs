import { useState } from 'react'
import { useEdinimler } from '../api/edinimApi'
import { useNormalBantlar, type NormalBantAy } from '../api/normalBantApi'
import { konumOf, konumSayisi, type KonumKodu } from '../lib/karar'

export interface KonumVerisi {
  yukleniyor: boolean
  hata: unknown
  /** son net görüntünün canlılık (NDVI) medyanı */
  deger: number | null
  tarih: string | null
  yasGun: number | null
  band: NormalBantAy | undefined
  konum: KonumKodu | null
  sayi: { buyuk: string; kucuk: string } | null
}

/** Son net görüntünün, bahçenin kendi o ayki normal bandına göre konumu (Durum ve Bahçeler listesi tek kaynak). */
export function useKonum(gardenId: string | null): KonumVerisi {
  const ed = useEdinimler(gardenId)
  const bantlar = useNormalBantlar(gardenId)
  const son = [...(ed.data?.edinimler ?? [])].reverse().find((e) => e.gostergeler.ndvi)
  const deger = son?.gostergeler.ndvi?.medyan ?? null
  const ay = son ? Number(son.tarih.slice(5, 7)) : null
  const band = ay ? bantlar.data?.gostergeler.ndvi?.find((b) => b.ay === ay) : undefined
  const [simdi] = useState(() => Date.now()) // sayfa açıldığı an (render saf kalır)
  const yasGun = son ? Math.max(0, Math.round((simdi - Date.parse(`${son.tarih}T12:00:00Z`)) / 86_400_000)) : null
  return {
    yukleniyor: ed.isLoading || bantlar.isLoading,
    hata: ed.error ?? bantlar.error,
    deger,
    tarih: son?.tarih ?? null,
    yasGun,
    band,
    konum: deger !== null ? konumOf(deger, band) : null,
    sayi: deger !== null ? konumSayisi(deger, band) : null,
  }
}

/** Bu yılın Sentinel-2 görüntülerinin normal bandın içinde / altında / üstünde sayısı (kıyas AYNI kaynakla: bant Sentinel-2'den kurulur). */
export function useSezonDagilimi(gardenId: string | null): { yukleniyor: boolean; ic: number; alt: number; ust: number; n: number } {
  const ed = useEdinimler(gardenId)
  const bantlar = useNormalBantlar(gardenId)
  const yil = new Date().getFullYear()
  let ic = 0
  let alt = 0
  let ust = 0
  for (const e of ed.data?.edinimler ?? []) {
    const v = e.gostergeler.ndvi?.medyan
    if (v === undefined || !e.tarih.startsWith(`${yil}-`)) continue
    const k = konumOf(v, bantlar.data?.gostergeler.ndvi?.find((b) => b.ay === Number(e.tarih.slice(5, 7))))
    if (k === 'icinde') ic++
    else if (k === 'altinda') alt++
    else if (k === 'ustunde') ust++
  }
  return { yukleniyor: ed.isLoading || bantlar.isLoading, ic, alt, ust, n: ic + alt + ust }
}
