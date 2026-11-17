/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PLANNING_API_MODE: 'mock' | 'real'
  readonly VITE_PLANNING_API_BASE_URL?: string
  readonly VITE_REGISTRATION_ENABLED?: string
  readonly VITE_MAPTILER_KEY?: string
  /** KVKK aydınlatma metni: veri sorumlusunun unvanı ve başvuru e-postası (boşsa metin sosyal kanalları gösterir) */
  /** 'false' dışındaki her değer: aydınlatma metni taslak, canlıda bekleme formu kapalı */
  readonly VITE_KVKK_TASLAK?: string
  readonly VITE_KVKK_VERI_SORUMLUSU?: string
  readonly VITE_KVKK_ILETISIM_EPOSTA?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
