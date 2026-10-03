import { InstagramIcon, LinkedInIcon } from './SocialBrandIcons'

const LINKEDIN_URL = 'https://www.linkedin.com/company/bah%C3%A7elab/'
const INSTAGRAM_URL = 'https://www.instagram.com/bahcelabteknoloji/'

type MarketingSocialLinksProps = {
  variant: 'navbar' | 'footer'
}

export function MarketingSocialLinks({ variant }: MarketingSocialLinksProps) {
  if (variant === 'navbar') {
    const iconClass = 'size-[18px] text-[#f3efe4]/80 transition-colors group-hover:text-[#f3efe4]'
    const linkClass =
      'group inline-flex items-center justify-center rounded-md p-1 no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f3efe4]/50'

    return (
      <div className="flex items-center gap-0.5 sm:gap-1" aria-label="Sosyal medya">
        <a
          href={LINKEDIN_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
          aria-label="BahçeLab LinkedIn"
        >
          <LinkedInIcon className={iconClass} />
        </a>
        <a
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
          aria-label="bahcelabteknoloji Instagram"
        >
          <InstagramIcon className={iconClass} />
        </a>
      </div>
    )
  }

  const iconClass = 'size-4 shrink-0 text-[#5c665d] transition-colors group-hover:text-[#0c2418]'
  const linkClass =
    'group inline-flex items-center gap-1.5 text-[12px] text-[#5c665d] no-underline transition-colors hover:text-[#0c2418]'

  return (
    <div className="mt-2 flex flex-col items-start gap-1.5" aria-label="Sosyal medya">
      <a href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
        <LinkedInIcon className={iconClass} />
        <span>BahçeLab</span>
      </a>
      <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
        <InstagramIcon className={iconClass} />
        <span>bahcelabteknoloji</span>
      </a>
    </div>
  )
}
