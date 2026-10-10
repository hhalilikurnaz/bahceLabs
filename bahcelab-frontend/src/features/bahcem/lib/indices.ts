/**
 * Sentinel-2 indeks tanımları, renk skalaları ve renk yardımcıları.
 * Backend `domain/ndvi/indices.py` ile aynı değerler kullanılır (burası aynasıdır).
 */

export const INDEX_IDS = ['ndvi', 'msavi', 'ndre', 'ndmi', 'cigreen'] as const
export type IndexId = (typeof INDEX_IDS)[number]
export const TRUE_COLOR = 'gercek-renk' as const
export type LayerId = IndexId | typeof TRUE_COLOR

export type ColormapId = 'rdylgn' | 'mavi' | 'yesil' | 'fark'
export type Rgb = [number, number, number]
export type Stops = [number, Rgb][]

export const COLORMAPS: Record<ColormapId, Stops> = {
  // NDVI için 0,0–0,9: eski sürümle birebir aynı duraklar
  rdylgn: [
    [0.0, [215, 48, 39]],
    [0.3 / 0.9, [252, 141, 89]],
    [0.5 / 0.9, [254, 224, 139]],
    [0.7 / 0.9, [145, 207, 96]],
    [1.0, [26, 152, 80]],
  ],
  mavi: [
    [0.0, [247, 251, 255]],
    [0.25, [198, 219, 239]],
    [0.5, [107, 174, 214]],
    [0.75, [33, 113, 181]],
    [1.0, [8, 48, 107]],
  ],
  yesil: [
    [0.0, [255, 255, 204]],
    [0.35, [194, 230, 153]],
    [0.7, [49, 163, 84]],
    [1.0, [0, 90, 50]],
  ],
  // değişim haritası: kırmızı = düşüş, beyaz = değişmedi, yeşil = artış
  fark: [
    [0.0, [215, 48, 39]],
    [0.35, [252, 174, 145]],
    [0.5, [245, 245, 245]],
    [0.65, [166, 217, 106]],
    [1.0, [26, 152, 80]],
  ],
}

export interface IndexDef {
  id: IndexId
  ad: string
  kisa: string
  aciklama: string
  min: number
  max: number
  renk: ColormapId
  /** Değişim haritası ±aralık */
  farkAraligi: number
  /** Grafikte çizgi rengi (veri görselleştirme sabiti) */
  cizgi: string
}

export const INDEX_DEFS: Record<IndexId, IndexDef> = {
  ndvi: {
    id: 'ndvi',
    ad: 'NDVI',
    kisa: 'Genel canlılık / biyokütle',
    aciklama:
      'Bitkinin yeşil yaprak yoğunluğunu gösterir. Yüksek değer sağlıklı ve yoğun yaprak örtüsü, düşük değer zayıf bitki, çıplak toprak veya stres demektir.',
    min: 0,
    max: 0.9,
    renk: 'rdylgn',
    farkAraligi: 0.25,
    cizgi: '#7cc65a',
  },
  msavi: {
    id: 'msavi',
    ad: 'MSAVI',
    kisa: 'Toprak etkisi düzeltilmiş canlılık',
    aciklama:
      "NDVI'nin toprak parlaklığına duyarlılığını azaltır. Sıra arası çıplak toprak olan ya da genç bahçelerde bitki örtüsünü NDVI'dan daha güvenilir gösterir.",
    min: 0,
    max: 0.8,
    renk: 'rdylgn',
    farkAraligi: 0.2,
    cizgi: '#2dd4bf',
  },
  ndre: {
    id: 'ndre',
    ad: 'NDRE',
    kisa: 'Klorofil / azot durumu',
    aciklama:
      "Kırmızı kenar bandını kullanır; yaprak klorofil içeriğine ve azot durumuna duyarlıdır. Sararmayı NDVI'dan önce yakalayabilir.",
    min: 0,
    max: 0.6,
    renk: 'rdylgn',
    farkAraligi: 0.15,
    cizgi: '#fbbf24',
  },
  ndmi: {
    id: 'ndmi',
    ad: 'NDMI',
    kisa: 'Yaprak su içeriği / su stresi',
    aciklama:
      'Yakın kızılötesi ve kısa dalga kızılötesi (SWIR) farkıyla yaprağın su içeriğini gösterir. Koyu mavi nemli, açık ton kuru yaprak demektir; düşüşler su stresini işaret edebilir.',
    min: -0.2,
    max: 0.6,
    renk: 'mavi',
    farkAraligi: 0.15,
    cizgi: '#60a5fa',
  },
  cigreen: {
    id: 'cigreen',
    ad: 'CIgreen',
    kisa: 'Klorofil yoğunluğu',
    aciklama:
      'Yeşil banda göre yakın kızılötesi oranıdır; yaprak klorofil yoğunluğuyla doğrusala yakın ilişkilidir ve yoğun yaprak örtüsünde doymaz.',
    min: 0,
    max: 3,
    renk: 'yesil',
    farkAraligi: 1,
    cizgi: '#c084fc',
  },
}

