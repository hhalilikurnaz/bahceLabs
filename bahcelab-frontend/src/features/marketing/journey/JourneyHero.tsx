import { forwardRef, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { buttonClass } from '@/components/ui'
import { journeyMessages } from './journeyMessages'
import { journeySite } from './journeySite'
import { IMG_H, IMG_W, ROW_Y, TOTAL_LEN, TREES, TREE_R, camTransform, frameAt, mobileCam } from './journeyTimeline'
import './journey.css'

const { hero, steps, legend, note } = journeyMessages

const bracket = (r: number, len = r * 0.45) =>
  [`M${-r},${-r + len}V${-r}H${-r + len}`, `M${r - len},${-r}H${r}V${-r + len}`, `M${r},${r - len}V${r}H${r - len}`, `M${-r + len},${r}H${-r}V${r - len}`].join('')

/** Sayfa içeriği hero'nun üstüne kayarken (main: -mt-[100dvh]) son durak okunabilir kalsın: içerik ancak TOTAL_LEN - 0.3'te görünmeye başlar.
 *  İçerik bölümün sonundan 1 ekran içeri girdiği için ek kaydırma = 1 (kayma) + 1 (kapsama) - 0.3 */
const OVERLAY_SCROLL_VH = 1.7
const FADE_FROM = TOTAL_LEN - 0.35 // arayüz (metin, düğme) içerik yaklaşırken yumuşakça solar
const PIN_AT = TOTAL_LEN - 0.06
const HOW_LINK = { pathname: '/', hash: '#nasil-calisir' }

const reducedMotionQuery = '(prefers-reduced-motion: reduce)'
function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(reducedMotionQuery)
      mq.addEventListener('change', cb)
      return () => mq.removeEventListener('change', cb)
    },
    () => window.matchMedia(reducedMotionQuery).matches,
    () => false,
  )
}

/** LCP öğesi: animasyonsuz, ilk karede görünen fotoğraf. İlk boyamayı index.html'deki statik kabuk (#boot) yapar; bu görsel aynı dosyayı (önbellekten) kullanır. */
const HeroImage = forwardRef<HTMLImageElement, { className?: string }>(function HeroImage({ className }, ref) {
  const h = journeySite.hero
  return <img ref={ref} src={h.src} srcSet={h.srcSet} sizes="100vw" width={h.width} height={h.height} alt="" decoding="async" fetchPriority="high" className={className} />
})

/** React'in hero görseli çözümlenince index.html'deki statik ilk kareyi (#boot) kaldırır: iki kare arasında boş çerçeve olmaz. */
function useBootKaldir(img: React.RefObject<HTMLImageElement | null>) {
  useLayoutEffect(() => {
    const boot = document.getElementById('boot')
    if (!boot) return
    const kaldir = () => boot.remove()
    const el = img.current
    if (!el) return kaldir()
    let iptal = false
    const sonra = () => !iptal && kaldir()
    if (el.complete) el.decode().then(sonra, sonra)
    else el.addEventListener('load', () => el.decode().then(sonra, sonra), { once: true })
    return () => {
      iptal = true
    }
  }, [img])
}

function IntroText() {
  return (
    <>
      <p className="eyebrow">{hero.eyebrow}</p>
      <h1>
        {hero.titleLine1}
        <br />
        {hero.titleLine2}
      </h1>
      <p className="lead">{hero.subtitle}</p>
      <div className="actions">
        <Link className={buttonClass({ variant: 'onDark', size: 'lg' })} to="/register">
          {hero.cta}
        </Link>
        <Link className={buttonClass({ variant: 'outlineOnDark', size: 'lg' })} to={HOW_LINK}>
          {hero.secondary}
        </Link>
      </div>
    </>
  )
}

/** prefers-reduced-motion: kaydırmalı sahne yok; tek statik görsel + başlık ve düğmeler. */
function StaticHero() {
  const imgRef = useRef<HTMLImageElement>(null)
  useBootKaldir(imgRef)
  return (
    <section className="journey journey-static" id="top" aria-label={`${hero.titleLine1} ${hero.titleLine2}`}>
      <HeroImage ref={imgRef} />
      <div className="j-shade" style={{ opacity: 1 }} />
      <div className="j-ui">
        <div className="j-intro">
          <IntroText />
        </div>
      </div>
    </section>
  )
}

