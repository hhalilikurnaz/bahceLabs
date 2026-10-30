export interface ComingSoonItem {
  title: string
  /** "Adım 11" gibi */
  step: string
  text: string
}

export const JOURNAL_ITEMS: ComingSoonItem[] = [
  { title: 'Gözlemler', step: 'yakında', text: 'Sahada gördüklerinizi fotoğraf ve notla kaydedin.' },
  { title: 'Hasat', step: 'yakında', text: 'Hasat tarihi, miktarı ve kalitesi burada tutulacak.' },
  { title: 'İlaç defteri', step: 'yakında', text: 'Uygulanan ilaç, doz ve hasat bekleme süresi kaydı.' },
  { title: 'Maliyet & işçi/yevmiye', step: 'yakında', text: 'Gider, işçilik ve yevmiye kayıtları.' },
  { title: 'Kayıt dosyası – İTU / GlobalG.A.P.', step: 'yakında', text: 'Denetim için gerekli kayıtların dosyası.' },
]

export const REPORT_ITEMS: ComingSoonItem[] = [
  { title: 'Sezon raporu (PDF)', step: 'yakında', text: 'Sezonun uydu, hava ve kayıt özetini PDF olarak indirin.' },
  { title: 'Hasar raporu', step: 'yakında', text: 'Don veya dolu sonrası hasar belgesi.' },
  { title: 'Paylaşım bağlantısı', step: 'yakında', text: 'Raporu danışmanınızla bağlantı olarak paylaşın.' },
]

export const ANALYSIS_ITEMS: ComingSoonItem[] = [
  { title: 'Topografya & don', step: 'yakında', text: 'Eğim, yön ve soğuk hava birikim bölgeleri.' },
  { title: 'Toprak örneklemesi', step: 'yakında', text: 'Örnekleme noktaları ve analiz sonuçları.' },
  { title: 'Uygulama haritası & denemeler', step: 'yakında', text: 'Değişken doz haritası ve deneme alanları.' },
]

export const WEATHER_ITEMS: ComingSoonItem[] = [
  { title: 'Tuzak sayımı', step: 'yakında', text: 'Tuzaktaki sayıyı girince zararlı riski buna göre güncellenecek.' },
]

export const NOTIFICATION_ITEMS: ComingSoonItem[] = [
  { title: 'Destek ve son tarih takvimi', step: 'yakında', text: 'Başvuru ve ödeme tarihleri için hatırlatmalar.' },
]

export const SETTINGS_ITEMS: ComingSoonItem[] = [
  { title: 'Bildirim tercihleri ve telefon / WhatsApp onayı', step: 'yakında', text: 'Hangi uyarıların nereye gönderileceği.' },
]

export const COPILOT_ITEMS: ComingSoonItem[] = [
  { title: 'Fotoğrafla teşhis', step: 'yakında', text: 'Yaprak veya meyve fotoğrafından olası sorunları öğrenin.' },
]

export const STATUS_ITEMS: ComingSoonItem[] = [
  { title: 'Sulama önerisi ve zararlı/hastalık riski', step: 'yakında', text: 'Su ihtiyacı ve risk tahminleri Hava sekmesinde ve Bugün kartında görünecek.' },
]

const FAZ15 = 'yakında'

/** İşlerim: kullanıcı adına çalışan ajanlar (Faz 1.5 – Ajanlar ve Hizmetler, ADR 0010) */
export const JOBS_ITEMS: ComingSoonItem[] = [
  { title: 'Hibe ve destek', step: FAZ15, text: 'Size uygun destekleri bulur, başvuru dosyasını hazırlar.' },
  { title: 'Kalıntı ve ihracat uyumu', step: FAZ15, text: 'İlaç kayıtlarınızı ihracat kalıntı kurallarına göre denetler.' },
  { title: 'Sertifika', step: FAZ15, text: 'GlobalG.A.P. gibi sertifikalar için kayıt ve belge takibi.' },
  { title: 'Sigorta ve hasar', step: FAZ15, text: 'Hasar belgesi ve sigorta başvurusu hazırlığı.' },
  { title: 'Kredi dosyası', step: FAZ15, text: 'Banka başvurusu için bahçe ve üretim dosyası.' },
  { title: 'Satış', step: FAZ15, text: 'Ürününüzü satışa çıkarma ve alıcı eşleştirme.' },
  { title: 'Sürdürülebilirlik raporu', step: FAZ15, text: 'Su, ilaç ve gübre kullanımınızdan otomatik rapor.' },
]

/** Hizmetler: sahaya gelen ekipler, laboratuvar ve uzman (Faz 1.5) */
export const SERVICES_ITEMS: ComingSoonItem[] = [
  { title: 'Saha ekipleri', step: FAZ15, text: 'Drone ilaçlama ve gübreleme, budama, hasat ekibi, nakliye.' },
  { title: 'Laboratuvar', step: FAZ15, text: 'Toprak, yaprak, su ve kalıntı analizi.' },
  { title: 'Uzman', step: FAZ15, text: 'Ziraat mühendisi danışmanlığı.' },
]

export const MARKET_ITEMS: ComingSoonItem[] = [
  { title: 'Satış ve depo', step: 'yakında', text: 'Hasat sonrası ürününüzü kaydedip depo ve satış durumunu izleyin.' },
  { title: 'Girdi ve finansman', step: FAZ15, text: 'Gübre, ilaç ve fidan alımı; girdi finansmanı.' },
]
