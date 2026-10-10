import { useIndexView } from '../../hooks/useIndexView'
import { INDEX_DEFS, formatIndexValue, gradientCss, TRUE_COLOR } from '../../lib/indices'
import { useBahcemStore } from '../../stores/bahcemStore'

const KIND_LABEL = { mutlak: 'Mutlak skala', kontrastli: 'Kontrastlı (p2–p98)', fark: 'Değişim', gercek: '' } as const

/** Haritadaki görüntünün etiketi (indeks · tarih) ve moda göre renk lejantı. */
export function IndexLegend() {
  const { shown, katman } = useIndexView()
  const info = useBahcemStore((s) => s.renderInfo)
  const panelOpen = useBahcemStore((s) => s.leftPanelOpen)
  if (!shown || !info) return null

  const def = info.indeks ? INDEX_DEFS[info.indeks] : null
  const showScale = info.kind !== 'gercek' && def !== null
  const ticks = [0, 1 / 3, 2 / 3, 1].map((t) => info.vmin + (info.vmax - info.vmin) * t)
  const fmt = (v: number) =>
    info.kind === 'fark'
      ? `${v > 0 ? '+' : ''}${v.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`
      : formatIndexValue(info.indeks ?? 'ndvi', v)

  return (
    <div
      className={`surface-dark absolute bottom-[7.75rem] left-[4.25rem] z-20 w-72 rounded-xl border border-app-border bg-app-panel px-3 py-2.5 shadow-xl transition-[left] duration-300 ease-out ${
        panelOpen ? 'md:left-[27.5rem]' : 'md:left-[4.25rem]'
      }`}
      role="group"
      aria-label="Harita lejantı"
    >
      <p className="break-words text-caption font-medium leading-snug text-app-text" data-testid="map-date-label">
        {info.etiket}
      </p>

      {showScale ? (
        <>
          <div className="mt-2 h-2.5 rounded-full" style={{ background: gradientCss(info.kind === 'fark' ? 'fark' : def.renk) }} />
          <div className="relative mt-1 h-3 text-caption text-app-text-dim">
            {ticks.map((tick, i) => (
              <span
                key={i}
                className="absolute whitespace-nowrap"
                style={{
                  left: `${(i / 3) * 100}%`,
                  // uç etiketler kartın dışına taşmasın
                  transform: i === 0 ? 'none' : i === 3 ? 'translateX(-100%)' : 'translateX(-50%)',
                }}
              >
                {fmt(tick)}
              </span>
            ))}
          </div>
          <p className="mt-2.5 flex justify-between text-caption text-app-text-dim">
            <span>{KIND_LABEL[info.kind]}</span>
            {info.kind === 'fark' && <span>kırmızı: düşüş · yeşil: artış</span>}
          </p>
        </>
      ) : (
        <p className="mt-1 text-caption text-app-text-dim">
          {katman === TRUE_COLOR ? 'Skalasız doğal renkli görüntü' : 'Karşılaştırma: soldaki ve sağdaki görüntü'}
        </p>
      )}
    </div>
  )
}
