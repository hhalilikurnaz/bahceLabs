/**
 * Üstte yüzen arama kutusu ve uyarılar için "boş alan" sınırları. Sol/sağ sınırlar yerleşim değişkenlerinden gelir
 * (`--map-left`: menü + panel, `--top-right`: Copilot düğmesi/çekmecesi), böylece panel genişliği değişince alan uyum sağlar.
 */
export const TOP_AREA_CLASS =
  'surface-dark absolute left-[var(--map-left)] right-[var(--top-right)] z-20 flex justify-center transition-[left,right] duration-[var(--duration-panel)] ease-[var(--ease-out-soft)]'
