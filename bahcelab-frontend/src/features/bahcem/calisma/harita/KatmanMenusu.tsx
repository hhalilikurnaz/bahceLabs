import { ChevronDown, Layers } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useMultiyear } from '../../api/multiyearApi'
import { useIndices } from '../../api/indeksApi'
import { gunAy, kaynakSatiri } from '../../lib/format'
import { RAMPS, ZONE_SHADES, rampGradient } from '../../lib/paletler'
import { isUsable } from '../../lib/scenes'
import { useCalismaStore } from '../calismaStore'
import { KATMANLAR, KATMAN_SIRASI, type KatmanId } from '../katmanlar'

function Ornek({ id }: { id: KatmanId }) {
  const t = KATMANLAR[id]
  const bg = t.ramp ? rampGradient(RAMPS[t.ramp]) : `linear-gradient(90deg, ${ZONE_SHADES[1]} 0 33%, ${ZONE_SHADES[2]} 33% 66%, ${ZONE_SHADES[3]} 66%)`
  return <span aria-hidden className="block h-3 w-8 shrink-0 rounded-[3px] border border-black/10" style={{ background: bg }} />
}

/** Sol üst: gruplu katman menüsü (kaynak, çözünürlük, tarih, durum) + eş değer çizgisi + opaklık. */
export function KatmanMenusu({ gardenId }: { gardenId: string }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const { katman, setKatman, kontur, setKontur, opaklik, setOpaklik } = useCalismaStore()
  const { data } = useIndices(gardenId)
  const multi = useMultiyear(gardenId).data
  const aktif = KATMANLAR[katman]

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  const durum = (id: KatmanId): { tarih: string | null; hazir: boolean; not: string } => {
    const t = KATMANLAR[id]
    if (id === 'bolgeler') {
      const ok = multi?.durum === 'hazir'
      return { tarih: null, hazir: ok, not: ok ? (multi?.yil_araligi ?? '') : multi?.durum === 'islem_suruyor' ? 'işleniyor' : 'analiz yok' }
    }
    const usable = (data?.gozlemler ?? []).filter((s) => t.indeks && isUsable(s, t.indeks))
    const son = usable[usable.length - 1]
    return { tarih: son?.tarih ?? null, hazir: Boolean(son), not: son ? `son ${gunAy(son.tarih)}` : data?.isleme ? 'işleniyor' : 'görüntü yok' }
  }

  return (
    <div ref={box} className="relative" data-testid="katman-menusu">
      <div className="glass flex items-center gap-1 p-1">
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="listbox" className="flex h-10 max-[560px]:h-11 items-center gap-2.5 rounded-md px-2.5 text-left hover:bg-app-card-hover">
          <Layers className="h-4 w-4 text-app-text-muted" aria-hidden />
          <Ornek id={katman} />
          <span className="leading-tight">
            <b className="block text-[13px] font-bold">{aktif.ad}</b>
            <span className="num block text-[10.5px] text-app-text-muted">{kaynakSatiri([aktif.kaynak, aktif.cozunurluk])}</span>
          </span>
          <ChevronDown className={`h-4 w-4 text-app-text-muted transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
        </button>
        {katman !== 'bolgeler' && (
          <>
            <label className="flex h-10 cursor-pointer items-center max-[560px]:hidden gap-2 rounded-md px-2.5 text-[12.5px] font-medium hover:bg-app-card-hover">
              <input type="checkbox" checked={kontur} onChange={(e) => setKontur(e.target.checked)} className="h-4 w-4 accent-[var(--color-app-text)]" disabled={katman === 'degisim'} />
              Eş değer çizgisi
            </label>
            <label className="flex h-10 items-center gap-2 px-2.5 text-[12.5px] font-medium max-[560px]:hidden">
              Opaklık
              <input type="range" min={0.3} max={1} step={0.05} value={opaklik} onChange={(e) => setOpaklik(Number(e.target.value))} className="w-20 max-[560px]:h-11 accent-[var(--color-app-text)]" aria-label="Katman opaklığı" />
            </label>
          </>
        )}
      </div>
      {open && (
        <div role="listbox" aria-label="Katmanlar" className="glass absolute left-0 top-[52px] z-30 w-[380px] max-w-[calc(100vw-40px)] p-1.5">
          {(['Bitki', 'Analiz'] as const).map((grup) => (
            <div key={grup}>
              <div className="px-2 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-[.08em] text-app-text-dim">{grup}</div>
              {KATMAN_SIRASI.filter((id) => KATMANLAR[id].grup === grup).map((id) => {
                const t = KATMANLAR[id]
                const d = durum(id)
                return (
                  <button
                    key={id}
                    role="option"
                    aria-selected={id === katman}
                    data-testid={`katman-${id}`}
                    onClick={() => {
                      setKatman(id)
                      setOpen(false)
                    }}
                    className={`grid w-full grid-cols-[32px_minmax(0,1fr)_auto_8px] items-center gap-2.5 rounded-md px-2 py-2 text-left hover:bg-app-card-hover ${id === katman ? 'bg-[color-mix(in_srgb,var(--color-app-primary)_18%,transparent)]' : ''} ${d.hazir ? '' : 'opacity-60'}`}
                  >
                    <Ornek id={id} />
                    <span className="min-w-0">
                      <b className="block text-[13px]">{t.ad}</b>
                      <span className="block text-[11.5px] leading-snug text-app-text-muted">{t.anlam}</span>
                    </span>
                    <span className="num text-right text-[10px] leading-[1.35] text-app-text-muted">
                      {t.kaynak}
                      <br />
                      {t.cozunurluk} · {d.not}
                    </span>
                    <span aria-label={d.hazir ? 'hazır' : 'veri yok'} className={`h-2 w-2 rounded-full ${d.hazir ? 'bg-app-success' : 'bg-app-border-strong'}`} />
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
