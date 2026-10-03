import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { FrameSequence } from './FrameSequence'
import { journeyMessages } from './journeyMessages'
import { journeySite } from './journeySite'
import { heroPosterUrl } from './journeyMedia'
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

/** Krem misyon şeridinin içinde: tur yalnızca kutu üzerinde kaydırıldığında ilerler */
export function JourneyTourEmbed() {
  const frameRef = useRef<HTMLDivElement>(null)
  const animSRef = useRef(0)
  const stageRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLDivElement>(null)
  const scanRef = useRef<HTMLDivElement>(null)
  const shadeRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const countRef = useRef<HTMLSpanElement>(null)
  const hintRef = useRef<HTMLDivElement>(null)
  const lineRefs = useRef<(HTMLParagraphElement | null)[]>([])
  const stepRefs = useRef<(HTMLElement | null)[]>([])
  const uiRef = useRef<HTMLDivElement>(null)
  const videoProgress = useRef(0)
  const renderSceneRef = useRef<() => void>(() => {})

  const [stop, setStop] = useState(-1)
  const [tourEnded, setTourEnded] = useState(false)
  const [frameActive, setFrameActive] = useState(false)
  const [photoReady, setPhotoReady] = useState(false)
  const [posterFrame, setPosterFrame] = useState(() => heroPosterUrl(false))
  const posterFrameRef = useRef(posterFrame)
  posterFrameRef.current = posterFrame
  const onFirstFrame = useCallback(() => setPhotoReady(true), [])

  const replayTour = useCallback(() => {
    animSRef.current = 0
    setTourEnded(false)
    setStop(-1)
    renderSceneRef.current()
  }, [])

  const stopDef = stop >= 0 ? STOPS[stop] : null
  const focus = stopDef?.focus
  const card =
    stopDef && stopDef.key in journey.cards
      ? journey.cards[stopDef.key as keyof typeof journey.cards]
      : undefined
  const step = stopDef?.step !== undefined ? features.steps[stopDef.step] : null
  const legend = stopDef ? LEGENDS[stopDef.key] : null

  const master = journeySite.orchardMaster

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const sync = () => setPosterFrame(heroPosterUrl(mq.matches))
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    const frame = frameRef.current
    const stage = stageRef.current
    const world = worldRef.current
    if (!frame || !stage || !world) return

    let raf = 0
    let lastStop = -2
    let lastCount = -1
    let lastEnded = false
    const touchMq = window.matchMedia('(max-width: 767px)')
    let touching = false
    let lastTouchY = 0

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(render)
    }

    const bumpAnim = (deltaY: number) => {
      const vh = window.innerHeight
      animSRef.current = Math.min(TOTAL_LEN, Math.max(0, animSRef.current + deltaY / vh))
      schedule()
    }

    const shouldPassScrollToPage = (deltaY: number) => {
      const s = animSRef.current
      return (s <= 0 && deltaY < 0) || (s >= TOTAL_LEN && deltaY > 0)
    }

    const onWheel = (e: WheelEvent) => {
      if (shouldPassScrollToPage(e.deltaY)) return
      e.preventDefault()
      bumpAnim(e.deltaY)
    }

    const onTouchStart = (e: TouchEvent) => {
      if (!touchMq.matches || e.touches.length !== 1) return
      touching = true
      lastTouchY = e.touches[0].clientY
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!touchMq.matches || !touching || e.touches.length !== 1) return
      const dy = lastTouchY - e.touches[0].clientY
      lastTouchY = e.touches[0].clientY
      if (shouldPassScrollToPage(dy)) return
      e.preventDefault()
      bumpAnim(dy)
    }

    const onTouchEnd = () => {
      touching = false
    }

    frame.addEventListener('wheel', onWheel, { passive: false })
    frame.addEventListener('touchstart', onTouchStart, { passive: true })
    frame.addEventListener('touchmove', onTouchMove, { passive: false })
    frame.addEventListener('touchend', onTouchEnd)
    frame.addEventListener('touchcancel', onTouchEnd)

    const render = () => {
      raf = 0
      const W = stage.clientWidth
      const H = stage.clientHeight
      const mobile = W < 768
      const animS = animSRef.current
      const f = frameAt(animS)

      videoProgress.current = f.video
      const v = videoRef.current
      if (v) {
        v.style.opacity = String(1 - f.videoOut)
        if (mobile) {
          v.style.transform = 'none'
          v.style.filter = ''
        } else {
          v.style.transform = `scale(${1 + f.videoOut * 0.6})`
          v.style.filter = f.videoOut > 0.01 ? `blur(${f.videoOut * 10}px)` : ''
        }
        v.style.visibility = f.videoOut >= 1 ? 'hidden' : 'visible'
      }

      if (f.videoOut <= 0) {
        world.style.opacity = '0'
        world.style.visibility = 'hidden'
      } else {
        world.style.opacity = f.videoOut >= 1 ? '1' : String(f.videoOut)
        world.style.visibility = 'visible'
      }

      if (f.videoOut >= 1) {
        stage.style.backgroundImage = 'none'
      } else {
        stage.style.backgroundImage = `url(${posterFrameRef.current})`
        stage.style.backgroundSize = 'cover'
        stage.style.backgroundPosition = 'center'
      }

      const cam = mobile ? mobileCam(f.cam) : f.cam
      const { k, tx, ty } = camTransform(cam, W, H, false)
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

      if (hintRef.current) hintRef.current.style.opacity = String(Math.max(0, 1 - animS / 0.15))

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

      const ended = animS >= TOTAL_LEN - 0.04
      if (ended !== lastEnded) {
        lastEnded = ended
        setTourEnded(ended)
      }
    }

    renderSceneRef.current = render

    const onResize = () => schedule()
    render()
    window.addEventListener('resize', onResize)
    const ro = new ResizeObserver(onResize)
    ro.observe(stage)
    return () => {
      frame.removeEventListener('wheel', onWheel)
      frame.removeEventListener('touchstart', onTouchStart)
      frame.removeEventListener('touchmove', onTouchMove)
      frame.removeEventListener('touchend', onTouchEnd)
      frame.removeEventListener('touchcancel', onTouchEnd)
      window.removeEventListener('resize', onResize)
      ro.disconnect()
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  useLayoutEffect(() => {
    renderSceneRef.current()
  }, [stop])

  return (
    <div id="urun-turu" className="bahce-journey journey-cream-scroll" aria-label="Ürün turu">
      <div className="journey-cream-pin">
        <div className="journey-cream-intro">
          <p className="journey-cream-eyebrow">Ürün turu</p>
          <p className="journey-cream-lead">
            Tur için kaydırarak ilerleyin. Devam etmek için kutunun dışında kaydırın.
          </p>
        </div>

        <div
          ref={frameRef}
          className={`journey-cream-frame${frameActive ? ' journey-cream-frame--active' : ''}${tourEnded ? ' journey-cream-frame--ended' : ''}`}
          onMouseEnter={() => setFrameActive(true)}
          onMouseLeave={() => setFrameActive(false)}
          onFocus={() => setFrameActive(true)}
          onBlur={() => setFrameActive(false)}
          tabIndex={0}
          role="region"
          aria-label="Kaydırmalı ürün turu"
        >
          <div className="journey-sticky journey-cream-sticky">
            {tourEnded && <div className="journey-tour-end-scrim" aria-hidden />}
            <div
              className="journey-stage"
              ref={stageRef}
              style={{ backgroundImage: `url(${posterFrame})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
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
                  src={posterFrame}
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

              {tourEnded && (
                <div className="journey-tour-replay">
                  <button
                    type="button"
                    className="journey-tour-replay-btn"
                    onClick={replayTour}
                    aria-label="Turu yenile"
                  >
                    <RotateCcw strokeWidth={1.75} aria-hidden />
                  </button>
                  <span className="journey-tour-replay-label">Turu yenile</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
