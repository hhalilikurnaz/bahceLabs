// Kaydırmalı hero: giriş + 3 durak. Koordinatlar hero fotoğrafına göre (journeySite.hero, 1672×941 piksel).
// Katmanlar yalnız anlatım içindir: kimlik, sayı ya da ölçüm değeri YOK (gerçek ekranlar sayfanın devamında).

export const IMG_W = 1672
export const IMG_H = 941
export const TREE_R = 70 // ortalama taç yarıçapı (piksel)

const ROWS: { y: number; xs: number[] }[] = [
  { y: 115, xs: [83, 253, 440, 615, 800, 960, 1120, 1300, 1472, 1633] },
  { y: 320, xs: [79, 261, 430, 623, 793, 987, 1175, 1350, 1530, 1662] },
  { y: 535, xs: [68, 242, 430, 615, 820, 1005, 1197, 1374, 1568] },
  { y: 760, xs: [52, 237, 432, 618, 824, 1038, 1245, 1427, 1609] },
]

export type Zone = 'ok' | 'mid' | 'weak'
export type Tree = { x: number; y: number; zone: Zone }

// Anlatım amaçlı bölge boyaması: bir «zayıf» yama ve çevresinde «orta» halka (gerçek ölçüm değil)
const PATCH = { x: 1005, y: 535 }
const zoneOf = (x: number, y: number): Zone => {
  const d = Math.hypot(x - PATCH.x, y - PATCH.y)
  return d < 260 ? 'weak' : d < 520 ? 'mid' : 'ok'
}

export const TREES: Tree[] = ROWS.flatMap((r) => r.xs.map((x) => ({ x, y: r.y, zone: zoneOf(x, r.y) })))
export const ROW_Y = ROWS.map((r) => r.y)

/* ---------------- kamera ---------------- */

// x,y: fotoğraftaki hedef nokta (0..1). z: yakınlık (1 = ekranı kaplar). ax,ay: hedef noktanın ekranda duracağı yer (0..1).
export type Cam = { x: number; y: number; z: number; ax: number; ay: number }
const cam = (x: number, y: number, z: number, ax = 0.5, ay = 0.5): Cam => ({ x, y, z, ax, ay })

// Mobilde hedef ekranın üst yarısında; alt yarı metne kalır
export const mobileCam = (c: Cam): Cam => ({ ...c, z: Math.max(1, c.z * 0.8), ax: 0.5, ay: 0.34 })

/* ---------------- zaman çizelgesi ---------------- */

export type Layers = { rings: number; zones: number; water: number; grade: number }
const L = (o: Partial<Layers> = {}): Layers => ({ rings: 0, zones: 0, water: 0, grade: 0, ...o })

export type Stop = { key: 'map' | 'zones' | 'water'; len: number; cam: Cam; layers: Layers }

export const STOPS: Stop[] = [
  { key: 'map', len: 1, cam: cam(0.5, 0.5, 1.05, 0.62, 0.5), layers: L({ rings: 1, grade: 0.55 }) },
  { key: 'zones', len: 1, cam: cam(0.6, 0.55, 1.25, 0.64, 0.5), layers: L({ rings: 0.2, zones: 1, grade: 0.3 }) },
  { key: 'water', len: 1, cam: cam(0.5, 0.5, 1.15, 0.62, 0.5), layers: L({ zones: 0.2, water: 1, grade: 0.3 }) },
]

export const INTRO_LEN = 0.7 // giriş: tarama çizgisi bahçeden geçer
export const TOTAL_LEN = INTRO_LEN + STOPS.reduce((s, x) => s + x.len, 0)

const MOVE = 0.4 // her durağın ilk %40'ı kamera hareketi, kalanı bekleme
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const smooth = (t: number) => t * t * (3 - 2 * t)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const lerpCam = (a: Cam, b: Cam, t: number): Cam => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t), ax: lerp(a.ax, b.ax, t), ay: lerp(a.ay, b.ay, t) })
const lerpLayers = (a: Layers, b: Layers, t: number): Layers => ({
  rings: lerp(a.rings, b.rings, t),
  zones: lerp(a.zones, b.zones, t),
  water: lerp(a.water, b.water, t),
  grade: lerp(a.grade, b.grade, t),
})

export type Frame = {
  scan: number // tarama çizgisi konumu 0..1 (0 = başlamadı, 1 = bitti)
  cam: Cam
  layers: Layers
  stop: number // aktif durak (-1 = giriş)
  stepIn: number // aktif metin adımının görünürlüğü 0..1
  intro: number // giriş metninin görünürlüğü 0..1
}

/** s: hero bölümünde kaydırılan mesafe (ekran yüksekliği cinsinden) */
export function frameAt(s: number): Frame {
  const first = STOPS[0]
  const intro = 1 - clamp01(s / 0.45)

  if (s < INTRO_LEN) {
    const scan = clamp01((s - 0.05) / (INTRO_LEN - 0.1))
    const c = { ...first.cam, z: lerp(1, first.cam.z, smooth(clamp01(s / INTRO_LEN))), ax: lerp(0.5, first.cam.ax, smooth(clamp01(s / INTRO_LEN))) }
    return { scan, cam: c, layers: L({ rings: 1, grade: Math.max(0.35, scan * 0.55) }), stop: -1, stepIn: 0, intro }
  }

  let a = INTRO_LEN
  for (let i = 0; i < STOPS.length; i++) {
    const st = STOPS[i]
    const b = a + st.len
    if (s < b || i === STOPS.length - 1) {
      const prev = STOPS[Math.max(0, i - 1)]
      const u = clamp01((s - a) / st.len)
      const m = i === 0 ? 1 : smooth(clamp01(u / MOVE))
      const out = i === STOPS.length - 1 ? 1 : 1 - clamp01((u - 0.88) / 0.1)
      const inn = clamp01((u - MOVE * 0.4) / (MOVE * 0.5))
      return { scan: 1, cam: lerpCam(prev.cam, st.cam, m), layers: lerpLayers(prev.layers, st.layers, m), stop: i, stepIn: inn * out, intro: 0 }
    }
    a = b
  }
  throw new Error('unreachable')
}

/** Kamerayı ekran dönüşümüne çevirir: fotoğraf her zaman ekranı kaplar. Döner: ölçek (fotoğraf pikseli → ekran pikseli) ve öteleme. */
export function camTransform(c: Cam, W: number, H: number) {
  const cover = Math.max(W / IMG_W, H / IMG_H)
  const k = cover * Math.max(1, c.z)
  let tx = c.ax * W - c.x * IMG_W * k
  let ty = c.ay * H - c.y * IMG_H * k
  tx = Math.min(0, Math.max(W - IMG_W * k, tx))
  ty = Math.min(0, Math.max(H - IMG_H * k, ty))
  return { k, tx, ty }
}
