import { InstagramIcon, LinkedInIcon } from './SocialBrandIcons'

const LINKEDIN_URL = 'https://www.linkedin.com/company/bah%C3%A7elab/'
const INSTAGRAM_URL = 'https://www.instagram.com/bahcelabteknoloji/'

/** Sosyal bağlantılar yalnız footer'da (üst çubukta değil). */
export function MarketingSocialLinks() {
  const iconClass = 'size-4 shrink-0 text-mk-muted transition-colors group-hover:text-mk-ink'
  const linkClass =
    'group inline-flex min-h-6 items-center gap-1.5 text-small text-mk-muted no-underline transition-colors hover:text-mk-ink'

  return (
    <div className="flex flex-col items-start gap-2" aria-label="Sosyal medya">
      <a href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
        <LinkedInIcon className={iconClass} />
        <span>LinkedIn · BahçeLab</span>
      </a>
      <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
        <InstagramIcon className={iconClass} />
        <span>Instagram · bahcelabteknoloji</span>
      </a>
    </div>
  )
}
