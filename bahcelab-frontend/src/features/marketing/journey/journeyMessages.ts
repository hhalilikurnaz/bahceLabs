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
    eyebrow: 'Narenciye bahçeleri için yapay zekâ',
    title: 'Üretim verimini yükseltmek, bitkiyi anlamaktan geçer.',
    subtitle:
      'BahçeLab, drone ve uydu görüntülerini yapay zekâyla işler; her ağacın sağlığını, rekoltesini ve su ihtiyacını tek bir haritada gösterir.',
    cta: 'Kayıt ol',
    secondary: 'Misyonumuz',
    scroll: 'Kaydırın',
    transition: [
      'Drone bahçenin üzerinden geçer.',
      'Her ağaç tek tek tespit edilir.',
      'Bahçeniz dijital haritaya dönüşür.',
    ],
  },
  features: {
    sampleNote: 'Görseller temsilidir ve örnek veri içerir.',
    steps: [
      {
        tag: 'Dijital Bahçe',
        title: 'Her ağacın kalıcı bir kimliği var',
        body:
          'Bahçeniz parsel, blok ve ağaç düzeyinde haritalanır. Gözlem, ilaçlama, gübreleme ve sulama kayıtları ilgili ağaca ve konuma bağlanır.',
      },
      {
        tag: 'Ağaç tespiti',
        title: 'Drone görüntüsünden ağaç envanteri',
        body:
          'Multispektral drone görüntülerinden her ağacın konumu, taç büyüklüğü ve yüksekliği çıkarılır. Sonraki uçuşlarda aynı ağaç yeniden tanınır, değişim izlenir.',
      },
      {
        tag: 'Belirti tespiti',
        title: 'Sorunu bahçeye yayılmadan görün',
        body:
          'Yapay zekâ sararma, dal kuruması ve kuruma belirtisi gösteren ağaçları işaretler. Sahada kontrol edilmesi gereken ağaçlar konumlarıyla listelenir.',
      },
      {
        tag: 'Rekolte tahmini',
        title: 'Hasattan önce blok bazında tahmin',
        body:
          'Ağaç sayısı, taç ölçüleri ve bitki indeksleriyle her blok için rekolte tahmin edilir. Hasat ve satış planı erkenden yapılır.',
      },
      {
        tag: 'Akıllı sulama',
        title: 'Su, ihtiyacı olan bloğa',
        body:
          'Toprak nemi sensörleri ve blok bazlı vanalarla sulama sabit takvim yerine ölçülen ihtiyaca göre yapılır. Karar her zaman üreticinin onayıyla uygulanır.',
      },
      {
        tag: 'AI Copilot',
        title: 'Bahçenize kendi dilinizde soru sorun',
        body:
          '“Hangi blokta su stresi var?” gibi sorulara bahçenizin kendi verisine dayanan ve kaynağını gösteren yanıtlar alın.',
        question: 'Bu hafta hangi bloklara öncelik vermeliyim?',
        answer: "B3'te 6 ağaçta sararma belirtisi var ve toprak nemi düşük. Önce B3'ü kontrol edin.",
      },
    ] satisfies JourneyStep[],
  },
  canvas: {
    moisture: 'Nem',
    legend: {
      trees: 'Tespit edilen ağaç',
      healthy: 'Sağlıklı',
      stress: 'Sararma belirtisi',
      wet: 'Yeterli nem',
      low: 'Düşük nem',
      yield: 'Blok rekolte tahmini',
    },
  },
  journey: {
    detected: 'ağaç tespit edildi',
    cards: {
      twin: {
        title: 'Ağaç B3-S2-A05',
        rows: [
          ['Blok / Sıra', 'B3 / 2'],
          ['Tür', 'Limon'],
          ['Yaş', '15'],
          ['Son ilaçlama', '12 gün önce'],
          ['Son sulama', '2 gün önce'],
        ],
      },
      detect: {
        title: 'Ağaç tespit edildi',
        rows: [
          ['Taç çapı', '4,8 m'],
          ['Yükseklik', '3,6 m'],
          ['Taç hacmi', '31 m³'],
          ['Güven', '%97'],
        ],
      },
      health: {
        title: 'Sararma belirtisi',
        rows: [
          ['Etkilenen taç', '%38'],
          ['NDVI', '0,41 (blok ort. 0,72)'],
          ['İlk görülme', '6 gün önce'],
          ['Öneri', 'Sahada kontrol'],
        ],
      },
      yield: {
        title: 'Rekolte tahmini',
        rows: [
          ['Meyve sayısı', '~520'],
          ['Tahmini verim', '~110 kg'],
          ['B3 blok toplamı', '18,4 t'],
        ],
      },
    } satisfies Record<string, JourneyCard>,
  },
}
