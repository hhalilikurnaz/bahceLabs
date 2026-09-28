import { Link } from 'react-router-dom'
import footerWordmark from '@/assets/marketing/bahcelab-footer-wordmark.png'

const MARK_W = 1024
const MARK_H = 341
/** Üst ~%58 görünür; alttan biraz daha kırpılır */
const MARK_VISIBLE_RATIO = 0.58
const MARK_WIDTH = 'min(162vw, 92rem)'

function footerMarkMetrics() {
  const fullHeight = `calc(${MARK_WIDTH} * ${MARK_H} / ${MARK_W})`
  const visibleHeight = `max(calc(${fullHeight} * ${MARK_VISIBLE_RATIO}), clamp(4.75rem, 16vw, 9.25rem))`
  return { visibleHeight }
}

function FooterWordmark() {
  const { visibleHeight } = footerMarkMetrics()

  return (
    <div
      className="pointer-events-none relative -mt-2 w-full overflow-hidden sm:-mt-3"
      style={{ height: visibleHeight }}
      aria-hidden
    >
      <img
        src={footerWordmark}
        alt=""
        draggable={false}
        className="absolute left-1/2 top-0 w-[min(162vw,92rem)] max-w-none -translate-x-1/2 select-none opacity-[0.13] [filter:brightness(0)_saturate(100%)]"
      />
    </div>
  )
}

export function MarketingFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="relative overflow-hidden bg-marketing-cream text-[#4b554c]">
      <div className="relative z-10 mx-auto max-w-6xl px-5 pb-2 pt-3.5 sm:px-8 sm:pb-3 sm:pt-4">
        <p className="text-[12px] leading-relaxed text-[#5c665d]">
          © {year} BahçeLab · Tüm hakları saklıdır.{' '}
          <Link
            to="/blog"
            className="text-[#5c665d] underline decoration-[#0c2418]/20 underline-offset-2 transition-colors hover:text-[#0c2418] hover:decoration-[#0c2418]/40"
          >
            Blog
          </Link>
        </p>
      </div>

      <FooterWordmark />
    </footer>
  )
}
