/** İstemci tarafında fotoğraf küçültme (ADR 0034 §6): uzun kenar ve hedef boyut sunucudaki katalogdan gelir (`/gunluk/sozluk`). Canvas ile yeniden kodlama EXIF'i (konum dahil) siler. */

/** Uzun kenarı `uzun` pikseli aşmayacak şekilde ölçek: küçük görüntü büyütülmez. */
export function olcekle(genislik: number, yukseklik: number, uzun: number): { w: number; h: number } {
  const en = Math.max(genislik, yukseklik)
  if (en <= uzun) return { w: genislik, h: yukseklik }
  const k = uzun / en
  return { w: Math.max(1, Math.round(genislik * k)), h: Math.max(1, Math.round(yukseklik * k)) }
}

/** Kalite basamakları (yüksekten düşüğe): hedef boyuta ilk uyan seçilir. */
export const KALITE_BASAMAKLARI = [0.85, 0.75, 0.65, 0.55, 0.45] as const

export function kaliteSec(boyutlar: readonly number[], hedefBayt: number): number {
  const i = boyutlar.findIndex((b) => b <= hedefBayt)
  return i === -1 ? boyutlar.length - 1 : i
}

const toBlob = (c: HTMLCanvasElement, kalite: number) => new Promise<Blob | null>((res) => c.toBlob(res, 'image/jpeg', kalite))

/**
 * Fotoğrafı küçültür ve EXIF'siz JPEG'e çevirir. Çözülemeyen dosya (ör. desteklenmeyen biçim) olduğu gibi döner: sunucu doğrulaması son sözü söyler.
 */
export async function fotoKucult(dosya: File, uzunKenar: number, hedefBayt: number): Promise<File> {
  try {
    const bmp = await createImageBitmap(dosya, { imageOrientation: 'from-image' })
    const { w, h } = olcekle(bmp.width, bmp.height, uzunKenar)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return dosya
    ctx.drawImage(bmp, 0, 0, w, h)
    bmp.close()
    let son: Blob | null = null
    for (const kalite of KALITE_BASAMAKLARI) {
      son = await toBlob(canvas, kalite)
      if (son && son.size <= hedefBayt) break
    }
    if (!son) return dosya
    return new File([son], dosya.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch {
    return dosya
  }
}
