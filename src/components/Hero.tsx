"use client";

import { useCallback, useMemo, useState } from "react";
import { useLocale, useMessages, useTranslations } from "next-intl";
import OrchardCanvas from "./OrchardCanvas";
import FrameSequence from "./FrameSequence";
import { site } from "@/lib/site";
import { ease, range, useScrollProgress } from "@/hooks/useScrollProgress";
import type { Scene } from "@/lib/orchard";

// B3 bloğunun merkezi (orchard.ts ile aynı geometri)
const FOCUS = { cx: 0.62, cy: 0.19 };

/*
 * ZAMAN ÇİZELGESİ (p = hero bölümündeki kaydırma ilerlemesi, 0..1)
 *
 * sequence modu (gerçek drone görüntüsü):
 *   0.00–0.65  gerçek drone kareleri: yüksekten geliş, sıraları izleme, tepeye iniş
 *   0.55–0.72  tarama çizgisi yukarıdan aşağı iner; çizginin üstü dijital ikiz (canvas), altı gerçek görüntü
 *   0.60–0.85  ağaçlar tek tek tespit edilir (kutular)
 *   0.85–1.00  kimlikler ve blok sınırları: bahçe dijital haritaya dönüşür
 *
 * canvas modu (görüntü hazır değilken):
 *   drone çizimi bahçe üzerinde uçar, yakınlaşma ve tespit aynı sırayla olur.
 */
function sceneFor(p: number, mode: typeof site.heroMode): Partial<Scene> {
  if (mode === "sequence") {
    const out = ease(range(p, 0.85, 1));
    return {
      zoom: 2.3 - out * 0.7,
      cx: FOCUS.cx,
      cy: FOCUS.cy + 0.04,
      drone: 0,
      boxes: range(p, 0.6, 0.85),
      ids: range(p, 0.75, 0.9),
      blocks: range(p, 0.86, 1),
    };
  }
  const z = ease(range(p, 0.28, 0.78));
  return {
    zoom: 1.05 + z * 1.35,
    cx: 0.5 + (FOCUS.cx - 0.5) * z,
    cy: 0.5 + (FOCUS.cy - 0.5) * z,
    drone: 1 - range(p, 0.35, 0.6),
    boxes: range(p, 0.42, 0.8),
    ids: range(p, 0.7, 0.9),
    blocks: range(p, 0.82, 1),
  };
}

const LINE_WINDOWS = {
  sequence: [
    [0.1, 0.4],
    [0.6, 0.82],
    [0.84, 0.99],
  ],
  canvas: [
    [0.22, 0.44],
    [0.44, 0.68],
    [0.68, 0.98],
  ],
} as const;

export default function Hero() {
  const t = useTranslations("hero");
  const tc = useTranslations("canvas");
  const locale = useLocale();
  const lines = (useMessages() as unknown as { hero: { transition: string[] } }).hero.transition;
  const mode = site.heroMode;
  const [ref, p, live] = useScrollProgress<HTMLElement>();
  const [photoReady, setPhotoReady] = useState(false);
  const onFirstFrame = useCallback(() => setPhotoReady(true), []);

  const scene = useMemo(() => sceneFor(p, mode), [p, mode]);
  const labels = useMemo(() => ({ block: tc("block"), moisture: tc("moisture"), tons: tc("tons") }), [tc]);

  const copyOpacity = 1 - range(p, 0.05, 0.22);
  // gerçek görüntüden dijitale geçiş: tarama çizgisinin konumu (%)
  const scan = mode === "sequence" ? range(p, 0.55, 0.72) : mode === "video" ? range(p, 0.25, 0.5) : 1;
  const showPhoto = mode !== "canvas" && scan < 1;
  const windows = mode === "sequence" ? LINE_WINDOWS.sequence : LINE_WINDOWS.canvas;
  const firstFrame = `${site.heroSequence.desktop.path}${"1".padStart(site.heroSequence.pad, "0")}.${site.heroSequence.desktop.ext}`;

  return (
    <section ref={ref} className={`hero hero--${mode}`} id="top" aria-label={t("title")}>
      {mode === "sequence" && <link rel="preload" as="image" href={firstFrame} fetchPriority="high" />}
      <div className="hero-sticky">
        <div className="hero-media">
          {/* Dijital ikiz katmanı (her modda altta) */}
          <OrchardCanvas scene={scene} labels={labels} locale={locale} className="hero-canvas" ariaLabel={tc("aria")} />

          {/* Gerçek görüntü katmanı: tarama çizgisi indikçe yukarıdan kırpılır */}
          {showPhoto && (
            <div className="hero-photo" style={{ clipPath: `inset(${scan * 100}% 0 0 0)` }}>
              {mode === "sequence" ? (
                <>
                  {!photoReady && <img className="hero-poster" src={firstFrame} alt="" fetchPriority="high" />}
                  <FrameSequence
                    desktop={site.heroSequence.desktop}
                    mobile={site.heroSequence.mobile}
                    pad={site.heroSequence.pad}
                    progressRef={live}
                    from={0}
                    to={0.65}
                    className="hero-frames"
                    onFirstFrame={onFirstFrame}
                  />
                </>
              ) : (
                <video className="hero-video" autoPlay muted loop playsInline preload="metadata" poster={site.heroVideo.poster} aria-hidden="true">
                  <source src={site.heroVideo.mobileMp4} type="video/mp4" media="(max-width: 767px)" />
                  <source src={site.heroVideo.webm} type="video/webm" />
                  <source src={site.heroVideo.mp4} type="video/mp4" />
                </video>
              )}
            </div>
          )}
          {showPhoto && scan > 0 && <div className="hero-scanline" style={{ top: `${scan * 100}%` }} />}
          <div className="hero-shade" style={{ opacity: 0.3 + copyOpacity * 0.5 }} />
        </div>

        <div className="hero-copy container" style={{ opacity: copyOpacity, transform: `translateY(${(1 - copyOpacity) * -30}px)` }}>
          <p className="eyebrow">{t("eyebrow")}</p>
          <h1>{t("title")}</h1>
          <p className="lead">{t("subtitle")}</p>
          <div className="actions">
            <a className="btn btn-primary" href="#demo">
              {t("cta")}
            </a>
            <a className="btn btn-ghost" href="#how">
              {t("secondary")}
            </a>
          </div>
        </div>

        <div className="hero-lines" aria-hidden="true">
          {lines.map((line, i) => {
            const [a, b] = windows[i];
            const o = range(p, a, a + 0.05) * (1 - range(p, b - 0.05, b));
            return (
              <p key={i} className="hero-line" style={{ opacity: o, transform: `translateY(${(1 - o) * 16}px)` }}>
                <span className="hero-line-num">0{i + 1}</span>
                {line}
              </p>
            );
          })}
        </div>

        <div className="scroll-hint" style={{ opacity: 1 - range(p, 0, 0.06) }}>
          <span>{t("scroll")}</span>
          <i aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}
