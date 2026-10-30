export type JourneyStep = {
  tag: string
  title: string
  body: string
  question?: string
  answer?: string
}

export type JourneyCard = { title: string; rows: [string, string][] }

export const journeyMessages = {
  hero: {
    eyebrow: 'Narenciye bahçeleri için akıllı tarım sistemleri',
    titleLine1: 'Üretim verimini yükseltmek,',
    titleLine2: 'bitkiyi anlamaktan geçer.',
    subtitle:
      'BahçeLab, uydu görüntülerini ve hava verisini işler; bahçenizin canlılığını, su durumunu ve risklerini kendi geçmişine göre tek bir haritada gösterir.',
    cta: 'Kayıtlar çok yakında',
    secondary: 'Misyonumuz',
    scroll: 'Kaydırın',
    transition: [
      'Uydu bahçenizin üzerinden geçer.',
      'Bahçenizin her bölgesi ölçülür.',
      'Bahçeniz dijital haritaya dönüşür.',
    ],
  },
  features: {
    sampleNote: 'Görseller temsilidir ve örnek veri içerir.',
    steps: [
      {
        tag: 'Dijital Bahçe',
        title: 'Bahçenizin kendi haritası',
        body:
          'Bahçenizin sınırını çizersiniz; uydu görüntüleri 10 metrelik piksellerle işlenir. Sahada gördüklerinizi Saha Defteri’ne konumuyla yazarsınız.',
      },
      {
        tag: 'Bölge haritası',
        title: 'Yıllardır güçlü ve zayıf kalan kesimler',
        body:
          'Yılların uydu görüntüsünden bahçenizin güçlü, orta ve zayıf bölgeleri çıkarılır. Değişimler bahçenin kendi geçmişiyle karşılaştırılır.',
      },
      {
        tag: 'Erken uyarı',
        title: 'Değişimi erken görün',
        body:
          'Bulutlu günlerde radar, açık günlerde optik uydu bahçedeki ani değişimi izler. Sahada bakılması gereken yerler haritada işaretlenir; son söz sizindir.',
      },
      {
        tag: 'Geçmişe göre',
        title: 'Bu sezon normal mi?',
        body:
          'Bu yılın canlılık eğrisi, bahçenizin geçmiş yıllardaki normal bandıyla yan yana gösterilir. Gözlem ile tahmin ayrı çizilir.',
      },
      {
        tag: 'Su ve hava',
        title: 'Toprak nemi, su dengesi ve ilaçlama zamanı',
        body:
          'Uydu ve hava verisinden kök bölgesi nemi, günlük su dengesi, don ve ilaçlama penceresi hesaplanır. Değerler ön değerdir; karar her zaman üreticinindir.',
      },
      {
        tag: 'Asistan (yakında)',
        title: 'Bahçenize kendi dilinizde soru sorun',
        body:
          '“Bahçemin hangi kesimi zayıf?” gibi sorulara bahçenizin kendi verisine dayanan ve kaynağını gösteren yanıtlar. Şimdilik ⌘K ile komutlar çalışır.',
        question: 'Bahçemin hangi kesimi yıllardır zayıf?',
        answer: 'Güneydoğu kesim yıllardır güçlü, kuzey kesim zayıf. Sahada kuzeyi kontrol edin.',
      },
    ] satisfies JourneyStep[],
  },
  canvas: {
    moisture: 'Nem',
    legend: {
      trees: 'Ölçülen bölge',
      healthy: 'Sağlıklı',
      stress: 'Zayıf bölge',
      wet: 'Yeterli nem',
      low: 'Düşük nem',
      yield: 'Bölge payı',
    },
  },
  journey: {
    detected: 'bölge ölçüldü',
    cards: {
      twin: {
        title: 'Bahçe bölgesi',
        rows: [
          ['Bölge', 'Güçlü'],
          ['Alan', '5,0 da'],
          ['Pay', '%33'],
          ['Kaynak', 'Sentinel-2'],
        ],
      },
      detect: {
        title: 'Bölgeler ölçüldü',
        rows: [
          ['Çözünürlük', '10 m'],
          ['Yıl sayısı', '12'],
          ['Sınıf', 'Zayıf · Orta · Güçlü'],
        ],
      },
      health: {
        title: 'Zayıf kesim',
        rows: [
          ['Bahçeye göre', 'normalin altı'],
          ['İlk görülme', '6 gün önce'],
          ['Öneri', 'Sahada kontrol'],
        ],
      },
      yield: {
        title: 'Geçmişe göre',
        rows: [
          ['Bu sezon', 'normal bantta'],
          ['Karşılaştırma', 'önceki 10 sezon'],
          ['Kaynak', 'uydu + hava'],
        ],
      },
    } satisfies Record<string, JourneyCard>,
  },
}
