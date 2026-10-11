import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { buildArchiveSearch, parseArchiveSearch, type ArchiveState } from '../lib/archive'

/** Arşiv durumu adres çubuğundadır; değişiklikler adrese yazılır (paylaşılabilir, geri tuşu çalışır). */
export function useArchiveState() {
  const [params, setParams] = useSearchParams()
  const state = useMemo(() => parseArchiveSearch(params), [params])
  const update = useCallback(
    (patch: Partial<ArchiveState>, options: { replace?: boolean } = {}) => {
      setParams(new URLSearchParams(buildArchiveSearch({ ...parseArchiveSearch(params), ...patch })), { replace: options.replace ?? true })
    },
    [params, setParams],
  )
  return { state, update }
}
