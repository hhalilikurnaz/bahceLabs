/** Arayüz sabitleri tek yerde (sihirli sayı yok). Sunucu tarafı eşikleri backend `config.py`'dadır. */

export const LAYOUT = {
  /** Sol menü (ikon şeridi) genişliği, px */
  railPx: 56,
  /** Harita üstü yüzen öğeler ile kenarlar arası boşluk, px */
  gapPx: 12,
  /** Bahçe listesi paneli, px */
  listPanelPx: 360,
  /** Sağ bahçe paneli: varsayılan genişlik (görünüm oranı) ve sürükleyerek ayarlanabilir sınırlar, px */
  detailPanelRatio: 0.4,
  detailPanelMinPx: 440,
  detailPanelMaxPx: 920,
  /** Dar masaüstü ekranda sağ panelin inebileceği en küçük genişlik (harita payı korunur), px */
  detailPanelFloorPx: 360,
  /** Klavyeyle (← →) yeniden boyutlandırma adımı, px */
  detailResizeStepPx: 24,
  /** Sağ panel açıkken haritaya bırakılacak en az genişlik, px */
  mapMinPx: 320,
  /** Copilot çekmecesi genişliği, px */
  copilotPx: 380,
  /** Üstteki Copilot düğmesinin kapladığı yatay alan (düğme + boşluk), px */
  copilotButtonPx: 124,
  /** Bu genişliğin altı "dar ekran" (mobil) sayılır, px */
  desktopMinPx: 768,
} as const

export const MAP = {
  /** Bahçe etiketleri bu yakınlaştırmanın altında gizlenir */
  labelMinZoom: 11,
  /** Seçili bahçeye odaklanırken en fazla yakınlaşma */
  focusMaxZoom: 18,
  /** Spotlight: bahçe dışı karartma opaklığı */
  spotlightOpacity: 0.55,
} as const

/** Odaklanırken harita kenarlarında bırakılan boşluk, px */
export const FOCUS_PAD = { top: 90, bottom: 70, side: 24 } as const

export const LIST = {
  /** Bahçe kartı küçük resim kenarı, px */
  thumbPx: 56,
  /** Sparkline boyutu, px */
  sparkWidthPx: 72,
  sparkHeightPx: 28,
  /** Arama, durum filtresi ve sıralama yalnızca bu kadar ya da daha çok bahçe varsa gösterilir */
  controlsMinGardens: 5,
} as const

export const TREND = {
  /** "Son X güne göre değişim" için karşılaştırma aralığı ve en yakın görüntü toleransı, gün */
  compareDays: 14,
  toleranceDays: 7,
  /** Değişim, bu yüzdenin altındaysa "değişmedi" sayılır */
  flatPercent: 2,
} as const
