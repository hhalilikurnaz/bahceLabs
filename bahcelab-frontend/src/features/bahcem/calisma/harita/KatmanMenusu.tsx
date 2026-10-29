import { ChevronDown, Layers } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useMultiyear } from '../../api/multiyearApi'
import { useEdinimler } from '../../api/edinimApi'
import { useGecmisDoldurma } from '../../api/gecmisApi'
import { useRadarEdinimler } from '../../api/radarApi'
import { useLandsatEdinimler } from '../../api/suApi'
import { gunAy, kaynakSatiri } from '../../lib/format'
import { RAMPS, ZEMIN, ZONE_SHADES, rampGradient } from '../../lib/paletler'
import { useCalismaStore } from '../calismaStore'
import { KATMANLAR, KATMAN_GRUPLARI, KATMAN_SIRASI, type KatmanId } from '../katmanlar'

/** Katman örneği: sürekli renk şeridi; LAI için orantılı kareler; MSAVI için toprak zemin üzerinde tepe daireleri. */
function Ornek({ id }: { id: KatmanId }) {
  const t = KATMANLAR[id]
  if (t.gorunum === 'kareler') {
    return (
      <svg aria-hidden width="32" height="14" viewBox="0 0 32 14" className="shrink-0 rounded-[3px] border border-black/10" style={{ background: ZEMIN.notr }}>
        {[3, 5, 7, 9].map((w, i) => <rect key={w} x={2 + i * 7.5} y={7 - w / 2} width={w} height={w} fill="#4e8750" />)}
      </svg>
    )
  }
  if (t.gorunum === 'daireler') {
    return (
      <svg aria-hidden width="32" height="14" viewBox="0 0 32 14" className="shrink-0 rounded-[3px] border border-black/10" style={{ background: ZEMIN.toprak }}>
        {[2, 3, 4.2, 5.4].map((r, i) => <circle key={r} cx={5 + i * 7.5} cy={7} r={r} fill="#357a43" />)}
      </svg>
    )
  }
  const bg = t.ramp ? rampGradient(RAMPS[t.ramp]) : `linear-gradient(90deg, ${ZONE_SHADES[1]} 0 33%, ${ZONE_SHADES[2]} 33% 66%, ${ZONE_SHADES[3]} 66%)`
  return <span aria-hidden className="block h-3.5 w-8 shrink-0 rounded-[3px] border border-black/10" style={{ background: bg }} />
}

/** Sol üst: gruplu katman menüsü (kaynak, çözünürlük, tarih, durum) + eş değer çizgisi + opaklık. */
export function KatmanMenusu({ gardenId }: { gardenId: string }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const { katman, setKatman, kontur, setKontur, opaklik, setOpaklik, saha, setSaha } = useCalismaStore()
  const { data } = useEdinimler(gardenId)
  const radar = useRadarEdinimler(gardenId).data
  const landsatListe = useLandsatEdinimler(gardenId).data
  const gecmis = useGecmisDoldurma(gardenId).data
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
    if (t.landsat) {
      const liste = landsatListe?.edinimler ?? []
      const son = liste[liste.length - 1]
      return { tarih: son?.tarih ?? null, hazir: Boolean(son), not: son ? `son ${gunAy(son.tarih)}` : 'Landsat verisi yok' }
    }
    if (t.radar) {
      const liste = (radar?.edinimler ?? []).filter((e) => e.birincil && e.izgara)
      const son = liste[liste.length - 1]
      const hazir = t.radar === 'degisim' ? liste.length > 3 : liste.length > 0
      return { tarih: son?.tarih ?? null, hazir, not: hazir && son ? `son ${gunAy(son.tarih)}` : 'radar verisi yok' }
    }
    const usable = (data?.edinimler ?? []).filter((e) => t.gosterge !== null && e.gostergeler[t.gosterge])
    const son = usable[usable.length - 1]
    return { tarih: son?.tarih ?? null, hazir: Boolean(son), not: son ? `son ${gunAy(son.tarih)}` : gecmis?.durum === 'isleniyor' ? 'veri çekiliyor' : 'görüntü yok' }
  }

  return (
    <div ref={box} className="relative" data-testid="katman-menusu">
      <div className="glass flex items-center gap-1 p-1">
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="listbox" className="flex h-10 max-[560px]:h-11 items-center gap-2.5 rounded-md px-2.5 text-left hover:bg-app-card-hover">
          <Layers className="h-4 w-4 text-app-text-muted" aria-hidden />
          <Ornek id={katman} />
          <span className="leading-tight">
            <b className="block text-[13px] font-bold">{aktif.ad}{aktif.deneysel ? ' · deneysel' : ''}</b>
            <span className="num block text-[10.5px] text-app-text-muted">{kaynakSatiri([aktif.kaynak, aktif.cozunurluk])}</span>
          </span>
          <ChevronDown className={`h-4 w-4 text-app-text-muted transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
        </button>
        {katman !== 'bolgeler' && (
          <>
            <label className="flex h-10 cursor-pointer items-center max-[560px]:hidden gap-2 rounded-md px-2.5 text-[12.5px] font-medium hover:bg-app-card-hover">
              <input type="checkbox" checked={kontur} onChange={(e) => setKontur(e.target.checked)} className="h-4 w-4 accent-[var(--color-app-text)]" disabled={aktif.fark === true} />
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
        <div className="glass absolute left-0 top-[52px] z-30 w-[380px] max-w-[calc(100vw-40px)] p-1.5">
          <div role="listbox" aria-label="Katmanlar">
          {KATMAN_GRUPLARI.map((grup) => (
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
                      <b className="block text-[13px]">{t.ad}{t.deneysel && <span className="ml-1.5 rounded-[2px] border border-app-border px-1 text-[9.5px] font-medium text-app-text-dim">deneysel</span>}</b>
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
          <label className="mt-1 flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md border-t border-app-border px-2 pt-2 text-[12.5px] font-medium hover:bg-app-card-hover">
            <input type="checkbox" checked={saha} onChange={(e) => setSaha(e.target.checked)} data-testid="saha-katmani" className="h-4 w-4 accent-[var(--color-app-text)]" />
            <span><b className="block text-[13px]">Saha kayıtları</b><span className="block text-[11.5px] text-app-text-muted">Defterdeki gözlem, ilaçlama, hasat… kayıtları üst katman olarak</span></span>
          </label>
        </div>
      )}
    </div>
  )
}
