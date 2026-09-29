"use client";

import { useEffect, useRef } from "react";
import {
  baseScene,
  createOrchard,
  draw,
  lerpScene,
  prepare,
  sceneDistance,
  type CanvasLabels,
  type Orchard,
  type Scene,
} from "@/lib/orchard";

let shared: Orchard | null = null;
function getOrchard() {
  if (!shared) shared = createOrchard();
  return shared;
}

type Props = {
  scene: Partial<Scene>;
  labels: CanvasLabels;
  locale: string;
  className?: string;
  /** true ise sahne hedefe yumuşak geçiş yapmaz, doğrudan uygulanır (scroll ile sürülen sahneler için) */
  immediate?: boolean;
  ariaLabel?: string;
};

export default function OrchardCanvas({ scene, labels, locale, className, immediate, ariaLabel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const targetRef = useRef<Scene>({ ...baseScene, ...scene });
  const currentRef = useRef<Scene>({ ...baseScene, ...scene });
  const labelsRef = useRef(labels);
  const immediateRef = useRef(!!immediate);
  const wakeRef = useRef<() => void>(() => {});

  labelsRef.current = labels;
  immediateRef.current = !!immediate;

  useEffect(() => {
    targetRef.current = { ...baseScene, ...scene };
    wakeRef.current();
  }, [scene]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const g = canvas.getContext("2d", { alpha: false });
    if (!g) return;
    const orchard = getOrchard();
    prepare(orchard);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 1, minimumFractionDigits: 1 });
    let raf = 0;
    let visible = true;
    let last = performance.now();
    let W = 0;
    let H = 0;
    let dpr = 1;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.max(1, Math.round(rect.width * dpr));
      H = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W;
        canvas.height = H;
      }
      render(performance.now());
    };

    const render = (now: number) => {
      draw(g, W, H, dpr, orchard, currentRef.current, now / 1000, labelsRef.current, (n) => fmt.format(n));
    };

    const loop = (now: number) => {
      raf = 0;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const target = targetRef.current;
      const cur = currentRef.current;
      if (immediateRef.current || reduced) {
        currentRef.current = { ...target };
      } else {
        currentRef.current = lerpScene(cur, target, 1 - Math.exp(-dt * 5));
      }
      render(now);
      const animating =
        sceneDistance(currentRef.current, target) > 0.001 ||
        (!reduced && (target.drone > 0.01 || target.health > 0.01));
      if (visible && animating) raf = requestAnimationFrame(loop);
    };

    const wake = () => {
      if (!raf && visible) {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    };
    wakeRef.current = wake;

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver(
      ([e]) => {
        visible = e.isIntersecting;
        if (visible) wake();
        else if (raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      },
      { rootMargin: "100px" }
    );
    io.observe(canvas);
    resize();
    wake();

    return () => {
      ro.disconnect();
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
      wakeRef.current = () => {};
    };
  }, [locale]);

  return <canvas ref={canvasRef} className={className} role="img" aria-label={ariaLabel} />;
}
