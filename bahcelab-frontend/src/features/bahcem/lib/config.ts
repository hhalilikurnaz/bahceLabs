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
  desktopMinPx: 1180,
} as const

/** Mobil alt sayfa yükseklikleri: kapalı (yalnız başlık), yarım, tam */
export const SHEET = {
  peekPx: 108,
  halfRatio: 0.5,
  /** Tam açıkken üstte bırakılan boşluk, px */
  fullTopGapPx: 56,
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
export const FOCUS_PAD = {
  top: 90,
  bottom: 70,
  side: 24,
  /** Seçili bahçeye odaklanırken alt boşluk: araç çubuğu, lejant ve kapsül görüntünün üstünü kapatmasın */
  bottomSelected: 300,
} as const

export const LIST = {
  /** Bahçe kartı küçük resim kenarı, px */
  thumbPx: 56,
  /** Sparkline boyutu, px */
  sparkWidthPx: 72,
  sparkHeightPx: 28,
  /** Arama, durum filtresi ve sıralama yalnızca bu kadar ya da daha çok bahçe varsa gösterilir */
  controlsMinGardens: 5,
} as const

export const RASTER = {
  /** "Bahçenin kendi farkları" görünümünde p2–p98 yayılımı, parametre aralığının bu payından azsa bahçe homojen sayılır */
  homogeneityRangeShare: 0.06,
  /** Kendi farkları görünümünde renk aralığını belirleyen yüzdelikler */
  stretchLowPercentile: 2,
  stretchHighPercentile: 98,
  /** Harita üzerindeki indeks katmanının opaklığı */
  opacity: 0.94,
} as const

export const ZONES = {
  /** Sınıf ortalamaları arasındaki fark, parametre aralığının bu payından azsa bahçe homojen sayılır */
  homogeneityRangeShare: 0.05,
  /** Bölgenin bahçe ortalamasından bu yüzdeden fazla sapması "yerinde kontrol edin" önerisini açar */
  actionableDiffPercent: 8,
  /** Bölge sınırlarını yumuşatan Chaikin tur sayısı (0 = ham sınır) */
  smoothingIterations: 2,
  /** Bölgelerin harita dolgu opaklığı (saydam: altındaki görüntü görünür) */
  fillOpacity: 0.28,
  outlineWidthPx: 2.5,
} as const

export const ARCHIVE = {
  /** Karşılaştırma kaydırıcısının başlangıç konumu (0–1) */
  compareStart: 0.5,
  /** Zaman atlaması kare süresi, ms */
  timelapseFrameMs: 700,
  /** Seçili görüntüye en yakın kaç komşu önceden yüklenir */
  preloadNeighbors: 2,
  /** Sağ taraftaki küçük resim ızgarası sayfa boyutu */
  pageSize: 100,
  /** Küçük resim ızgarasında bir görüntünün kenarı, px */
  thumbPx: 88,
} as const

export const CHART = {
  /** Grafik yazı boyutu, px (gerçek piksel; ölçeklenmez) */
  fontPx: 12,
  heightPx: 240,
  compactHeightPx: 96,
  margin: { left: 48, right: 14, top: 14, bottom: 30 },
  /** İkinci parametre (sağ eksen) açıkken sağ kenar boşluğu, px */
  marginRightCompare: 52,
  /** Hava grafiği (yağış çubukları + sıcaklık çizgisi) yüksekliği ve yağış ekseninin üst sınırı */
  weatherChartHeightPx: 170,
  marginCompact: { left: 48, right: 14, top: 8, bottom: 22 },
  /** Y ekseni: değer aralığına eklenen dolgu payı, en küçük açıklık (parametre aralığının payı) ve çentik sayısı */
  yPaddingShare: 0.15,
  minSpanShare: 0.08,
  yTicks: 4,
  /** Bir ay etiketinin kapladığı yaklaşık genişlik, px */
  monthLabelPx: 34,
  /** İmleç, bu kadar gün içindeki en yakın görüntüyü yakalar */
  hoverGapDays: 8,
  tooltipWidthPx: 220,
  /** Yağış ekseninin en küçük üst sınırı, mm */
  rainMinAxisMm: 10,
} as const

/** Bahçe alanı sınırları (sunucudaki `schemas.py` ile aynı olmalı) */
export const GARDEN_LIMITS = {
  nameMax: 120,
  varietyMax: 100,
  plantingYearMin: 1900,
  treesMin: 1,
  treesMax: 1_000_000,
  minDekar: 0.5,
} as const

export const DRAW = {
  /** Çizimde köşe tutamacı çapı, px: iğne ucu (fare) ve dokunmatik (büyük) */
  handlePx: 10,
  handleCoarsePx: 16,
  /** Başka bahçelerin köşelerine yapışma mesafesi, px */
  snapPx: 14,
  /** Daire çizimi düzenlenebilir çokgene çevrilirken en fazla köşe sayısı */
  circleMaxVertices: 24,
  /** Bu yakınlaştırma düzeyinin altında çizim başlatılamaz (köşeler yeterince hassas olsun) */
  minZoom: 14,
} as const

export const TREND = {
  /** "Son X güne göre değişim" için karşılaştırma aralığı ve en yakın görüntü toleransı, gün */
  compareDays: 14,
  toleranceDays: 7,
  /** Değişim, bu yüzdenin altındaysa "değişmedi" sayılır */
  flatPercent: 2,
} as const
