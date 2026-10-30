/**
 * Cam performansı: `backdrop-filter` WebGL harita üstünde her kare yeniden bulanıklaştırılır (ölçüm: katman değişimi medyanı ≈ 200 ms vs 73 ms,
 * sürüklemede 28 fps vs 89 fps). Bu yüzden harita HAREKET HALİNDEYKEN (sürükleme, yakınlaştırma, uçuş, katman değişimi) cam, bulanıklıksız
 * yarı saydam yedeğe düşer; durunca bulanıklık geri gelir (CSS: html[data-harita-hareket] .glass, styles/tokens.css).
 */
let zamanlayici: number | undefined
export function camSusun(ms = 350): void {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-harita-hareket', '')
  window.clearTimeout(zamanlayici)
  zamanlayici = window.setTimeout(() => document.documentElement.removeAttribute('data-harita-hareket'), ms)
}