export const TRUE_COLOR_LABEL = {
  ad: 'Gerçek renk',
  kisa: 'Uydudan gerçek görünüm',
  aciklama:
    'Kırmızı, yeşil ve mavi bantlardan (B04, B03, B02) oluşan, skalasız doğal renkli görüntü: bahçenin o tarihte uydudan gerçek hâli.',
}

export const LAYER_OPTIONS: { id: LayerId; ad: string; kisa: string }[] = [
  ...INDEX_IDS.map((id) => ({ id, ad: INDEX_DEFS[id].ad, kisa: INDEX_DEFS[id].kisa })),
  { id: TRUE_COLOR, ad: TRUE_COLOR_LABEL.ad, kisa: TRUE_COLOR_LABEL.kisa },
]

export const isIndexId = (value: string): value is IndexId => (INDEX_IDS as readonly string[]).includes(value)

export function layerName(id: LayerId): string {
  return id === TRUE_COLOR ? TRUE_COLOR_LABEL.ad : INDEX_DEFS[id].ad
}

/** Konum t∈[0,1] için renk skalasından doğrusal karışım */
export function colorAt(stops: Stops, t: number): Rgb {
  const v = Math.min(1, Math.max(0, t))
  for (let i = 1; i < stops.length; i++) {
    const [x1, c1] = stops[i]
    if (v <= x1) {
      const [x0, c0] = stops[i - 1]
      const f = x1 === x0 ? 0 : (v - x0) / (x1 - x0)
      return [0, 1, 2].map((k) => Math.round(c0[k] + (c1[k] - c0[k]) * f)) as Rgb
    }
  }
  return stops[stops.length - 1][1]
}

export function indexRgb(id: IndexId, value: number): Rgb {
  const def = INDEX_DEFS[id]
  return colorAt(COLORMAPS[def.renk], (value - def.min) / (def.max - def.min))
}

export function indexColor(id: IndexId, value: number): string {
  const [r, g, b] = indexRgb(id, value)
  return `rgb(${r} ${g} ${b})`
}

/** Renk skalası için CSS gradyanı (lejant çubuğu) */
export function gradientCss(colormap: ColormapId): string {
  const stops = COLORMAPS[colormap].map(([x, [r, g, b]]) => `rgb(${r} ${g} ${b}) ${(x * 100).toFixed(1)}%`)
  return `linear-gradient(to right, ${stops.join(', ')})`
}

/** Değer biçimi: CIgreen 1 ondalık, diğerleri 2 */
export function formatIndexValue(id: IndexId, value: number | null | undefined): string {
  if (value == null) return '—'
  const digits = id === 'cigreen' ? 2 : 2
  return value.toLocaleString('tr-TR', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

/** Rozet etiketi (güçlü/orta/zayıf) yalnızca bitki canlılığı indeksleri için anlamlıdır */
export function vigorLabel(id: IndexId, value: number): string {
  const def = INDEX_DEFS[id]
  const t = (value - def.min) / (def.max - def.min)
  return t >= 0.62 ? 'Güçlü' : t >= 0.42 ? 'Orta' : 'Zayıf'
}

export type YieldClassId = 'dusuk' | 'orta' | 'yuksek'

/** Verimlilik bölgesi renkleri (düşük → yüksek): kırmızı, sarı, yeşil */
export const YIELD_COLORS: Record<YieldClassId, string> = {
  dusuk: '#d73027',
  orta: '#fee08b',
  yuksek: '#1a9850',
}
