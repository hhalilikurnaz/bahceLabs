"use client";

import { useEffect, useRef, type CSSProperties, type RefObject } from "react";

export type SequenceSource = { path: string; count: number; ext: string };

type Props = {
  desktop: SequenceSource;
  mobile?: SequenceSource;
  pad?: number;
  /** 0..1 arası canlı ilerleme (render beklemeden her karede okunur) */
  progressRef: RefObject<number>;
  /** ilerlemenin hangi aralığı videoyu baştan sona oynatır */
  from?: number;
  to?: number;
  className?: string;
  style?: CSSProperties;
  onFirstFrame?: () => void;
  /**
   * Kaydırma yokken (ilerleme 0) videonun ilk bölümünü yavaşça ileri-geri oynatır,
   * böylece açılışta görüntü "canlı" durur. Değer: videonun ne kadarı (0..1). 0 = kapalı.
   */
  idle?: number;
};

/**
 * Kaydırmaya bağlı video: videodan çıkarılmış kareleri (webp) canvas'a çizer.
 * Neden <video> değil? Tarayıcılar video'da kaydırmayla ileri-geri gezinmede (currentTime) takılır;
 * kare dizisi her cihazda akıcıdır.
 *
 * Yükleme stratejisi: önce 1. kare, sonra her 16., 8., 4., 2. ve tüm kareler.
 * Böylece kullanıcı hızlı kaydırsa bile en yakın yüklenmiş kare gösterilir.
 */
export default function FrameSequence({ desktop, mobile, pad = 4, progressRef, from = 0, to = 1, className, style, onFirstFrame, idle = 0 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const g = canvas.getContext("2d", { alpha: false });
    if (!g) return;

    const small = window.matchMedia("(max-width: 767px)").matches;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    const src = (small || saveData) && mobile ? mobile : desktop;
    const n = src.count;
    const url = (i: number) => `${src.path}${String(i + 1).padStart(pad, "0")}.${src.ext}`;

    const frames: (HTMLImageElement | null)[] = new Array(n).fill(null);
    let cancelled = false;
    let visible = true;
    let raf = 0;
    let lastDrawn = -1;
    let W = 0;
    let H = 0;

    // yükleme sırası
    const order: number[] = [];
    const seen = new Set<number>();
    for (const stride of [n, 16, 8, 4, 2, 1]) {
      for (let i = 0; i < n; i += stride) if (!seen.has(i)) (seen.add(i), order.push(i));
    }
    if (!seen.has(n - 1)) order.splice(1, 0, n - 1);

    let cursor = 0;
    let inflight = 0;
    const MAX = 6;
    const pump = () => {
      while (!cancelled && inflight < MAX && cursor < order.length) {
        const i = order[cursor++];
        inflight++;
        const img = new Image();
        img.decoding = "async";
        img.src = url(i);
        img
          .decode()
          .then(() => {
            if (cancelled) return;
            frames[i] = img;
            if (i === 0) onFirstFrame?.();
            lastDrawn = -1; // daha yakın kare gelmiş olabilir
            schedule();
          })
          .catch(() => {})
          .finally(() => {
            inflight--;
            pump();
          });
      }
    };

    const nearest = (target: number) => {
      if (frames[target]) return target;
      for (let d = 1; d < n; d++) {
        if (target - d >= 0 && frames[target - d]) return target - d;
        if (target + d < n && frames[target + d]) return target + d;
      }
      return -1;
    };

    const drawFrame = (idx: number) => {
      const img = frames[idx];
      if (!img) return;
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      const s = Math.max(W / iw, H / ih); // object-fit: cover
      const dw = iw * s;
      const dh = ih * s;
      g.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
    };

    // gösterilen kare (ondalıklı): hedefe yumuşakça yaklaşır, hızlı kaydırmada bile akıcı görünür
    let shown = 0;
    let base = 0; // kaydırma başladığında boşta oynatmanın kaldığı kare
    let phase = 0; // boşta oynatma evresi (radyan)
    let lastT = performance.now();
    const idleSpan = Math.max(0, Math.min(1, idle)) * (n - 1);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const IDLE_PERIOD = 14; // sn: bir ileri-geri tur

    const tick = (now: number) => {
      raf = 0;
      const dt = Math.min(0.1, (now - lastT) / 1000);
      lastT = now;
      const p = Math.min(1, Math.max(0, (progressRef.current - from) / (to - from)));
      let target: number;
      if (p <= 0.0005 && idleSpan > 0 && !reduce) {
        phase += (dt * Math.PI * 2) / IDLE_PERIOD;
        base = ((1 - Math.cos(phase)) / 2) * idleSpan;
        target = base;
        shown = target;
      } else {
        target = base + p * (n - 1 - base);
        shown += (target - shown) * Math.min(1, dt * 12);
        if (Math.abs(target - shown) < 0.02) shown = target;
        // kaydırma başa dönünce boşta oynatma kaldığı yerden devam etsin
        if (idleSpan > 0) phase = Math.acos(Math.max(-1, Math.min(1, 1 - (2 * Math.min(base, idleSpan)) / idleSpan)));
      }
      const idx = nearest(Math.round(shown));
      if (idx >= 0 && idx !== lastDrawn) {
        drawFrame(idx);
        lastDrawn = idx;
      }
      if (visible) raf = requestAnimationFrame(tick);
    };
    const schedule = () => {
      if (!raf && visible) raf = requestAnimationFrame(tick);
    };

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.max(1, Math.round(r.width * dpr));
      H = Math.max(1, Math.round(r.height * dpr));
      canvas.width = W;
      canvas.height = H;
      lastDrawn = -1;
      schedule();
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) schedule();
      else if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    });
    io.observe(canvas);
    resize();
    pump();

    return () => {
      cancelled = true;
      ro.disconnect();
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [desktop, mobile, pad, progressRef, from, to, onFirstFrame, idle]);

  return <canvas ref={canvasRef} className={className} style={style} aria-hidden="true" />;
}
