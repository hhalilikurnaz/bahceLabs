// Kaydırmalı bahçe yolculuğu: veri ve zaman çizelgesi.
//
// Koordinatlar ana fotoğrafa göre (site.orchardMaster, 1672×941 piksel).
// Fotoğraf değişirse yalnızca ROWS ve FOCUS_TREES güncellenir.

export const IMG_W = 1672;
export const IMG_H = 941;
export const TREE_R = 70; // ortalama taç yarıçapı (piksel)

// Sıraların y konumu ve her sıradaki ağaçların x konumu
const ROWS: { y: number; xs: number[] }[] = [
  { y: 115, xs: [83, 253, 440, 615, 800, 960, 1120, 1300, 1472, 1633] },
  { y: 320, xs: [79, 261, 430, 623, 793, 987, 1175, 1350, 1530, 1662] },
  { y: 535, xs: [68, 242, 430, 615, 820, 1005, 1197, 1374, 1568] },
  { y: 760, xs: [52, 237, 432, 618, 824, 1038, 1245, 1427, 1609] },
];

export type Tree = { id: string; x: number; y: number; row: number; col: number; health: "ok" | "watch" | "bad" };

// Sağlık durumu (örnek veri): sararmış ağaç "bad", birkaç ağaç "watch"
const WATCH = new Set(["3-7", "3-5", "2-6", "4-7", "1-9"]); // sararmış ağaçla birlikte 6 ağaç (Copilot yanıtıyla uyumlu)
const BAD = new Set(["3-6"]);

export const TREES: Tree[] = ROWS.flatMap((r, ri) =>
  r.xs.map((x, ci) => {
    const key = `${ri + 1}-${ci + 1}`;
    return {
      id: `B3-S${ri + 1}-A${String(ci + 1).padStart(2, "0")}`,
      x,
      y: r.y,
      row: ri + 1,
      col: ci + 1,
      health: BAD.has(key) ? "bad" : WATCH.has(key) ? "watch" : "ok",
    };
  })
);

export const ROW_Y = ROWS.map((r) => r.y);
// Sıra bazında toprak nemi (örnek veri, %). 3. sıra düşük.
export const ROW_MOISTURE = [31, 29, 17, 27];

const tree = (row: number, col: number) => TREES.find((t) => t.row === row && t.col === col)!;

// Yolculukta durulan 4 ağaç (onaylanan seçim)
export const FOCUS_TREES = {
  healthy: tree(2, 5), // Dijital Bahçe
  large: tree(4, 6), // Ağaç tespiti
  yellow: tree(3, 6), // Belirti
  fruit: tree(3, 8), // Rekolte
};

/* ---------------- kamera ---------------- */

// x,y: fotoğraftaki hedef nokta (0..1). z: yakınlık (1 = ekranı kaplar).
// ax,ay: hedef noktanın ekranda duracağı yer (0..1). Masaüstünde ağaç sağda, metin solda.
export type Cam = { x: number; y: number; z: number; ax: number; ay: number };

const at = (t: Tree, z: number): Cam => ({ x: t.x / IMG_W, y: t.y / IMG_H, z, ax: 0.66, ay: 0.5 });
const overview = (z = 1, ax = 0.5): Cam => ({ x: 0.5, y: 0.5, z, ax, ay: 0.5 });

// Mobilde ağaç ekranın üst yarısında ortalanır
export const mobileCam = (c: Cam): Cam => ({ ...c, z: Math.max(1, c.z * 0.68), ax: 0.5, ay: c.z > 1.3 ? 0.3 : 0.5 });

/* ---------------- zaman çizelgesi ---------------- */

// Her adım: ne kadar kaydırma sürdüğü (ekran yüksekliği cinsinden) ve kamera/katman durumu
export type Layers = { rings: number; ids: number; health: number; yield: number; water: number; grade: number };
const L = (o: Partial<Layers> = {}): Layers => ({ rings: 0, ids: 0, health: 0, yield: 0, water: 0, grade: 0, ...o });

export type Stop = {
  key: string;
  len: number; // ekran
  cam: Cam;
  layers: Layers;
  focus?: Tree;
  step?: number; // metin adımı (features.steps indeksi)
};

// Giriş bölümü süreleri (ekran)
export const INTRO = {
  video: 1.7, // drone videosu kaydırmayla oynar
  dive: 0.75, // videodan kuşbakışı fotoğrafa geçiş
  scan: 1.0, // tarama çizgisi: ağaçlar tespit edilir
};

export const STOPS: Stop[] = [
  { key: "map", len: 1.0, cam: overview(1), layers: L({ rings: 1, ids: 1, grade: 0.8 }) },
  { key: "twin", len: 1.05, cam: at(FOCUS_TREES.healthy, 1.9), layers: L({ rings: 1, ids: 1, grade: 0.3 }), focus: FOCUS_TREES.healthy, step: 0 },
  { key: "detect", len: 1.05, cam: at(FOCUS_TREES.large, 1.8), layers: L({ rings: 1, grade: 0.2 }), focus: FOCUS_TREES.large, step: 1 },
  { key: "health", len: 1.05, cam: at(FOCUS_TREES.yellow, 2.0), layers: L({ health: 1, grade: 0.15 }), focus: FOCUS_TREES.yellow, step: 2 },
  { key: "yield", len: 1.05, cam: at(FOCUS_TREES.fruit, 1.9), layers: L({ yield: 1, grade: 0.15 }), focus: FOCUS_TREES.fruit, step: 3 },
  { key: "water", len: 1.05, cam: overview(1.15, 0.62), layers: L({ water: 1, grade: 0.3 }), step: 4 },
  { key: "copilot", len: 1.2, cam: overview(1.15, 0.62), layers: L({ health: 1, water: 0.5, grade: 0.3 }), focus: FOCUS_TREES.yellow, step: 5 },
];

