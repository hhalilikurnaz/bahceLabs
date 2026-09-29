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

/** Her rota değişiminde pencereyi anında en üste alır (önceki sayfadaki scroll konumu taşınmaz). */
export function ScrollToTopOnNavigate() {
  const { pathname } = useLocation()

  useEffect(() => {
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual'
    }
  }, [])

  useLayoutEffect(() => {
    scrollWindowToTopInstant()
  }, [pathname])

  return null
}
