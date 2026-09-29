"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

const clamp = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Uzun (ör. 300vh) ve içinde "sticky" alan bulunan bir bölümün kaydırma ilerlemesini 0..1 döndürür.
 * - Bölümün üstü ekranın üstüne geldiğinde 0, alt ucu ekranın altına geldiğinde 1.
 * - requestAnimationFrame ile kare başına en fazla bir kez hesaplanır.
 * - `steps` ile değer yuvarlanır; gereksiz React render'ları önlenir.
 */
export function useScrollProgress<T extends HTMLElement>(steps = 400): [RefObject<T | null>, number, RefObject<number>] {
  const ref = useRef<T>(null);
  const live = useRef(0); // her karede güncel değer (render beklemeden okumak için)
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = el.offsetHeight - window.innerHeight;
      const p = clamp(-rect.top / Math.max(1, total));
      live.current = p;
      setProgress(Math.round(p * steps) / steps);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [steps]);

  return [ref, progress, live];
}

export const range = (p: number, a: number, b: number) => clamp((p - a) / (b - a));
export const ease = (t: number) => t * t * (3 - 2 * t);
