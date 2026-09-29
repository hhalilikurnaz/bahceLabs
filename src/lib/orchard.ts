/*
 * Kuşbakışı narenciye bahçesi çizim motoru (Canvas 2D).
 * - Bahçe deterministik üretilir (her yüklemede aynı görünür).
 * - Ağaçlar önceden çizilmiş sprite'larla çizilir; kare başına tek drawImage.
 * - Zemin bir kez offscreen canvas'a çizilir.
 * - Sahne parametreleri 0..1 arası değerlerdir ve bileşen tarafından yumuşakça tweenlenir.
 */

export type Scene = {
  zoom: number; // 1 = bahçeyi ekrana sığdır (cover)
  cx: number; // dünya koordinatında kamera merkezi (0..1)
  cy: number;
  drone: number; // drone ve tarama bandı görünürlüğü
  boxes: number; // ağaç tespit kutuları (ilerleme)
  ids: number; // ağaç kimlik etiketleri
  blocks: number; // blok sınırları ve etiketleri
  health: number; // sağlık renklendirmesi
  yield: number; // blok rekolte etiketleri
  water: number; // toprak nemi / sulama katmanı
  focus: number; // odak bloğu vurgusu
};

export const baseScene: Scene = {
  zoom: 1,
  cx: 0.5,
  cy: 0.5,
  drone: 0,
  boxes: 0,
  ids: 0,
  blocks: 0,
  health: 0,
  yield: 0,
  water: 0,
  focus: 0,
};

export type CanvasLabels = {
  block: string; // "B"
  moisture: string; // "Nem"
  tons: string; // "t"
};

type Tree = {
  x: number;
  y: number;
  r: number;
  v: number; // sprite varyantı
  order: number; // tespit sırası 0..1
  status: 0 | 1 | 2; // 0 sağlıklı, 1 sararma, 2 kuruma
  id: number;
  block: number;
};

type Block = {
  x: number;
  y: number;
  w: number;
  h: number;
  name: string;
  yieldT: number;
  moisture: number;
};

export type Orchard = {
  w: number;
  h: number;
  trees: Tree[];
  blocks: Block[];
  focusBlock: number;
  ground: HTMLCanvasElement | null;
  sprites: HTMLCanvasElement[];
};

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const COLS = 28;
const ROWS = 20;
const SP = 44;
const MARGIN = 40;
const BLOCK_COLS = [0, 7, 14, 21, 28];
const BLOCK_ROWS = [0, 7, 14, 20];

export function createOrchard(seed = 11): Orchard {
  const rand = rng(seed);
  const w = MARGIN * 2 + (COLS - 1) * SP;
  const h = MARGIN * 2 + (ROWS - 1) * SP;

  const blocks: Block[] = [];
  let bi = 0;
  for (let br = 0; br < BLOCK_ROWS.length - 1; br++) {
    for (let bc = 0; bc < BLOCK_COLS.length - 1; bc++) {
      const x0 = MARGIN + BLOCK_COLS[bc] * SP - SP / 2;
      const x1 = MARGIN + (BLOCK_COLS[bc + 1] - 1) * SP + SP / 2;
      const y0 = MARGIN + BLOCK_ROWS[br] * SP - SP / 2;
      const y1 = MARGIN + (BLOCK_ROWS[br + 1] - 1) * SP + SP / 2;
      bi++;
      blocks.push({
        x: x0,
        y: y0,
        w: x1 - x0,
        h: y1 - y0,
        name: String(bi),
        yieldT: Math.round((14 + rand() * 12) * 10) / 10,
        moisture: Math.round(16 + rand() * 20),
      });
    }
  }
  // Odak bloğu (B3): düşük nem, belirti gösteren 6 ağaç.
  const focusBlock = 2;
  blocks[focusBlock].moisture = 14;

  const blockOf = (c: number, r: number) => {
    let bc = 0;
    while (c >= BLOCK_COLS[bc + 1]) bc++;
    let br = 0;
    while (r >= BLOCK_ROWS[br + 1]) br++;
    return br * (BLOCK_COLS.length - 1) + bc;
  };

  const trees: Tree[] = [];
  let id = 1;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (rand() < 0.03) continue; // eksik ağaç
      const x = MARGIN + c * SP + (rand() - 0.5) * 7;
      const y = MARGIN + r * SP + (rand() - 0.5) * 7 + Math.sin(c * 0.35) * 2;
      trees.push({
        x,
        y,
        r: 14 + rand() * 5.5,
        v: Math.floor(rand() * 4),
        order: 0,
        status: 0,
        id: id++,
        block: blockOf(c, r),
      });
    }
  }
  // Tespit sırası: soldan sağa tarama + küçük gürültü
  trees.forEach((t) => (t.order = Math.min(0.999, (t.x / w) * 0.9 + rand() * 0.1)));

  // Belirti durumu
  const inFocus = trees.filter((t) => t.block === focusBlock);
  for (let i = 0; i < 6; i++) inFocus[Math.floor((i + 0.5) * (inFocus.length / 6))].status = 1;
  const others = trees.filter((t) => t.block !== focusBlock);
  for (let i = 0; i < 5; i++) others[Math.floor(rand() * others.length)].status = 1;
  for (let i = 0; i < 2; i++) others[Math.floor(rand() * others.length)].status = 2;

  return { w, h, trees, blocks, focusBlock, ground: null, sprites: [] };
}

