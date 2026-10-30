import { useEffect, useRef, useState } from 'react'
import { camSusun } from '@/lib/cam'
import { Link } from 'react-router-dom'
import { gardenPagePath } from '../../lib/routes'
import { useCalismaStore } from '../calismaStore'
import type { HaritaGorunumu } from '../useHaritaGorunumu'
import { KatmanMenusu } from './KatmanMenusu'
import { TarihKutusu } from './TarihKutusu'

/** ⋯ altında uzman kontrolleri: skala, eş değer çizgisi, opaklık, Geçmiş sayfası. Varsayılan yüzeyde görünmez (tek ray, az kontrol). */
function UzmanKontrolleri({ gardenId, view }: { gardenId: string; view: HaritaGorunumu }) {
  const [acik, setAcik] = useState(false)
  const kap = useRef<HTMLDivElement>(null)
  const { skala, setSkala, kontur, setKontur, opaklik, setOpaklik, katman } = useCalismaStore()
  useEffect(() => {
    if (!acik) return
    const dis = (e: MouseEvent) => { if (kap.current && !kap.current.contains(e.target as Node)) setAcik(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAcik(false) }
    document.addEventListener('mousedown', dis)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', dis); document.removeEventListener('keydown', esc) }
  }, [acik])
  return (
    <div ref={kap} className="relative">
      <button type="button" aria-label="Diğer harita ayarları" aria-expanded={acik} aria-haspopup="menu" data-testid="ray-daha" onClick={() => setAcik(!acik)} className="grid h-11 w-11 place-items-center rounded-md text-lead text-app-text hover:bg-app-card-hover">⋯</button>
      {acik && (
        <div role="menu" data-testid="ray-daha-menu" className="glass absolute right-0 top-[52px] z-30 w-[280px] space-y-3 p-3 m-fade-in">
          <div role="group" aria-label="Renk skalası">
            <p className="mb-1 text-caption font-semibold text-app-text-muted">Renk skalası</p>
            <div className="flex gap-1">
              {(['genel', 'kendi'] as const).map((k) => (
                <button key={k} type="button" aria-pressed={skala === k} onClick={() => setSkala(k)} className={`min-h-9 flex-1 rounded-md border px-2 text-small font-semibold ${skala === k ? 'border-app-primary bg-app-primary text-app-on-primary' : 'border-app-border-strong bg-transparent text-app-text hover:bg-app-card-hover'}`}>{k === 'kendi' ? 'Bahçenin kendi farkları' : 'Mutlak skala'}</button>
              ))}
            </div>
            {view.skala.gerilmis && view.skala.aralik !== null && <p className="mt-1 text-caption text-app-text-muted">Gerilmiş skala uygulanıyor.</p>}
          </div>
          {katman !== 'bolgeler' && (
            <>
              <label className="flex min-h-9 cursor-pointer items-center gap-2 text-small font-medium">
                <input type="checkbox" checked={kontur} onChange={(e) => setKontur(e.target.checked)} disabled={view.tanim.fark === true} className="h-4 w-4 accent-[var(--color-app-primary)]" />
                Eş değer çizgisi
              </label>
              <label className="flex min-h-9 items-center justify-between gap-2 text-small font-medium">
                Opaklık
                <input type="range" min={0.3} max={1} step={0.05} value={opaklik} onChange={(e) => setOpaklik(Number(e.target.value))} className="w-32 accent-[var(--color-app-primary)]" aria-label="Katman opaklığı" />
              </label>
            </>
          )}
          <Link to={gardenPagePath(gardenId, 'gecmis')} role="menuitem" data-testid="gecmis-baglantisi" className="flex min-h-11 items-center justify-between rounded-md border-t border-app-border pt-2 text-small font-semibold hover:bg-app-card-hover">Geçmiş sayfası <span aria-hidden>↗</span></Link>
        </div>
      )}
    </div>
  )
}

/** TEK kontrol rayı (cam): katman · tarih ‹ › · ⋯. Haritadaki yüzen kutular burada birleşir; uzman kontrolleri ⋯ altında. */
export function MapRail({ gardenId, view }: { gardenId: string; view: HaritaGorunumu }) {
  return (
    <div onPointerDownCapture={() => camSusun(2500)} className="glass flex max-w-full items-center gap-1 p-1" role="toolbar" aria-label="Harita denetimleri" data-testid="harita-rayi">
      <KatmanMenusu gardenId={gardenId} />
      <span aria-hidden className="mx-0.5 h-7 w-px bg-app-border" />
      <TarihKutusu view={view} />
      <span aria-hidden className="mx-0.5 h-7 w-px bg-app-border" />
      <UzmanKontrolleri gardenId={gardenId} view={view} />
    </div>
  )
}
