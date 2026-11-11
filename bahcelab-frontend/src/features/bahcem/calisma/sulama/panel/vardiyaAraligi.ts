import type { Vardiya } from '../../../api/sulamaPanelApi'

const dk = (h: string): number => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5))

/** Vardiyanın [başlangıç, bitiş] dakikası (saatli kalem yoksa null): oynatmada «şu an» çizgisi ve vana ilerlemesi bunun içinde hareket eder. */
export function vardiyaAraligi(v: Vardiya): { bas: number; bit: number } | null {
  const saatli = v.kalemler.filter((k) => k.baslangic && k.bitis && k.sure_dk)
  if (saatli.length === 0) return null
  return { bas: dk(v.baslangic), bit: Math.max(...saatli.map((k) => dk(k.baslangic as string) + (k.sure_dk as number))) }
}

