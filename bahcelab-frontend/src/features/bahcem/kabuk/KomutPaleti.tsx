import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGardens } from '../api/useGardens'
import { useCalismaStore } from '../calisma/calismaStore'
import { ara, komutlar, type Komut } from './komutlar'
import { useTema } from './tema'

/** ⌘K: bahçe ara + kural tabanlı komutlar (Asistan'ın LLM kısmı Adım 16'da). */
export function KomutPaleti({ open, onClose, seciliBahce }: { open: boolean; onClose: () => void; seciliBahce: string | null }) {
  // Her açılışta temiz başlasın: içerik yeniden kurulur
  return open ? <Palet onClose={onClose} seciliBahce={seciliBahce} /> : null
}

function Palet({ onClose, seciliBahce }: { onClose: () => void; seciliBahce: string | null }) {
  const [q, setQ] = useState('')
  const [i, setI] = useState(0)
  const navigate = useNavigate()
  const { data: gardens } = useGardens()
  const setKatman = useCalismaStore((s) => s.setKatman)
  const { degistir } = useTema()
  const list = useMemo(() => ara(komutlar({ bahceler: (gardens ?? []).map((g) => ({ id: g.id, ad: g.ad })), seciliBahce }), q).slice(0, 8), [gardens, seciliBahce, q])

  const run = (k: Komut | undefined) => {
    if (!k) return
    const e = k.eylem
    if (e.tur === 'git') navigate(e.yol)
    else if (e.tur === 'katman') {
      setKatman(e.katman)
      if (seciliBahce) navigate(`/bahceler/${seciliBahce}`)
    } else degistir()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/25 pt-[14vh]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Ara veya sor" className="glass w-[560px] max-w-[calc(100vw-24px)] overflow-hidden" data-testid="komut-paleti">
        <div className="flex items-center gap-2.5 border-b border-app-border px-3.5">
          <Search className="h-4 w-4 text-app-text-muted" aria-hidden />
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setI(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setI((v) => Math.min(list.length - 1, v + 1))
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault()
                setI((v) => Math.max(0, v - 1))
              }
              if (e.key === 'Enter') run(list[i])
              if (e.key === 'Escape') onClose()
            }}
            placeholder="Bahçe adı ya da komut: “zayıf bölgeleri göster”"
            aria-label="Komut ya da bahçe ara"
            className="h-12 flex-1 bg-transparent text-[14px] outline-none placeholder:text-app-text-dim"
          />
        </div>
        <ul role="listbox" className="max-h-[50vh] overflow-y-auto p-1.5">
          {list.length === 0 && <li className="px-3 py-3 text-[13px] text-app-text-muted">Eşleşen komut yok. Serbest soru Asistan'da (Adım 16).</li>}
          {list.map((k, n) => (
            <li key={k.id} role="option" aria-selected={n === i}>
              <button type="button" onMouseEnter={() => setI(n)} onClick={() => run(k)} className={`flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-[13.5px] ${n === i ? 'bg-app-card-hover' : ''}`}>
                <span className="font-semibold">{k.baslik}</span>
                <span className="text-[11.5px] text-app-text-muted">{k.ipucu}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
