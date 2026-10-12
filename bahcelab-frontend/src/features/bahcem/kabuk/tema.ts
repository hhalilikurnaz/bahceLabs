import { useCallback, useEffect, useState } from 'react'

export type Tema = 'acik' | 'koyu'
const KEY = 'bahcelab.tema'

function okunan(): Tema | null {
  try {
    const v = window.localStorage.getItem(KEY)
    return v === 'acik' || v === 'koyu' ? v : null
  } catch {
    return null
  }
}

/** Tema: kullanıcı seçtiyse o, seçmediyse sistem tercihi. `html[data-theme]` olarak uygulanır. */
export function useTema() {
  const sistem = (): Tema => (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'koyu' : 'acik')
  const [tema, setTemaState] = useState<Tema>(() => okunan() ?? sistem())
  useEffect(() => {
    document.documentElement.dataset.theme = tema === 'koyu' ? 'dark' : 'light'
  }, [tema])
  const setTema = useCallback((t: Tema) => {
    try {
      window.localStorage.setItem(KEY, t)
    } catch {
      /* yalnız oturum boyunca */
    }
    setTemaState(t)
  }, [])
  return { tema, setTema, degistir: () => setTema(tema === 'koyu' ? 'acik' : 'koyu') }
}