/* ---------- önbellekler ---------- */

function makeSprite(seed: number): HTMLCanvasElement {
  const S = 128;
  const cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const g = cv.getContext("2d")!;
  const rand = rng(seed * 97 + 3);
  const cx = S / 2;
  const R = S / 2.5; // sprite içinde taç yarıçapı (çizimde r ile eşlenir)

  // gölge
  g.fillStyle = "rgba(10,20,8,0.35)";
  g.beginPath();
  g.ellipse(cx + R * 0.28, cx + R * 0.3, R * 1.02, R * 0.92, 0, 0, Math.PI * 2);
  g.fill();

  // yaprak kümeleri
  const lobes = 7;
  for (let i = 0; i < lobes; i++) {
    const a = (i / lobes) * Math.PI * 2 + rand() * 0.4;
    const d = R * (0.45 + rand() * 0.18);
    const lr = R * (0.5 + rand() * 0.14);
    const lx = cx + Math.cos(a) * d;
    const ly = cx + Math.sin(a) * d;
    const grad = g.createRadialGradient(lx - lr * 0.35, ly - lr * 0.35, lr * 0.1, lx, ly, lr);
    grad.addColorStop(0, "#5f9a45");
    grad.addColorStop(0.6, "#2f6b2e");
    grad.addColorStop(1, "#1a4520");
    g.fillStyle = grad;
    g.beginPath();
    g.arc(lx, ly, lr, 0, Math.PI * 2);
    g.fill();
  }
  const grad = g.createRadialGradient(cx - R * 0.3, cx - R * 0.35, R * 0.1, cx, cx, R * 0.8);
  grad.addColorStop(0, "#6aa84c");
  grad.addColorStop(1, "#285e2a");
  g.fillStyle = grad;
  g.beginPath();
  g.arc(cx, cx, R * 0.62, 0, Math.PI * 2);
  g.fill();

  // meyveler
  g.fillStyle = "#f2d04c";
  for (let i = 0; i < 7; i++) {
    const a = rand() * Math.PI * 2;
    const d = R * (0.2 + rand() * 0.7);
    g.beginPath();
    g.arc(cx + Math.cos(a) * d, cx + Math.sin(a) * d, R * 0.065, 0, Math.PI * 2);
    g.fill();
  }
  return cv;
}

function makeGround(o: Orchard): HTMLCanvasElement {
  const k = 1;
  const cv = document.createElement("canvas");
  cv.width = Math.ceil(o.w * k);
  cv.height = Math.ceil(o.h * k);
  const g = cv.getContext("2d")!;
  g.scale(k, k);
  g.fillStyle = "#6c5a3f";
  g.fillRect(0, 0, o.w, o.h);
  const rand = rng(5);
  // toprak dokusu
  for (let i = 0; i < 2600; i++) {
    const x = rand() * o.w;
    const y = rand() * o.h;
    const s = 1 + rand() * 3;
    g.fillStyle = rand() < 0.5 ? "rgba(255,240,210,0.05)" : "rgba(30,20,10,0.08)";
    g.fillRect(x, y, s, s);
  }
  // ağaç sıraları boyunca yeşil şeritler
  for (let r = 0; r < ROWS; r++) {
    const y = MARGIN + r * SP;
    g.fillStyle = "rgba(92,110,58,0.55)";
    g.fillRect(0, y - SP * 0.36, o.w, SP * 0.72);
  }
  // çim lekeleri
  for (let i = 0; i < 420; i++) {
    g.fillStyle = "rgba(70,95,45,0.18)";
    g.beginPath();
    g.arc(rand() * o.w, rand() * o.h, 4 + rand() * 14, 0, Math.PI * 2);
    g.fill();
  }
  return cv;
}

