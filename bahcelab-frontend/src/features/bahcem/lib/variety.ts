/** Çeşit alanı değerleri ve API dönüşümleri (SAF). */

export interface VarietyValue {
  kod: string
  /** `kod === 'diger'` iken kullanıcının yazdığı çeşit adı */
  metin: string
}

/** Form değerinden API alanları: kodsuzsa ikisi de null (çeşit temizlenir). */
export function varietyPayload(value: VarietyValue): { cesitKodu: string | null; cesit: string | null } {
  if (!value.kod) return { cesitKodu: null, cesit: null }
  return { cesitKodu: value.kod, cesit: value.kod === 'diger' ? value.metin.trim() || null : null }
}

/** Kayıtlı bahçeden form değeri (eski kayıt: kod yoksa serbest metin 'diger' sayılır). */
export function varietyValueOf(cesitKodu: string | null, cesit: string | null): VarietyValue {
  if (cesitKodu) return { kod: cesitKodu, metin: cesitKodu === 'diger' ? (cesit ?? '') : '' }
  return cesit ? { kod: 'diger', metin: cesit } : { kod: '', metin: '' }
}
