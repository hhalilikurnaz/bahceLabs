/**
 * Sulama haritası geometrisi (saf fonksiyonlar, bağımlılıksız). Küçük alanda (bahçe < birkaç km) boylam/enlem, merkez çevresinde
 * eşdikdörtgen (equirectangular) düzleme alınır; hata bahçe ölçeğinde cm mertebesindedir. Açılar KUZEYDEN SAAT YÖNÜNDE derece (harita bearing'i gibi).
 */
export type LngLat = [number, number]
export type Xy = [number, number]
export type Halka = LngLat[]

const R = 6_371_008.8
const RAD = Math.PI / 180

export interface Duzlem {
  /** boylam/enlem → metre (x doğu, y kuzey) */
  ileri(p: LngLat): Xy
  /** metre → boylam/enlem */
  geri(p: Xy): LngLat
}
export function duzlem(merkez: LngLat): Duzlem {
  const kx = R * Math.cos(merkez[1] * RAD) * RAD
  const ky = R * RAD
  return {
    ileri: (p) => [(p[0] - merkez[0]) * kx, (p[1] - merkez[1]) * ky],
    geri: (p) => [merkez[0] + p[0] / kx, merkez[1] + p[1] / ky],
  }
}

/** Kapalı halkadaki tekrarlı son noktayı atar. */
export function acikHalka(h: readonly LngLat[]): LngLat[] {
  const a = h.slice()
  const f = a[0]
  const l = a[a.length - 1]
  if (a.length > 1 && f && l && f[0] === l[0] && f[1] === l[1]) a.pop()
  return a
}
export function halkaMerkezi(h: readonly LngLat[]): LngLat {
  const a = acikHalka(h)
  const n = Math.max(1, a.length)
  return [a.reduce((s, p) => s + p[0], 0) / n, a.reduce((s, p) => s + p[1], 0) / n]
}
export function alanM2(xy: readonly Xy[]): number {
  let s = 0
  for (let i = 0; i < xy.length; i++) {
    const a = xy[i]!
    const b = xy[(i + 1) % xy.length]!
    s += a[0] * b[1] - b[0] * a[1]
  }
  return Math.abs(s) / 2
}
export function noktaIcinde(p: Xy, xy: readonly Xy[]): boolean {
  let ic = false
  for (let i = 0, j = xy.length - 1; i < xy.length; j = i++) {
    const a = xy[i]!
    const b = xy[j]!
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) ic = !ic
  }
  return ic
}

/** Kuzeyden saat yönünde açı (0–360) → birim vektör (doğu, kuzey). */
export function yonVektoru(derece: number): Xy {
  const r = derece * RAD
  return [Math.sin(r), Math.cos(r)]
}
export function yonDerece(dx: number, dy: number): number {
  return (((Math.atan2(dx, dy) / RAD) % 360) + 360) % 360
}
/** Çizginin yönünü 0–180 aralığına katlar (yön işaretsiz). */
export function katla180(d: number): number {
  return ((d % 180) + 180) % 180
}

/**
 * Parselin UZUN EKSENİ: en küçük alanlı dönük dikdörtgenin uzun kenarının yönü (0–180, kuzeyden saat yönünde).
 * Her kenar yönü denenir; kenarlara paralel/dik izdüşümlerle alan hesaplanır.
 */
export function uzunEksenYonu(xy: readonly Xy[]): number {
  let en = Infinity
  let yon = 0
  for (let i = 0; i < xy.length; i++) {
    const a = xy[i]!
    const b = xy[(i + 1) % xy.length]!
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const L = Math.hypot(dx, dy)
    if (L < 1e-9) continue
    const ux = dx / L
    const uy = dy / L
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity
    for (const p of xy) {
      const u = p[0] * ux + p[1] * uy
      const v = -p[0] * uy + p[1] * ux
      if (u < u0) u0 = u
      if (u > u1) u1 = u
      if (v < v0) v0 = v
      if (v > v1) v1 = v
    }
    const w = u1 - u0
    const h = v1 - v0
    if (w * h < en) {
      en = w * h
      yon = w >= h ? yonDerece(ux, uy) : yonDerece(-uy, ux)
    }
  }
  return katla180(yon)
}

/** Bir doğrunun (p + t·d) poligonla kesiştiği [t0,t1] aralıkları (çift-tek kuralı). */
function dogruAraliklari(p: Xy, d: Xy, xy: readonly Xy[]): [number, number][] {
  const ts: number[] = []
  for (let i = 0; i < xy.length; i++) {
    const a = xy[i]!
    const b = xy[(i + 1) % xy.length]!
    const ex = b[0] - a[0]
    const ey = b[1] - a[1]
    const den = d[0] * ey - d[1] * ex
    if (Math.abs(den) < 1e-12) continue
    const t = ((a[0] - p[0]) * ey - (a[1] - p[1]) * ex) / den
    const s = ((a[0] - p[0]) * d[1] - (a[1] - p[1]) * d[0]) / den
    if (s >= 0 && s < 1) ts.push(t)
  }
  ts.sort((x, y) => x - y)
  const out: [number, number][] = []
  for (let i = 0; i + 1 < ts.length; i += 2) out.push([ts[i]!, ts[i + 1]!])
  return out
}

export interface SiraSonucu {
  /** sıra çizgileri (metre düzleminde) */
  siralar: [Xy, Xy][]
  /** ağaç konumları */
  agaclar: Xy[]
  /** kesildi mi (üst sınıra ulaşıldı) */
  kesildi: boolean
}
/**
 * Ağaç sıraları: yön `derece` (sıranın uzandığı yön), sıralar arası `siraAralik`, sıra üstünde `agacAralik` m.
 * Dikim aralığı verisi YOKSA çağıran çizmez (uydurma yok). `sinir` ağaç sayısı üst sınırı (render koruması).
 */