export function prepare(o: Orchard) {
  if (!o.ground) o.ground = makeGround(o);
  if (!o.sprites.length) o.sprites = [0, 1, 2, 3].map(makeSprite);
}

/* ---------- çizim ---------- */

const LEMON = "242,201,76";
const ORANGE = "240,140,50";
const RED = "214,72,56";
const BLUE = "72,150,230";

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function chip(g: CanvasRenderingContext2D, x: number, y: number, text: string, dpr: number, bg: string, fg: string, alpha: number) {
  g.save();
  g.globalAlpha = alpha;
  g.font = `600 ${11 * dpr}px Manrope, system-ui, sans-serif`;
  const tw = g.measureText(text).width;
  const pw = 8 * dpr;
  const hh = 20 * dpr;
  roundRect(g, x, y, tw + pw * 2, hh, 6 * dpr);
  g.fillStyle = bg;
  g.fill();
  g.fillStyle = fg;
  g.textBaseline = "middle";
  g.fillText(text, x + pw, y + hh / 2 + 0.5 * dpr);
  g.restore();
}

export function draw(
  g: CanvasRenderingContext2D,
  W: number,
  H: number,
  dpr: number,
  o: Orchard,
  s: Scene,
  time: number,
  labels: CanvasLabels,
  formatNumber: (n: number) => string
) {
  const base = Math.max(W / o.w, H / o.h);
  const scale = base * s.zoom;
  const camX = s.cx * o.w;
  const camY = s.cy * o.h;
  const tx = (x: number) => (x - camX) * scale + W / 2;
  const ty = (y: number) => (y - camY) * scale + H / 2;

  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = "#3f3424";
  g.fillRect(0, 0, W, H);
  if (o.ground) g.drawImage(o.ground, tx(0), ty(0), o.w * scale, o.h * scale);

  // görünür alan filtresi
  const pad = 30;
  const minX = camX - W / 2 / scale - pad;
  const maxX = camX + W / 2 / scale + pad;
  const minY = camY - H / 2 / scale - pad;
  const maxY = camY + H / 2 / scale + pad;
  const vis = o.trees.filter((t) => t.x > minX && t.x < maxX && t.y > minY && t.y < maxY);

  // su katmanı (ağaçların altında blok renklendirme)
  if (s.water > 0.01) {
    for (const b of o.blocks) {
      const dry = b.moisture < 20;
      g.fillStyle = dry ? `rgba(${ORANGE},${0.22 * s.water})` : `rgba(${BLUE},${(0.1 + (b.moisture - 20) / 80) * s.water})`;
      g.fillRect(tx(b.x), ty(b.y), b.w * scale, b.h * scale);
    }
  }

  // ağaçlar
  const spriteScale = 2.5 / 1; // sprite genişliği = r * 2.5 * (128/(2*R)) yaklaşık
  for (const t of vis) {
    const rr = t.r * scale;
    const size = rr * spriteScale * 1.05;
    g.drawImage(o.sprites[t.v], tx(t.x) - size / 2, ty(t.y) - size / 2, size, size);
  }

  // sağlık renklendirmesi
  if (s.health > 0.01) {
    const pulse = 0.5 + 0.5 * Math.sin(time * 3.2);
    for (const t of vis) {
      const x = tx(t.x);
      const y = ty(t.y);
      const rr = t.r * scale;
      if (t.status === 0) {
        g.strokeStyle = `rgba(120,200,110,${0.45 * s.health})`;
        g.lineWidth = 1.2 * dpr;
        g.beginPath();
        g.arc(x, y, rr * 1.05, 0, Math.PI * 2);
        g.stroke();
      } else {
        const col = t.status === 1 ? ORANGE : RED;
        g.fillStyle = `rgba(${col},${0.42 * s.health})`;
        g.beginPath();
        g.arc(x, y, rr * 0.95, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = `rgba(${col},${(0.6 + 0.4 * pulse) * s.health})`;
        g.lineWidth = 2.2 * dpr;
        g.beginPath();
        g.arc(x, y, rr * (1.25 + 0.25 * pulse), 0, Math.PI * 2);
        g.stroke();
      }
    }
  }

  // tespit kutuları
  if (s.boxes > 0.01) {
    g.lineWidth = Math.max(1, 1.3 * dpr);
    for (const t of vis) {
      if (t.order > s.boxes) continue;
      const a = Math.min(1, (s.boxes - t.order) * 8);
      const x = tx(t.x);
      const y = ty(t.y);
      const hs = t.r * scale * 1.2;
      const c = hs * 0.45;
      g.beginPath();
      // köşe braketleri
      g.moveTo(x - hs, y - hs + c); g.lineTo(x - hs, y - hs); g.lineTo(x - hs + c, y - hs);
      g.moveTo(x + hs - c, y - hs); g.lineTo(x + hs, y - hs); g.lineTo(x + hs, y - hs + c);
      g.moveTo(x + hs, y + hs - c); g.lineTo(x + hs, y + hs); g.lineTo(x + hs - c, y + hs);
      g.moveTo(x - hs + c, y + hs); g.lineTo(x - hs, y + hs); g.lineTo(x - hs, y + hs - c);
      g.strokeStyle = `rgba(10,16,8,${0.55 * a})`;
      g.lineWidth = Math.max(2, 3.2 * dpr);
      g.stroke();
      g.strokeStyle = `rgba(${LEMON},${a})`;
      g.lineWidth = Math.max(1, 1.6 * dpr);
      g.stroke();
      if (s.ids > 0.01 && hs > 20 * dpr) {
        g.globalAlpha = s.ids * a;
        g.font = `600 ${10 * dpr}px Manrope, system-ui, sans-serif`;
        g.fillStyle = `rgba(${LEMON},1)`;
        g.textBaseline = "bottom";
        g.fillText(`#${String(t.id).padStart(4, "0")}`, x - hs, y - hs - 3 * dpr);
        g.globalAlpha = 1;
      }
    }
  }

  // bloklar
  if (s.blocks > 0.01 || s.yield > 0.01 || s.water > 0.01 || s.focus > 0.01) {
    for (let i = 0; i < o.blocks.length; i++) {
      const b = o.blocks[i];
      const x = tx(b.x);
      const y = ty(b.y);
      const bw = b.w * scale;
      const bh = b.h * scale;
      const isFocus = i === o.focusBlock;
      const ba = Math.max(s.blocks, isFocus ? s.focus : 0);
      if (ba > 0.01) {
        g.save();
        g.setLineDash([6 * dpr, 5 * dpr]);
        g.strokeStyle = isFocus && s.focus > 0.01 ? `rgba(${LEMON},${ba})` : `rgba(255,255,255,${0.55 * ba})`;
        g.lineWidth = (isFocus && s.focus > 0.01 ? 2.2 : 1.2) * dpr;
        g.strokeRect(x, y, bw, bh);
        g.restore();
      }
      const labelA = Math.max(s.blocks, s.yield, s.water, isFocus ? s.focus : 0);
      if (labelA > 0.01) {
        let text = `${labels.block}${b.name}`;
        if (s.yield > 0.5) text += ` · ${formatNumber(b.yieldT)} ${labels.tons}`;
        else if (s.water > 0.5) text += ` · ${labels.moisture} %${b.moisture}`;
        const dry = b.moisture < 20;
        const bg =
          s.water > 0.5 && dry ? "rgba(240,140,50,0.95)" : isFocus && s.focus > 0.5 ? "rgba(242,201,76,0.96)" : "rgba(14,26,18,0.82)";
        const fg = (s.water > 0.5 && dry) || (isFocus && s.focus > 0.5) ? "#14200f" : "#f3f1e7";
        chip(g, x + 8 * dpr, y + 8 * dpr, text, dpr, bg, fg, labelA);
        if (s.yield > 0.05) {
          // mini rekolte çubuğu
          const bwBar = Math.min(bw - 16 * dpr, 120 * dpr);
          const fill = (b.yieldT - 12) / 16;
          g.globalAlpha = s.yield;
          g.fillStyle = "rgba(14,26,18,0.7)";
          g.fillRect(x + 8 * dpr, y + 32 * dpr, bwBar, 5 * dpr);
          g.fillStyle = `rgba(${LEMON},1)`;
          g.fillRect(x + 8 * dpr, y + 32 * dpr, bwBar * fill, 5 * dpr);
          g.globalAlpha = 1;
        }
      }
    }
  }

  // drone ve tarama bandı
  if (s.drone > 0.01) {
    const period = 9;
    const p = (time % period) / period;
    const dx = tx(o.w * (0.08 + 0.84 * p));
    const dy = ty(o.h * (0.5 + 0.12 * Math.sin(p * Math.PI * 2)));
    const bandW = 80 * dpr;
    const grad = g.createLinearGradient(dx - bandW, 0, dx + bandW * 0.2, 0);
    grad.addColorStop(0, `rgba(${LEMON},0)`);
    grad.addColorStop(1, `rgba(${LEMON},${0.16 * s.drone})`);
    g.fillStyle = grad;
    g.fillRect(dx - bandW, 0, bandW * 1.2, H);
    g.strokeStyle = `rgba(${LEMON},${0.7 * s.drone})`;
    g.lineWidth = 1.5 * dpr;
    g.beginPath();
    g.moveTo(dx + bandW * 0.2, 0);
    g.lineTo(dx + bandW * 0.2, H);
    g.stroke();
    drawDrone(g, dx, dy, 34 * dpr * Math.min(1.4, 0.7 + s.zoom * 0.3), time, s.drone);
  }
}

function drawDrone(g: CanvasRenderingContext2D, x: number, y: number, size: number, time: number, alpha: number) {
  g.save();
  g.globalAlpha = alpha;
  // gölge
  g.fillStyle = "rgba(0,0,0,0.25)";
  g.beginPath();
  g.ellipse(x + size * 0.9, y + size * 1.1, size * 0.9, size * 0.6, 0, 0, Math.PI * 2);
  g.fill();
  g.translate(x, y);
  g.strokeStyle = "#1b1f1c";
  g.lineWidth = size * 0.1;
  g.lineCap = "round";
  const arm = size * 0.62;
  g.beginPath();
  g.moveTo(-arm, -arm); g.lineTo(arm, arm);
  g.moveTo(arm, -arm); g.lineTo(-arm, arm);
  g.stroke();
  for (const [ax, ay] of [[-arm, -arm], [arm, -arm], [arm, arm], [-arm, arm]]) {
    g.fillStyle = "rgba(230,235,230,0.35)";
    g.beginPath();
    g.arc(ax, ay, size * 0.36, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "rgba(20,24,20,0.8)";
    g.lineWidth = size * 0.05;
    const a = time * 40;
    g.beginPath();
    g.moveTo(ax + Math.cos(a) * size * 0.34, ay + Math.sin(a) * size * 0.34);
    g.lineTo(ax - Math.cos(a) * size * 0.34, ay - Math.sin(a) * size * 0.34);
    g.stroke();
  }
  g.fillStyle = "#f3f1e7";
  roundRect(g, -size * 0.28, -size * 0.2, size * 0.56, size * 0.4, size * 0.1);
  g.fill();
  g.fillStyle = "#f2c94c";
  g.beginPath();
  g.arc(0, 0, size * 0.09, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

export function lerpScene(a: Scene, b: Scene, k: number): Scene {
  const out = { ...a };
  (Object.keys(b) as (keyof Scene)[]).forEach((key) => {
    out[key] = a[key] + (b[key] - a[key]) * k;
  });
  return out;
}

export function sceneDistance(a: Scene, b: Scene) {
  let d = 0;
  (Object.keys(b) as (keyof Scene)[]).forEach((key) => (d += Math.abs(a[key] - b[key])));
  return d;
}

export function focusCenter(o: Orchard) {
  const b = o.blocks[o.focusBlock];
  return { cx: (b.x + b.w / 2) / o.w, cy: (b.y + b.h / 2) / o.h };
}
