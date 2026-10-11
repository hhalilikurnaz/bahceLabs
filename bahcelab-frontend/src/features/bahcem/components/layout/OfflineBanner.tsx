import { useQueryClient } from '@tanstack/react-query'
import { WifiOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui'

/** İnternet kesilince üstte anlaşılır uyarı; bağlantı gelince kendiliğinden kapanır ve veriler yenilenir. «Tekrar dene» elle yeniler. */
export function OfflineBanner() {
  const client = useQueryClient()
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))

  useEffect(() => {
    const on = () => {
      setOnline(true)
      void client.refetchQueries({ type: 'active' })
    }
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [client])

  if (online) return null
  return (
    <div
      role="alert"
      data-testid="offline-banner"
      className="surface-dark absolute left-1/2 top-3 z-40 flex w-[min(34rem,calc(100%-1.5rem))] -translate-x-1/2 items-center gap-3 rounded-lg border border-app-warn/50 bg-app-panel px-3.5 py-2.5 shadow-e3"
    >
      <WifiOff className="h-5 w-5 shrink-0 text-app-warn" aria-hidden />
      <p className="min-w-0 flex-1 text-small text-app-text">İnternet bağlantısı yok. Son yüklenen bilgiler gösteriliyor; bağlantı gelince yenilenecek.</p>
      <Button onClick={() => setOnline(navigator.onLine)}>Tekrar dene</Button>
    </div>
  )
}
