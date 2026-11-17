import { useEffect, useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'

function scrollWindowToTopInstant() {
  const html = document.documentElement
  const { body } = document
  const previousBehavior = html.style.scrollBehavior

  html.style.scrollBehavior = 'auto'
  html.scrollTop = 0
  body.scrollTop = 0
  window.scrollTo(0, 0)
  html.style.scrollBehavior = previousBehavior
}

/** Her rota değişiminde pencereyi anında en üste alır; adreste `#bölüm` varsa o bölüme kaydırır (sayfa içi bağlantılar: Nasıl çalışır, Özellikler). */
export function ScrollToTopOnNavigate() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual'
    }
  }, [])

  useLayoutEffect(() => {
    if (!hash) scrollWindowToTopInstant()
  }, [pathname, hash])

  useEffect(() => {
    if (!hash) return
    const hedef = document.getElementById(decodeURIComponent(hash.slice(1)))
    if (!hedef) return
    const kare = requestAnimationFrame(() => hedef.scrollIntoView({ block: 'start' }))
    return () => cancelAnimationFrame(kare)
  }, [pathname, hash])

  return null
}
