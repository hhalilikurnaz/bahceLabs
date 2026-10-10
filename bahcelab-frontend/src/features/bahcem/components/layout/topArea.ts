/**
 * Üstte yüzen arama kutusu ve uyarılar için "boş alan" sınırları.
 * Masaüstünde sol panel ve Copilot çekmecesi açıldıkça alan daralır; içerik bu alanda ortalanır.
 * (Panel: ikon şeridi 3.5rem + boşluk 0.75rem + panel 360px + boşluk 0.75rem = 27.5rem)
 */
export function topAreaClass(leftPanelOpen: boolean, copilotOpen: boolean): string {
  const left = leftPanelOpen ? 'md:left-[27.5rem]' : 'md:left-[4.25rem]'
  const right = copilotOpen ? 'md:right-[calc(380px+0.75rem)]' : 'md:right-[8.25rem]'
  return `surface-dark absolute left-[4.25rem] right-[8.25rem] z-20 flex justify-center transition-[left,right] duration-300 ease-out ${left} ${right}`
}
