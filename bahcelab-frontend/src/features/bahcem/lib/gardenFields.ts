/** Bahçe bilgi alanlarının doğrulaması (sunucu kurallarının aynısı; hata metinleri alanın başında gösterilir). */
import { GARDEN_LIMITS } from './config'

export interface GardenFieldValues {
  ad: string
  cesit: string
  dikimYili: string
  agacSayisi: string
}

export type GardenFieldErrors = Partial<Record<keyof GardenFieldValues, string>>

const tr = (n: number) => n.toLocaleString('tr-TR')

/** Boşsa null, tam sayıysa sayı, değilse NaN. */
export function parseOptionalInt(text: string): number | null {
  const t = text.trim()
  if (t === '') return null
  return /^\d+$/.test(t) ? Number(t) : Number.NaN
}

export function validateGardenFields(values: GardenFieldValues, thisYear: number, requireName = true): GardenFieldErrors {
  const errors: GardenFieldErrors = {}
  if (requireName && values.ad.trim() === '') errors.ad = 'Bahçe adı boş olamaz. Kısa bir ad yazın, örn. “Dere kenarı”.'
  else if (values.ad.trim().length > GARDEN_LIMITS.nameMax) errors.ad = `Bahçe adı en fazla ${GARDEN_LIMITS.nameMax} karakter olabilir.`
  if (values.cesit.trim().length > GARDEN_LIMITS.varietyMax) errors.cesit = `Çeşit en fazla ${GARDEN_LIMITS.varietyMax} karakter olabilir.`

  const year = parseOptionalInt(values.dikimYili)
  const maxYear = thisYear + 1
  if (Number.isNaN(year) || (year !== null && (year < GARDEN_LIMITS.plantingYearMin || year > maxYear))) {
    errors.dikimYili = `Dikim yılı ${GARDEN_LIMITS.plantingYearMin} ile ${maxYear} arasında olmalı.`
  }
  const trees = parseOptionalInt(values.agacSayisi)
  if (Number.isNaN(trees) || (trees !== null && (trees < GARDEN_LIMITS.treesMin || trees > GARDEN_LIMITS.treesMax))) {
    errors.agacSayisi = `Ağaç sayısı ${GARDEN_LIMITS.treesMin} ile ${tr(GARDEN_LIMITS.treesMax)} arasında olmalı.`
  }
  return errors
}

/** Alan (dekar) ön denetimi: sunucuya gitmeden anlaşılır uyarı. */
export function areaProblem(dekar: number | null): string | null {
  if (dekar === null) return null
  if (dekar < GARDEN_LIMITS.minDekar) {
    return `Alan ${GARDEN_LIMITS.minDekar.toLocaleString('tr-TR')} dekardan küçük olamaz; çizdiğiniz alan ${dekar.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} dekar.`
  }
  return null
}
