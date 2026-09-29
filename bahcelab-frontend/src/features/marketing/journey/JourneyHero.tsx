import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FrameSequence } from './FrameSequence'
import { journeyMessages } from './journeyMessages'
import { journeySite } from './journeySite'
import {
  IMG_H,
  IMG_W,
  ROW_MOISTURE,
  ROW_Y,
  STOPS,
  TOTAL_LEN,
  TREES,
  TREE_R,
  FOCUS_TREES,
  INTRO_LEN,
  camTransform,
  frameAt,
  mobileCam,
  type Tree,
} from './journeyTimeline'
import './journey.css'

const HEALTH_COLOR = { ok: '#78c86e', watch: '#f08c32', bad: '#f08c32' } as const
const MOIST_X = 1262
const moistureColor = (m: number) => (m < 20 ? '#f08c32' : '#4896e6')
const fruitCount = (t: Tree) => (t.health !== 'ok' ? 240 : 330 + ((t.x * 7 + t.y * 13) % 150))

const LEGENDS: Record<string, { key: string; color: string; shape?: 'ring' | 'box' | 'dash' }[]> = {
  map: [{ key: 'trees', color: '#f2c94c', shape: 'box' }],
  twin: [{ key: 'trees', color: '#f2c94c', shape: 'box' }],
  detect: [{ key: 'trees', color: '#f2c94c', shape: 'box' }],
  health: [
    { key: 'healthy', color: HEALTH_COLOR.ok, shape: 'ring' },
    { key: 'stress', color: HEALTH_COLOR.watch },
  ],
  yield: [{ key: 'yield', color: '#f2c94c' }],
  water: [
    { key: 'wet', color: '#4896e6', shape: 'dash' },
    { key: 'low', color: '#f08c32', shape: 'dash' },
  ],
  copilot: [
    { key: 'stress', color: HEALTH_COLOR.watch },
    { key: 'low', color: '#f08c32', shape: 'dash' },
  ],
}

const bracket = (r: number, len = r * 0.45) =>
  [
    `M${-r},${-r + len}V${-r}H${-r + len}`,
    `M${r - len},${-r}H${r}V${-r + len}`,
    `M${r},${r - len}V${r}H${r - len}`,
    `M${-r + len},${r}H${-r}V${r - len}`,
  ].join('')

const { hero, features, canvas, journey } = journeyMessages
const pct = new Intl.NumberFormat('tr-TR', { style: 'percent' })

/** Animasyon bittikten sonra hero sabit kalırken misyonun üstüne kayması için ek kaydırma (vh) */
const OVERLAY_SCROLL_VH = 1
const PIN_AT = TOTAL_LEN - 0.06