function ScrollHero() {
  const sectionRef = useRef<HTMLElement>(null)
  const stickyRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const scanRef = useRef<HTMLDivElement>(null)
  const shadeRef = useRef<HTMLDivElement>(null)
  const introRef = useRef<HTMLDivElement>(null)
  const hintRef = useRef<HTMLDivElement>(null)
  const uiRef = useRef<HTMLDivElement>(null)
  const stepRefs = useRef<(HTMLElement | null)[]>([])
  const imgRef = useRef<HTMLImageElement>(null)
  const [stop, setStop] = useState(-1)
  useBootKaldir(imgRef)

  useEffect(() => {
    const section = sectionRef.current
    const stage = stageRef.current
    const world = worldRef.current
    if (!section || !stage || !world) return

    let raf = 0
    let lastStop = -2

    const render = () => {
      raf = 0
      const vh = window.innerHeight
      const W = stage.clientWidth
      const H = stage.clientHeight
      const mobile = W < 768
      const s = Math.max(0, -section.getBoundingClientRect().top / vh)
      const pinned = s >= PIN_AT
      stickyRef.current?.classList.toggle('journey-sticky--pinned', pinned)
      const f = frameAt(Math.min(s, TOTAL_LEN))

      if (uiRef.current) {
        const solma = 1 - Math.min(1, Math.max(0, (s - FADE_FROM) / 0.3))
        uiRef.current.style.opacity = String(solma)
        uiRef.current.style.visibility = solma <= 0 ? 'hidden' : 'visible'
      }
      if (shadeRef.current) shadeRef.current.style.opacity = pinned ? '0' : '1'

      const { k, tx, ty } = camTransform(mobile ? mobileCam(f.cam) : f.cam, W, H)
      world.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${k})`

      const scanScreen = f.scan * H
      const scanImg = Math.min(1, Math.max(0, (scanScreen - ty) / k / IMG_H))
      world.style.setProperty('--scan', f.scan >= 1 ? '2' : scanImg.toFixed(4))
      world.style.setProperty('--rings', f.layers.rings.toFixed(3))
      world.style.setProperty('--zones', f.layers.zones.toFixed(3))
      world.style.setProperty('--water', f.layers.water.toFixed(3))
      world.style.setProperty('--grade', f.layers.grade.toFixed(3))
      world.style.setProperty('--k', k.toFixed(4))
      const sl = scanRef.current
      if (sl) {
        const on = f.scan > 0 && f.scan < 1
        sl.style.opacity = on ? '1' : '0'
        sl.style.transform = `translateY(${scanScreen}px)`
      }

      if (introRef.current) {
        introRef.current.style.opacity = String(f.intro)
        introRef.current.style.transform = `translateY(${(1 - f.intro) * -30}px)`
        introRef.current.style.visibility = f.intro <= 0 ? 'hidden' : 'visible'
      }
      if (hintRef.current) hintRef.current.style.opacity = String(Math.max(0, 1 - s / 0.15))
      stepRefs.current.forEach((el, i) => {
        if (!el) return
        const o = i === f.stop ? f.stepIn : 0
        el.style.opacity = String(o)
        el.style.transform = `translateY(${(1 - o) * 24}px)`
        el.style.visibility = o <= 0 ? 'hidden' : 'visible'
      })

      if (f.stop !== lastStop) {
        lastStop = f.stop
        setStop(f.stop)
      }
    }

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(render)
    }
    render()
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

  const showLegend = stop === 1

  return (
    <section ref={sectionRef} className="journey" id="top" aria-label={`${hero.titleLine1} ${hero.titleLine2}`} style={{ height: `${(TOTAL_LEN + OVERLAY_SCROLL_VH) * 100}vh` }}>
      <div className="journey-sticky" ref={stickyRef}>
        <div className="journey-stage" ref={stageRef}>
          <div className="j-world" ref={worldRef} style={{ width: IMG_W, height: IMG_H }}>
            <HeroImage ref={imgRef} />
            <div className="j-grade" />
            <svg className="j-svg" viewBox={`0 0 ${IMG_W} ${IMG_H}`} aria-hidden="true">
              <g className="j-water">
                {ROW_Y.map((y) => (
                  <line key={y} x1={0} x2={IMG_W} y1={y + 6} y2={y + 6} className="j-drip" />
                ))}
              </g>
              <g className="j-zones">
                {TREES.map((t) => (
                  <circle key={`${t.x}-${t.y}`} cx={t.x} cy={t.y} r={TREE_R * 0.92} className={`j-z-${t.zone}`} />
                ))}
              </g>
              <g className="j-rings">
                {TREES.map((t) => (
                  <path key={`${t.x}-${t.y}`} d={bracket(TREE_R * 1.05)} transform={`translate(${t.x} ${t.y})`} style={{ ['--ty' as string]: (t.y + TREE_R) / IMG_H }} />
                ))}
              </g>
            </svg>
          </div>
          <div className="j-scanline" ref={scanRef} />
          <div className="j-shade" ref={shadeRef} />
        </div>

        <div className="j-ui" ref={uiRef}>
          <div className="j-intro" ref={introRef}>
            <IntroText />
          </div>

          <div className="j-steps">
            {steps.map((s, i) => (
              <article
                key={s.tag}
                className="j-step"
                ref={(el) => {
                  stepRefs.current[i] = el
                }}
                style={{ opacity: 0, visibility: 'hidden' }}
                aria-hidden={stop !== i}
              >
                <p className="j-step-tag">
                  <span>{String(i + 1).padStart(2, '0')}</span> {s.tag}
                </p>
                <h2>{s.title}</h2>
                <p>{s.body}</p>
              </article>
            ))}
          </div>

          {stop >= 0 && (
            <div className="j-foot">
              {showLegend && (
                <ul className="j-legend" aria-label="Bölge renkleri (anlatım)">
                  <li><i style={{ ['--c' as string]: 'var(--color-mk-ok)' }} />{legend.ok}</li>
                  <li><i style={{ ['--c' as string]: 'var(--color-mk-mid)' }} />{legend.mid}</li>
                  <li><i style={{ ['--c' as string]: 'var(--color-mk-weak)' }} />{legend.weak}</li>
                </ul>
              )}
              <p className="j-note">{note}</p>
            </div>
          )}

          <div className="scroll-hint" ref={hintRef}>
            <span>{hero.scroll}</span>
            <i aria-hidden="true" />
          </div>
        </div>
      </div>
    </section>
  )
}

export function JourneyHero() {
  return useReducedMotion() ? <StaticHero /> : <ScrollHero />
}
