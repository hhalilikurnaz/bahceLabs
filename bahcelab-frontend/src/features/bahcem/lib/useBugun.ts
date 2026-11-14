import { useGardens } from '../api/useGardens'
import { bugunBahce } from './dates'

/** Kimliği bilinen bahçenin yerel günü (bahçe listesi önbelleğinden saat dilimi; yoksa İstanbul). */
export function useBahceBugunu(gardenId: string | null | undefined): string {
  const { data } = useGardens()
  return bugunBahce(data?.find((g) => g.id === gardenId))
}
