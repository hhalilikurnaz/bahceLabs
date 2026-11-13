import type { ReactNode } from 'react'
import { ErrorState } from '@/components/ui'
import { DURUM_META } from './izlemeBicim'


/** Yükleniyor / hata / içerik: üç iç sekme de aynı kalıbı kullanır. */
export function Yuklenir<T>({ q, baslik, children }: { q: { isLoading: boolean; isError: boolean; error: unknown; data: T | undefined; refetch: () => unknown }; baslik: string; children: (d: T) => ReactNode }) {
  if (q.isLoading) return <p role="status" className="p-2">Yükleniyor…</p>
  if (q.isError || !q.data) return <ErrorState title={`${baslik} alınamadı`} error={q.error} onRetry={() => void q.refetch()} />
  return <>{children(q.data)}</>
}

export function DurumEtiketi({ durum }: { durum: string }) {
  const m = DURUM_META[durum] ?? { ad: durum, isaret: '○', sinif: 'text-app-text-muted', hucre: '' }
  return <span className={`whitespace-nowrap font-semibold ${m.sinif}`}><span aria-hidden>{m.isaret} </span>{m.ad}</span>
}