export function siraUret(xy: readonly Xy[], derece: number, siraAralik: number, agacAralik: number, sinir = 30_000): SiraSonucu {
  const d = yonVektoru(derece)
  const n: Xy = [-d[1], d[0]] // sıralara dik
  let v0 = Infinity, v1 = -Infinity
  for (const p of xy) {
    const v = p[0] * n[0] + p[1] * n[1]
    if (v < v0) v0 = v
    if (v > v1) v1 = v
  }
  const siralar: [Xy, Xy][] = []
  const agaclar: Xy[] = []
  let kesildi = false
  // ilk sıra kenardan yarım aralık içeride; dönük çerçeve içinde ızgara hizalı
  for (let v = v0 + siraAralik / 2; v < v1 && !kesildi; v += siraAralik) {
    const p: Xy = [n[0] * v, n[1] * v]
    for (const [t0, t1] of dogruAraliklari(p, d, xy)) {
      siralar.push([[p[0] + d[0] * t0, p[1] + d[1] * t0], [p[0] + d[0] * t1, p[1] + d[1] * t1]])
      for (let t = t0 + agacAralik / 2; t < t1; t += agacAralik) {
        if (agaclar.length >= sinir) { kesildi = true; break }
        agaclar.push([p[0] + d[0] * t, p[1] + d[1] * t])
      }
      if (kesildi) break
    }
  }
  return { siralar, agaclar, kesildi }
}

/**
 * Basit (kendini kesmeyen) poligonu bir DOĞRUYLA (iki nokta, sonsuza uzatılmış) parçalara böler; içbükey parselde de doğrudur.
 * Doğrunun sınırla kesişimleri doğru boyunca sıralanır, ardışık ikililer çokgenin İÇİNDEKİ kirişlerdir (çift-tek kuralı);
 * her kiriş, onu içeren halkayı ikiye ayırır. Doğru üstündeki köşeler «+» tarafta sayılır (dejenerelik yok).
 */
export function dogruylaBol(xy: readonly Xy[], a: Xy, b: Xy): Xy[][] {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const L = Math.hypot(dx, dy) || 1
  const EPS = 1e-9
  const yan = (p: Xy) => {
    const v = (dx * (p[1] - a[1]) - dy * (p[0] - a[0])) / L
    return Math.abs(v) < EPS ? EPS : v
  }
  const halka: Xy[] = []
  const kes: { p: Xy; u: number }[] = []
  for (let i = 0; i < xy.length; i++) {
    const p = xy[i]!
    const q = xy[(i + 1) % xy.length]!
    const sp = yan(p)
    const sq = yan(q)
    halka.push(p)
    if (sp > 0 !== sq > 0) {
      const t = sp / (sp - sq)
      const ip: Xy = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]
      halka.push(ip)
      kes.push({ p: ip, u: ((ip[0] - a[0]) * dx + (ip[1] - a[1]) * dy) / L })
    }
  }
  kes.sort((x, y) => x.u - y.u)
  let parcalar: Xy[][] = [halka]
  for (let k = 0; k + 1 < kes.length; k += 2) {
    const c1 = kes[k]!.p
    const c2 = kes[k + 1]!.p
    const j = parcalar.findIndex((h) => h.includes(c1) && h.includes(c2))
    if (j < 0) continue
    const h = parcalar[j]!
    const i1 = h.indexOf(c1)
    const i2 = h.indexOf(c2)
    const yol = (bas: number, son: number): Xy[] => {
      const out: Xy[] = []
      for (let i = bas; ; i = (i + 1) % h.length) {
        out.push(h[i]!)
        if (i === son) break
      }
      return out
    }
    parcalar = [...parcalar.slice(0, j), yol(i1, i2), yol(i2, i1), ...parcalar.slice(j + 1)]
  }
  return parcalar
}
/** Parseli sıralı kesme doğrularıyla vanalara böler; ≤ 2 köşeli parçalar atılır. */
export function parcaliBol(xy: Xy[], kesimler: readonly [Xy, Xy][]): Xy[][] {
  let parcalar: Xy[][] = [xy]
  for (const [a, b] of kesimler) {
    const yeni: Xy[][] = []
    for (const p of parcalar) {
      const bol = dogruylaBol(p, a, b).filter((q) => q.length >= 3 && alanM2(q) > 1)
      if (bol.length >= 2) yeni.push(...bol)
      else yeni.push(p)
    }
    parcalar = yeni
  }
  return parcalar
}
/** En yakın nokta uzaklığı (metre) — pompa/boru bahçeden uzak mı denetimi için. */
export function noktaPolygonUzakligi(p: Xy, xy: readonly Xy[]): number {
  if (noktaIcinde(p, xy)) return 0
  let en = Infinity
  for (let i = 0; i < xy.length; i++) {
    const a = xy[i]!
    const b = xy[(i + 1) % xy.length]!
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const L2 = dx * dx + dy * dy
    const t = L2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2))
    en = Math.min(en, Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy)))
  }
  return en
}
/** Poligon sınır kutusu [minLng, minLat, maxLng, maxLat]. */
export function sinirKutusu(h: readonly LngLat[]): [number, number, number, number] {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity
  for (const p of h) {
    a = Math.min(a, p[0]); b = Math.min(b, p[1]); c = Math.max(c, p[0]); d = Math.max(d, p[1])
  }
  return [a, b, c, d]
}
