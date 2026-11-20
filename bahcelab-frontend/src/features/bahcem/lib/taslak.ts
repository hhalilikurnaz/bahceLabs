/** Saha kaydı taslağı (ADR 0034 §6): form alanları cihazda saklanır; sayfa yenilense ya da uygulama kapansa kaybolmaz. Fotoğraflar taslağa girmez (çevrimdışı kuyruk sonraki dilimde). */
export interface Taslak {
  tur: string
  kategori: string
  etiket: string
  siddet: string
  yayginlik: string
  sektor: string
  not: string
  sure: string
  m3: string
  mm: string
  konumMod: 'yok' | 'nokta' | 'alan'
  nokta: [number, number] | null
  dogruluk: number | null
}

export const taslakAnahtari = (gardenId: string): string => `bahcelab:saha-taslak:${gardenId}`

type Depo = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export function taslakOku(depo: Depo, gardenId: string): Taslak | null {
  try {
    const ham = depo.getItem(taslakAnahtari(gardenId))
    if (!ham) return null
    const t = JSON.parse(ham) as Partial<Taslak>
    return typeof t.tur === 'string' && typeof t.not === 'string' ? ({ kategori: '', etiket: '', siddet: '', yayginlik: '', sektor: '', sure: '', m3: '', mm: '', konumMod: 'yok', nokta: null, dogruluk: null, ...t } as Taslak) : null
  } catch {
    return null
  }
}

/** Boş taslak (hiçbir şey yazılmamış) saklanmaz; depo dolu/kapalıysa sessizce vazgeçilir. */
export function taslakYaz(depo: Depo, gardenId: string, t: Taslak): void {
  try {
    const bos = !t.not.trim() && !t.etiket && !t.siddet && !t.yayginlik && !t.mm && !t.sure && !t.m3 && t.konumMod === 'yok'
    if (bos) depo.removeItem(taslakAnahtari(gardenId))
    else depo.setItem(taslakAnahtari(gardenId), JSON.stringify(t))
  } catch {
    /* depo yok ya da dolu: taslak olmadan devam */
  }
}

export function taslakSil(depo: Depo, gardenId: string): void {
  try {
    depo.removeItem(taslakAnahtari(gardenId))
  } catch {
    /* yoksay */
  }
}
