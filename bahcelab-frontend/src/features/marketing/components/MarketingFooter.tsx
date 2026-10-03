import { Link } from 'react-router-dom'
import footerWordmark from '@/assets/marketing/bahcelab-logo.png'
import { MarketingSocialLinks } from './MarketingSocialLinks'

const MARK_W = 1024
const MARK_H = 341
/** Yatay marka logosunun tamamı görünsün (1024×341) */
const MARK_VISIBLE_RATIO = 0.72
const MARK_WIDTH = 'min(162vw, 92rem)'

function footerMarkMetrics() {
  const fullHeight = `calc(${MARK_WIDTH} * ${MARK_H} / ${MARK_W})`
  const visibleHeight = `max(calc(${fullHeight} * ${MARK_VISIBLE_RATIO}), clamp(4.75rem, 16vw, 9.25rem))`
  return { visibleHeight }
}

function FooterWordmark({ attached }: { attached: boolean }) {
  const { visibleHeight } = footerMarkMetrics()

  return (
    <div
      className={`pointer-events-none relative -mt-2 overflow-hidden sm:-mt-3 ${
        attached
          ? 'left-1/2 w-screen max-w-none -translate-x-1/2'
          : 'w-full'
      }`}
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

interface MarketingFooterProps {
  /** Son şerit bölümünün içinde; üstteki ince ayırıcı çizgiyi önler */
  attached?: boolean
}

export function MarketingFooter({ attached = false }: MarketingFooterProps) {
  const year = new Date().getFullYear()

  return (
    <footer
      className={
        attached
          ? 'relative overflow-hidden text-[#4b554c]'
          : 'relative overflow-hidden bg-marketing-cream text-[#4b554c]'
      }
    >
      <div
        className={
          attached
            ? 'relative z-10 pb-2 pt-10 sm:pb-3 sm:pt-12'
            : 'relative z-10 mx-auto max-w-6xl px-5 pb-2 pt-3.5 sm:px-8 sm:pb-3 sm:pt-4'
        }
      >
        <p className="text-[12px] leading-relaxed text-[#5c665d]">
          © {year} BahçeLab · Tüm hakları saklıdır.{' '}
          <Link
            to="/blog"
            className="text-[#5c665d] underline decoration-[#0c2418]/20 underline-offset-2 transition-colors hover:text-[#0c2418] hover:decoration-[#0c2418]/40"
          >
            Blog
          </Link>
        </p>
        <MarketingSocialLinks variant="footer" />
      </div>

      <FooterWordmark attached={attached} />
    </footer>
  )
}