const MOVE = 0.4; // her durağın ilk %40'i kamera hareketi, kalanı bekleme

export const INTRO_LEN = INTRO.video + INTRO.dive + INTRO.scan;
export const TOTAL_LEN = INTRO_LEN + STOPS.reduce((s, x) => s + x.len, 0);

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpCam = (a: Cam, b: Cam, t: number): Cam => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
  z: lerp(a.z, b.z, t),
  ax: lerp(a.ax, b.ax, t),
  ay: lerp(a.ay, b.ay, t),
});
const lerpLayers = (a: Layers, b: Layers, t: number): Layers =>
  Object.fromEntries(Object.keys(a).map((k) => [k, lerp(a[k as keyof Layers], b[k as keyof Layers], t)])) as Layers;

export type Frame = {
  video: number; // video ilerlemesi 0..1
  videoOut: number; // videodan fotoğrafa geçiş 0..1
  scan: number; // tarama çizgisi konumu 0..1 (0 = başlamadı)
  cam: Cam;
  layers: Layers;
  stop: number; // aktif durak (-1 = giriş)
  focus?: Tree;
  focusIn: number; // odak kartının görünürlüğü 0..1
  stepIn: number; // aktif metin adımının görünürlüğü 0..1
  intro: number; // giriş metninin görünürlüğü 0..1
  lines: [number, number, number]; // giriş cümlelerinin görünürlüğü
};

/** s: yolculuk bölümünde kaydırılan mesafe (ekran yüksekliği cinsinden) */
export function frameAt(s: number): Frame {
  const { video: V, dive: D, scan: S } = INTRO;
  const first = STOPS[0];
  const window = (a: number, b: number, f = 0.18) => clamp01((s - a) / f) * clamp01((b - s) / f);

  const lines: [number, number, number] = [
    window(0.7, V - 0.1),
    window(V + D + 0.1, V + D + S),
    window(V + D + S + 0.05, INTRO_LEN + first.len * 0.9),
  ];

  const base = {
    video: clamp01(s / V),
    videoOut: smooth(clamp01((s - V) / D)),
    scan: clamp01((s - V - D) / (S * 0.8)),
    intro: 1 - clamp01(s / 0.5),
    lines,
  };

  if (s < INTRO_LEN) {
    // tarama sırasında: kamera kuşbakışı; halkalar çizginin geçtiği yerde belirir (CSS), not ve etiket yok
    const dive = base.videoOut;
    const cam = { ...first.cam, z: lerp(1.45, first.cam.z, dive), y: lerp(0.62, first.cam.y, dive) };
    const t = clamp01((s - V - D - S * 0.6) / (S * 0.4));
    return { ...base, cam, layers: L({ rings: 1, ids: t, grade: base.scan * 0.8 }), stop: -1, focusIn: 0, stepIn: 0 };
  }

  let a = INTRO_LEN;
  for (let i = 0; i < STOPS.length; i++) {
    const st = STOPS[i];
    const b = a + st.len;
    if (s < b || i === STOPS.length - 1) {
      const prev = STOPS[Math.max(0, i - 1)];
      const u = clamp01((s - a) / st.len);
      const m = i === 0 ? 1 : smooth(clamp01(u / MOVE));
      const cam = lerpCam(prev.cam, st.cam, m);
      const layers = lerpLayers(prev.layers, st.layers, m);
      // metin ve kart: hareket bitmeye yakın belirir, durağın sonunda kaybolur
      const out = i === STOPS.length - 1 ? 1 : 1 - clamp01((u - 0.9) / 0.1);
      const inn = clamp01((u - MOVE * 0.45) / (MOVE * 0.45));
      return {
        ...base,
        video: 1,
        videoOut: 1,
        scan: 1,
        cam,
        layers,
        stop: i,
        focus: st.focus,
        focusIn: st.focus ? inn * out : 0,
        stepIn: st.step !== undefined ? inn * out : 0,
      };
    }
    a = b;
  }
  throw new Error("unreachable");
}

/**
 * Kamerayı ekran dönüşümüne çevirir. Fotoğraf her zaman ekranı kaplar (kenar görünmez).
 * Döner: ölçek (fotoğraf pikseli → ekran pikseli) ve öteleme.
 */
export function camTransform(c: Cam, W: number, H: number, looseY = false) {
  const cover = Math.max(W / IMG_W, H / IMG_H);
  const k = cover * Math.max(1, c.z);
  let tx = c.ax * W - c.x * IMG_W * k;
  let ty = c.ay * H - c.y * IMG_H * k;
  tx = Math.min(0, Math.max(W - IMG_W * k, tx));
  // mobilde alttaki ağaçlar da ekranın üst yarısına gelebilsin (alt kısım metin paneli)
  const minTy = looseY ? H * 0.55 - IMG_H * k : H - IMG_H * k;
  ty = Math.min(0, Math.max(Math.min(minTy, H - IMG_H * k), ty));
  return { k, tx, ty };
}
