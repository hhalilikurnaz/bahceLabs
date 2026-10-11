export interface ComingSoonItem {
  title: string
  /** "Adım 11" gibi */
  step: string
  text: string
}

export const JOURNAL_ITEMS: ComingSoonItem[] = [
  { title: 'Gözlemler', step: 'Adım 11', text: 'Sahada gördüklerinizi fotoğraf ve notla kaydedin.' },
  { title: 'Hasat', step: 'Adım 11', text: 'Hasat tarihi, miktarı ve kalitesi burada tutulacak.' },
  { title: 'İlaç defteri', step: 'Adım 12', text: 'Uygulanan ilaç, doz ve hasat bekleme süresi kaydı.' },
  { title: 'Maliyet & işçi/yevmiye', step: 'Adım 13', text: 'Gider, işçilik ve yevmiye kayıtları.' },
  { title: 'Kayıt dosyası – İTU / GlobalG.A.P.', step: 'Adım 13B', text: 'Denetim için gerekli kayıtların dosyası.' },
]

export const REPORT_ITEMS: ComingSoonItem[] = [
  { title: 'Sezon raporu (PDF)', step: 'Adım 16', text: 'Sezonun uydu, hava ve kayıt özetini PDF olarak indirin.' },
  { title: 'Hasar raporu', step: 'Adım 10/16', text: 'Don veya dolu sonrası hasar belgesi.' },
  { title: 'Paylaşım bağlantısı', step: 'Adım 16', text: 'Raporu danışmanınızla bağlantı olarak paylaşın.' },
]

export const ANALYSIS_ITEMS: ComingSoonItem[] = [
  { title: 'Topografya & don', step: 'Adım 10', text: 'Eğim, yön ve soğuk hava birikim bölgeleri.' },
  { title: 'Toprak örneklemesi', step: 'Adım 14', text: 'Örnekleme noktaları ve analiz sonuçları.' },
  { title: 'Uygulama haritası & denemeler', step: 'Adım 15', text: 'Değişken doz haritası ve deneme alanları.' },
]

export const WEATHER_ITEMS: ComingSoonItem[] = [
  { title: 'Tuzak sayımı', step: 'Adım 12', text: 'Tuzaktaki sayıyı girince zararlı riski buna göre güncellenecek.' },
]

export const NOTIFICATION_ITEMS: ComingSoonItem[] = [
  { title: 'Destek ve son tarih takvimi', step: 'Adım 18', text: 'Başvuru ve ödeme tarihleri için hatırlatmalar.' },
]

export const SETTINGS_ITEMS: ComingSoonItem[] = [
  { title: 'Bildirim tercihleri ve telefon / WhatsApp onayı', step: 'Adım 18–19', text: 'Hangi uyarıların nereye gönderileceği.' },
]

export const COPILOT_ITEMS: ComingSoonItem[] = [
  { title: 'Fotoğrafla teşhis', step: 'Adım 16', text: 'Yaprak veya meyve fotoğrafından olası sorunları öğrenin.' },
]

export const STATUS_ITEMS: ComingSoonItem[] = [
  { title: 'Sulama önerisi ve zararlı/hastalık riski', step: 'Adım 8B', text: 'Su ihtiyacı ve risk tahminleri Hava sekmesinde ve Bugün kartında görünecek.' },
]
