"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useMessages, useTranslations } from "next-intl";
import OrchardCanvas from "./OrchardCanvas";
import type { Scene } from "@/lib/orchard";

type Step = { tag: string; title: string; body: string; question?: string; answer?: string };

const FOCUS = { cx: 0.62, cy: 0.19 };

// Her özellik adımının bahçe sahnesi
const SCENES: Partial<Scene>[] = [
  { zoom: 0.78, cx: 0.5, cy: 0.5, blocks: 1, boxes: 1, ids: 0 },
  { zoom: 2.6, cx: 0.34, cy: 0.52, boxes: 1, ids: 1 },
  { zoom: 2.0, cx: FOCUS.cx, cy: FOCUS.cy + 0.06, health: 1, focus: 1 },
  { zoom: 0.78, cx: 0.5, cy: 0.5, yield: 1, blocks: 1 },
  { zoom: 0.78, cx: 0.5, cy: 0.5, water: 1, blocks: 1 },
  { zoom: 1.9, cx: FOCUS.cx, cy: FOCUS.cy + 0.08, health: 1, water: 0.6, focus: 1 },
];

type LegendKey = "trees" | "healthy" | "stress" | "dry" | "wet" | "low" | "yield" | "blocks";
const LEGENDS: { key: LegendKey; color: string; shape?: "ring" | "box" | "dash" }[][] = [
  [{ key: "blocks", color: "#ffffff", shape: "dash" }, { key: "trees", color: "#f2c94c", shape: "box" }],
  [{ key: "trees", color: "#f2c94c", shape: "box" }],
  [{ key: "healthy", color: "#78c86e", shape: "ring" }, { key: "stress", color: "#f08c32" }, { key: "dry", color: "#d64838" }],
  [{ key: "yield", color: "#f2c94c" }],
  [{ key: "wet", color: "#4896e6" }, { key: "low", color: "#f08c32" }],
  [{ key: "stress", color: "#f08c32" }, { key: "low", color: "#f08c32", shape: "dash" }],
];

export default function FeatureStory() {
  const t = useTranslations("features");
  const tc = useTranslations("canvas");
  const locale = useLocale();
  const steps = (useMessages() as { features: { steps: Step[] } }).features.steps;
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index));
        });
      },
      { rootMargin: "-45% 0px -45% 0px" }
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  const labels = useMemo(() => ({ block: tc("block"), moisture: tc("moisture"), tons: tc("tons") }), [tc]);
  const scene = SCENES[active] ?? SCENES[0];
  const copilot = steps[active]?.question ? steps[active] : null;

  return (
    <section className="features" id="features">
      <div className="container features-head">
        <p className="kicker">{t("kicker")}</p>
        <h2>{t("title")}</h2>
      </div>

      <div className="container features-grid">
        <div className="features-steps">
          {steps.map((s, i) => (
            <article
              key={i}
              ref={(el) => {
                refs.current[i] = el;
              }}
              data-index={i}
              className={`feature-step${i === active ? " is-active" : ""}`}
            >
              <span className="feature-num">{String(i + 1).padStart(2, "0")}</span>
              <p className="feature-tag">{s.tag}</p>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </article>
          ))}
        </div>

        <div className="features-stage">
          <div className="stage-frame">
            <OrchardCanvas scene={scene} labels={labels} locale={locale} className="stage-canvas" ariaLabel={tc("aria")} />
            <div className="stage-top">
              <span className="stage-chip">
                {String(active + 1).padStart(2, "0")} · {steps[active]?.tag}
              </span>
            </div>
            {copilot && (
              <div className="copilot" key={active}>
                <p className="copilot-q">{copilot.question}</p>
                <p className="copilot-a">{copilot.answer}</p>
              </div>
            )}
            <ul className="stage-legend">
              {LEGENDS[active].map((l, i) => (
                <li key={i}>
                  <i className={`sw sw-${l.shape ?? "fill"}`} style={{ ["--c" as string]: l.color }} />
                  {tc(`legend.${l.key}`)}
                </li>
              ))}
            </ul>
          </div>
          <p className="stage-note">{t("sampleNote")}</p>
        </div>
      </div>
    </section>
  );
}
