import { getApiBaseUrl } from '@/lib/apiClient'
import type { Foto } from '../../api/sahaApi'

/** Fotoğraf küçük resimleri: kimlik doğrulamalı yoldan (çerezle) yüklenir; tıklayınca yeni sekmede tam boy. */
export function FotoSerit({ fotolar }: { fotolar: Foto[] }) {
  if (!fotolar.length) return null
  return (
    <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Fotoğraflar" data-testid="foto-serit">
      {fotolar.map((f, i) => (
        <li key={f.id}>
          <a href={`${getApiBaseUrl()}${f.url}`} target="_blank" rel="noreferrer" aria-label={`Fotoğraf ${i + 1}, tam boy aç`}>
            <img src={`${getApiBaseUrl()}${f.url}`} alt={`Saha fotoğrafı ${i + 1}`} loading="lazy" className="h-14 w-14 border border-[var(--rule-2)] object-cover" />
          </a>
        </li>
      ))}
    </ul>
  )
}
