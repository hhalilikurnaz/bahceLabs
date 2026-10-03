import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FrameSequence } from './FrameSequence'
import { journeyMessages } from './journeyMessages'
import { journeySite } from './journeySite'
import { heroPosterUrl } from './journeyMedia'
import './journey.css'

const { hero } = journeyMessages

/** Tek ekran: başlık + idle drone; tur krem bölümde */
export function JourneyHero() {
  const videoProgress = useRef(0)
  const [photoReady, setPhotoReady] = useState(false)
  const [posterFrame, setPosterFrame] = useState(() => heroPosterUrl(false))
  const onFirstFrame = useCallback(() => setPhotoReady(true), [])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const sync = () => setPosterFrame(heroPosterUrl(mq.matches))
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    const link = document.createElement('link')
    link.rel = 'preload'
    link.as = 'image'
    link.href = posterFrame
    document.head.appendChild(link)
    return () => {
      document.head.removeChild(link)
    }
  }, [posterFrame])

  return (
    <section
      className="bahce-journey journey journey-hero-short"
      id="top"
      aria-label={`${hero.titleLine1} ${hero.titleLine2}`}
    >
      <div
        className="journey-stage journey-hero-short-stage"
        style={{ backgroundImage: `url(${posterFrame})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
      >
        <div className="j-video">
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
        <div className="j-shade" />
      </div>

      <div className="j-ui journey-hero-short-ui">
        <div className="j-intro container">
          <p className="eyebrow">{hero.eyebrow}</p>
          <h1>
            {hero.titleLine1}
            <br />
            {hero.titleLine2}
          </h1>
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

        <div className="scroll-hint journey-hero-short-hint">
          <span>{hero.scroll}</span>
          <i aria-hidden="true" />
        </div>
      </div>
    </section>
  )
}