export function JourneyHero() {
  const sectionRef = useRef<HTMLElement>(null)
  const stickyRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLDivElement>(null)
  const scanRef = useRef<HTMLDivElement>(null)
  const shadeRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const countRef = useRef<HTMLSpanElement>(null)
  const introRef = useRef<HTMLDivElement>(null)
  const hintRef = useRef<HTMLDivElement>(null)
  const lineRefs = useRef<(HTMLParagraphElement | null)[]>([])
  const stepRefs = useRef<(HTMLElement | null)[]>([])
  const uiRef = useRef<HTMLDivElement>(null)
  const videoProgress = useRef(0)

  const [stop, setStop] = useState(-1)
  const [photoReady, setPhotoReady] = useState(false)
  const onFirstFrame = useCallback(() => setPhotoReady(true), [])

  const stopDef = stop >= 0 ? STOPS[stop] : null
  const focus = stopDef?.focus
  const card =
    stopDef && stopDef.key in journey.cards
      ? journey.cards[stopDef.key as keyof typeof journey.cards]
      : undefined
  const step = stopDef?.step !== undefined ? features.steps[stopDef.step] : null
  const legend = stopDef ? LEGENDS[stopDef.key] : null

  const firstFrame = `${journeySite.heroSequence.desktop.path}${'1'.padStart(journeySite.heroSequence.pad, '0')}.${journeySite.heroSequence.desktop.ext}`
  const master = journeySite.orchardMaster

  useEffect(() => {
    const link = document.createElement('link')
    link.rel = 'preload'
    link.as = 'image'
    link.href = firstFrame
    document.head.appendChild(link)
    return () => {
      document.head.removeChild(link)
    }
  }, [firstFrame])

  useEffect(() => {
    const section = sectionRef.current
    const stage = stageRef.current
    const world = worldRef.current
    if (!section || !stage || !world) return

    let raf = 0
    let lastStop = -2
    let lastCount = -1

    const render = () => {
      raf = 0
      const vh = window.innerHeight
      const W = stage.clientWidth
      const H = stage.clientHeight
      const mobile = W < 768
      const s = Math.max(0, -section.getBoundingClientRect().top / vh)
      const pinned = s >= PIN_AT
      stickyRef.current?.classList.toggle('journey-sticky--pinned', pinned)
      const animS = Math.min(s, TOTAL_LEN)
      const f = frameAt(animS)

      if (uiRef.current) {
        uiRef.current.style.opacity = pinned ? '0' : '1'
        uiRef.current.style.visibility = pinned ? 'hidden' : 'visible'
      }
      if (shadeRef.current) {
        shadeRef.current.style.opacity = pinned ? '0' : '1'
      }
      if (cardRef.current && pinned) {
        cardRef.current.style.opacity = '0'
        cardRef.current.style.visibility = 'hidden'
      }

      videoProgress.current = f.video
      const v = videoRef.current
      if (v) {
        v.style.opacity = String(1 - f.videoOut)
        v.style.transform = `scale(${1 + f.videoOut * 0.6})`
        v.style.filter = f.videoOut > 0.01 ? `blur(${f.videoOut * 10}px)` : ''
        v.style.visibility = f.videoOut >= 1 ? 'hidden' : 'visible'
      }

      const cam = mobile ? mobileCam(f.cam) : f.cam
      const { k, tx, ty } = camTransform(cam, W, H, mobile && f.stop >= 1)
      world.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${k})`

      const scanScreen = f.scan * H
      const scanImg = Math.min(1, Math.max(0, (scanScreen - ty) / k / IMG_H))
      world.style.setProperty('--scan', f.scan >= 1 ? '2' : scanImg.toFixed(4))
      const L = f.layers
      world.style.setProperty('--rings', L.rings.toFixed(3))
      world.style.setProperty('--ids', L.ids.toFixed(3))
      world.style.setProperty('--health', L.health.toFixed(3))
      world.style.setProperty('--yield', L.yield.toFixed(3))
      world.style.setProperty('--water', L.water.toFixed(3))
      world.style.setProperty('--grade', L.grade.toFixed(3))
      world.style.setProperty('--k', k.toFixed(4))
      const sl = scanRef.current
      if (sl) {
        const on = f.scan > 0 && f.scan < 1
        sl.style.opacity = on ? '1' : '0'
        sl.style.transform = `translateY(${scanScreen}px)`
      }

      const count = f.scan >= 1 ? TREES.length : TREES.filter((tr) => tr.y / IMG_H < scanImg).length
      if (count !== lastCount && countRef.current) {
        countRef.current.textContent = String(count)
        lastCount = count
      }
      uiRef.current?.style.setProperty('--chip', String(Math.min(1, f.scan * 6) * (f.stop < 1 ? 1 : 0)))

      if (introRef.current) {
        introRef.current.style.opacity = String(f.intro)
        introRef.current.style.transform = `translateY(${(1 - f.intro) * -30}px)`
        introRef.current.style.visibility = f.intro <= 0 ? 'hidden' : 'visible'
      }
      if (hintRef.current) hintRef.current.style.opacity = String(Math.max(0, 1 - s / 0.15))
      lineRefs.current.forEach((el, i) => {
        if (!el) return
        const o = f.lines[i] ?? 0
        el.style.opacity = String(o)
        el.style.transform = `translateY(${(1 - o) * 16}px)`
      })
      stepRefs.current.forEach((el, i) => {
        if (!el) return
        const o = i === (f.stop >= 0 ? STOPS[f.stop].step : undefined) ? f.stepIn : 0
        el.style.opacity = String(o)
        el.style.transform = `translateY(${(1 - o) * 24}px)`
        el.style.visibility = o <= 0 ? 'hidden' : 'visible'
      })

      const c = cardRef.current
      if (c) {
        const st = f.stop >= 0 ? STOPS[f.stop] : null
        const tr = st?.focus
        const show = tr && st && st.key !== 'copilot' ? f.focusIn : 0
        c.style.opacity = String(show)
        c.style.visibility = show <= 0 ? 'hidden' : 'visible'
        if (tr && show > 0) {
          const sx = tx + tr.x * k
          const sy = ty + tr.y * k
          const r = TREE_R * k * 1.15
          const cw = c.offsetWidth
          const ch = c.offsetHeight
          let x: number
          let y: number
          if (mobile) {
            x = (W - cw) / 2
            y = sy + r + 10
          } else {
            x = sx + r + 22
            y = sy - ch / 2
            if (x + cw > W - 16) {
              x = Math.min(W - cw - 16, sx - cw / 2)
              y = sy + r + 14
            }
          }
          y = Math.min(H - ch - 12, Math.max(mobile ? 118 : 80, y))
          c.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y + (1 - show) * 10)}px, 0)`
        }
      }

      if (f.stop !== lastStop) {
        lastStop = f.stop
        setStop(f.stop)
      }
    }

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(render)
    }
    render()
    requestAnimationFrame(render)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    const ro = new ResizeObserver(onScroll)
    ro.observe(stage)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      ro.disconnect()
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  useLayoutEffect(() => {
    window.dispatchEvent(new Event('scroll'))
  }, [stop])

  useLayoutEffect(() => {
    window.dispatchEvent(new Event('scroll'))
  }, [])

  return (
    <section
      ref={sectionRef}
      className="bahce-journey journey"
      id="top"
      aria-label={hero.title}
      style={{ height: `${(TOTAL_LEN + OVERLAY_SCROLL_VH) * 100}vh` }}
    >
      <div className="journey-sticky" ref={stickyRef}>
        <div
          className="journey-stage"
          ref={stageRef}
          style={{ backgroundImage: `url(${firstFrame})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
        >
          <div className="j-world" ref={worldRef} style={{ width: IMG_W, height: IMG_H }}>
            <picture>
              <source media="(max-width: 767px)" srcSet={master.small} />
              <img src={master.large} width={IMG_W} height={IMG_H} alt="" decoding="async" fetchPriority="low" />
            </picture>
            <div className="j-grade" />
            <svg className="j-svg" viewBox={`0 0 ${IMG_W} ${IMG_H}`} aria-hidden="true">
              <g className="j-water">
                {ROW_Y.map((y, i) => (
                  <g key={i} style={{ color: moistureColor(ROW_MOISTURE[i]) }}>
                    <line x1={0} x2={IMG_W} y1={y + 6} y2={y + 6} className="j-drip" />
                    <g
                      className="j-fixed"
                      style={{ ['--x' as string]: `${MOIST_X}px`, ['--y' as string]: `${y - TREE_R + 4}px` }}
                    >
                      <rect x={-62} y={-30} width={124} height={28} rx={14} className="j-pill" />
                      <circle cx={-46} cy={-16} r={5} fill="currentColor" />
                      <text x={-34} y={-11} className="j-pill-text">
                        {canvas.moisture} {pct.format(ROW_MOISTURE[i] / 100)}
                      </text>
                    </g>
                  </g>
                ))}
              </g>

              <g className="j-health">
                {TREES.map((tr) => (
                  <circle
                    key={tr.id}
                    cx={tr.x}
                    cy={tr.y}
                    r={TREE_R * 0.9}
                    className={`j-h j-h-${tr.health}`}
                    style={{ color: HEALTH_COLOR[tr.health] }}
                  />
                ))}
              </g>

              <g className="j-rings">
                {TREES.map((tr) => (
                  <path
                    key={tr.id}
                    d={bracket(TREE_R * 1.05)}
                    transform={`translate(${tr.x} ${tr.y})`}
                    style={{ ['--ty' as string]: (tr.y + TREE_R) / IMG_H }}
                  />
                ))}
              </g>

              <g className="j-ids">
                {TREES.map((tr) => (
                  <g
                    key={tr.id}
                    className="j-fixed"
                    style={{ ['--x' as string]: `${tr.x}px`, ['--y' as string]: `${tr.y + TREE_R}px` }}
                  >
                    <text y={14} textAnchor="middle">
                      {tr.id.slice(3)}
                    </text>
                  </g>
                ))}
              </g>

              <g className="j-yield">
                {TREES.map((tr) => (
                  <g
                    key={tr.id}
                    className="j-fixed"
                    style={{ ['--x' as string]: `${tr.x}px`, ['--y' as string]: `${tr.y}px` }}
                  >
                    <rect
                      x={-24}
                      y={-12}
                      width={48}
                      height={24}
                      rx={12}
                      className={tr.id === FOCUS_TREES.fruit.id ? 'is-focus' : undefined}
                    />
                    <text y={5} textAnchor="middle">
                      {fruitCount(tr)}
                    </text>
                  </g>
                ))}
              </g>

              {focus && (
                <g key={focus.id} className="j-focus" transform={`translate(${focus.x} ${focus.y})`}>
                  <circle r={TREE_R * 1.25} className="j-focus-halo" />
                  <path d={bracket(TREE_R * 1.2, TREE_R * 0.5)} />
                </g>
              )}
            </svg>
          </div>

          <div className="j-video" ref={videoRef}>
            <img
              className={`j-poster${photoReady ? ' j-poster--done' : ''}`}
              src={firstFrame}
              alt=""
              fetchPriority="high"
              decoding="async"
            />
            <FrameSequence
              desktop={journeySite.heroSequence.desktop}
              mobile={journeySite.heroSequence.mobile}
              pad={journeySite.heroSequence.pad}
              progressRef={videoProgress}
              from={0}
              to={1}
              className="j-frames"
              onFirstFrame={onFirstFrame}
              idle={0.22}
            />
          </div>

          <div className="j-scanline" ref={scanRef} />
          <div className="j-shade" ref={shadeRef} />

          <div className="j-card" ref={cardRef} aria-hidden={!card}>
            {card && (
              <>
                <p className="j-card-title">
                  <i style={{ background: stopDef?.key === 'health' ? HEALTH_COLOR.watch : '#f2c94c' }} />
                  {card.title}
                </p>
                <dl>
                  {card.rows.map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
              </>
            )}
          </div>
        </div>

        <div className="j-ui" ref={uiRef}>
          <div className="j-chip">
            <span ref={countRef}>0</span> {journey.detected}
          </div>

          <div className="j-intro container" ref={introRef}>
            <p className="eyebrow">{hero.eyebrow}</p>
            <h1>{hero.title}</h1>
            <p className="lead">{hero.subtitle}</p>
            <div className="actions">
              <Link className="btn btn-primary" to="/register">
                {hero.cta}
              </Link>
              <a className="btn btn-ghost" href="#misyon">
                {hero.secondary}
              </a>
            </div>
          </div>

          <div className="j-lines" aria-hidden="true">
            {hero.transition.map((line, i) => (
              <p
                key={i}
                className="hero-line"
                ref={(el) => {
                  lineRefs.current[i] = el
                }}
                style={{ opacity: 0 }}
              >
                <span className="hero-line-num">0{i + 1}</span>
                {line}
              </p>
            ))}
          </div>

          <div className="j-steps container">
            {features.steps.map((s, i) => (
              <article
                key={i}
                className="j-step"
                ref={(el) => {
                  stepRefs.current[i] = el
                }}
                style={{ opacity: 0, visibility: 'hidden' }}
              >
                <p className="j-step-tag">
                  <span>{String(i + 1).padStart(2, '0')}</span> {s.tag}
                </p>
                <h2>{s.title}</h2>
                <p>{s.body}</p>
              </article>
            ))}
          </div>

          {step?.question && (
            <div className="copilot j-copilot" key={stop}>
              <p className="copilot-q">{step.question}</p>
              <p className="copilot-a">{step.answer}</p>
            </div>
          )}

          {legend && (
            <div className="j-foot">
              <ul className="stage-legend j-legend">
                {legend.map((l, i) => (
                  <li key={i}>
                    <i className={`sw sw-${l.shape ?? 'fill'}`} style={{ ['--c' as string]: l.color }} />
                    {canvas.legend[l.key as keyof typeof canvas.legend]}
                  </li>
                ))}
              </ul>
              <p className="j-note">{features.sampleNote}</p>
            </div>
          )}

          <div className="scroll-hint" ref={hintRef}>
            <span>{hero.scroll}</span>
            <i aria-hidden="true" />
          </div>
        </div>
      </div>
      <div id="features" className="j-anchor" style={{ top: `${(INTRO_LEN + STOPS[0].len + 0.5) * 100}vh` }} />
    </section>
  )
}
