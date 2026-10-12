import { useEffect, useState } from 'react'
import { Outlet, useMatch } from 'react-router-dom'
import { NotificationToaster } from '../components/notifications/NotificationToaster'
import { OfflineBanner } from '../components/layout/OfflineBanner'
import { ProcessingWatcher } from '../components/layout/ProcessingWatcher'
import { ToastProvider } from '../components/layout/ToastProvider'
import { KomutPaleti } from './KomutPaleti'
import { useTema } from './tema'
import { UstGezinme } from './UstGezinme'

/** Giriş sonrası tüm uygulama: açık tema (koyu seçilebilir), üst gezinme, ⌘K. Tanıtım sayfaları bu kabuğun dışındadır. */
export function UygulamaKabugu() {
  useTema()
  const id = useMatch('/bahceler/:id/*')?.params.id
  const [komut, setKomut] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setKomut((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return (
    <div className="app-shell flex h-dvh min-h-[560px] flex-col overflow-hidden">
      <ToastProvider>
        <UstGezinme onKomut={() => setKomut(true)} />
        <OfflineBanner />
        <ProcessingWatcher />
        <NotificationToaster />
        <main className="flex min-h-0 flex-1 flex-col">
          <Outlet />
        </main>
        <KomutPaleti open={komut} onClose={() => setKomut(false)} seciliBahce={id && id !== 'yeni' ? id : null} />
      </ToastProvider>
    </div>
  )
}
