export type JourneyStep = { tag: string; title: string; body: string }

/** Hero metinleri. Sayı, kurum ya da örnek değer yok; adımlar ürünün gerçek davranışını anlatır. */
export const journeyMessages = {
  hero: {
    eyebrow: 'Narenciye bahçeleri için akıllı tarım sistemleri',
    titleLine1: 'Üretim verimini yükseltmek,',
    titleLine2: 'bitkiyi anlamaktan geçer.',
    subtitle:
      'BahçeLab, uydu görüntülerini ve hava verisini işler; bahçenizin canlılığını, su durumunu ve risklerini kendi geçmişine göre tek bir haritada gösterir.',
    cta: 'Erken erişime katıl',
    secondary: 'Nasıl çalışır',
    scroll: 'Kaydırın',
  },
  steps: [
    {
      tag: 'Dijital bahçe',
      title: 'Bahçenizin kendi haritası',
      body: 'Bahçenizin sınırını çizersiniz; uydu görüntüleri 10 metrelik piksellerle işlenir. Sahada gördüklerinizi Saha Defteri’ne konumuyla yazarsınız.',
    },
    {
      tag: 'Bölge haritası',
      title: 'Yıllardır güçlü ve zayıf kalan kesimler',
      body: 'Yılların uydu görüntüsünden bahçenizin güçlü, orta ve zayıf bölgeleri çıkarılır. Değişimler bahçenin kendi geçmişiyle karşılaştırılır.',
    },
    {
      tag: 'Su ve hava',
      title: 'Toprak nemi ve su dengesi',
      body: 'Uydu ve hava verisinden kök bölgesi nemi, günlük su dengesi ve ilaçlama penceresi hesaplanır. Değerler ön değerdir; karar her zaman üreticinindir.',
    },
  ] satisfies JourneyStep[],
  legend: { ok: 'Güçlü', mid: 'Orta', weak: 'Zayıf' },
  note: 'Bu sahne anlatım içindir.',
}
