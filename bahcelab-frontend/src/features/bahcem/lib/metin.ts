/** Türkçe harfleri sadeleştirip küçültür: «Zayıf Bölge» → «zayif bolge» (arama karşılaştırması için). */
export function fold(text: string): string {
  return text
    .toLocaleLowerCase('tr-TR')
    .replace(/[ıİ]/g, 'i')
    .replace(/[öÖ]/g, 'o')
    .replace(/[üÜ]/g, 'u')
    .replace(/[şŞ]/g, 's')
    .replace(/[çÇ]/g, 'c')
    .replace(/[ğĞ]/g, 'g')
}
