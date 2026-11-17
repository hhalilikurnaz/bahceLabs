/** Kayıt formu bayrağı. Asıl kontrol sunucudadır (REGISTRATION_ENABLED); bu yalnızca arayüzü belirler.
 *  Kapalıyken /register erken erişim (bekleme listesi) formunu gösterir. */
export const REGISTRATION_ENABLED = import.meta.env.VITE_REGISTRATION_ENABLED === 'true'

/** KVKK aydınlatma metni «taslak — hukuki onay bekliyor» bayrağı. Varsayılan AÇIK; hukuki onaydan sonra `VITE_KVKK_TASLAK=false` (sunucuda `KVKK_TASLAK=false` ile birlikte). */
export const KVKK_TASLAK = import.meta.env.VITE_KVKK_TASLAK !== 'false'

/** Bekleme listesi formu görünür mü: bayrak açıkken CANLI derlemede (production) kapalı; geliştirme sunucusunda açık (yerel deneme). Sunucu aynı kuralı uygular. */
export function beklemeFormuAcik(taslak: boolean, canli: boolean): boolean {
  return !(taslak && canli)
}
export const BEKLEME_FORMU_ACIK = beklemeFormuAcik(KVKK_TASLAK, import.meta.env.PROD)

/** Şifre kuralı TEK yerde: forma (minLength), ipucuna ve sunucu doğrulamasına (domain/auth/schemas.py MIN_PASSWORD_LENGTH) aynı değer. */
export const MIN_PASSWORD_LENGTH = 8
