export function HeroScrollCue() {
  return (
    <a
      href="#misyon"
      className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 rounded-full p-2 text-[#f3efe4]/65 transition-colors hover:text-[#f3efe4]/95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c9f27a]/60"
      aria-label="İçeriğe kaydır"
    >
      <svg
        className="marketing-scroll-cue h-7 w-7"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </a>
  )
}
