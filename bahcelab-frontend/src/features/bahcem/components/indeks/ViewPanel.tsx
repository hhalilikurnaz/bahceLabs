import { useMemo } from 'react'
import { ArrowLeftRight, X } from 'lucide-react'
import { useIndexView } from '../../hooks/useIndexView'
import { formatDate } from '../../lib/dates'
import { INDEX_DEFS, LAYER_OPTIONS, TRUE_COLOR, TRUE_COLOR_LABEL, isIndexId, type LayerId } from '../../lib/indices'
import { findScene, isUsable, referenceDate, usableDates } from '../../lib/scenes'
import { useBahcemStore, type ChangePreset, type DrawStyle, type ViewMode } from '../../stores/bahcemStore'

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  disabledReason,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  disabledReason?: string
}) {
  return (
    <div title={disabledReason}>
      <span className="mb-1 block text-caption font-medium text-app-text-muted">{label}</span>
      <div
        role="radiogroup"
        aria-label={label}
        className={`flex rounded-xl bg-app-bg/70 p-0.5 ${disabledReason ? 'opacity-50' : ''}`}
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            disabled={Boolean(disabledReason)}
            onClick={() => onChange(option.value)}
            className={`h-8 flex-1 rounded-[10px] text-caption font-medium transition-colors focus-visible:outline-2 focus-visible:outline-app-accent ${
              value === option.value ? 'bg-app-card-hover text-app-text shadow' : 'text-app-text-muted hover:text-app-text'
            } disabled:cursor-not-allowed`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

const selectClass =
  'h-9 w-full cursor-pointer rounded-xl border border-app-border bg-app-card px-2.5 text-caption text-app-text outline-none focus:border-app-accent disabled:cursor-not-allowed disabled:opacity-50'

/** Katman (indeks) seçici, görünüm modları, değişim haritası ve karşılaştırma ayarları. */
export function ViewPanel() {
  const { katman, scenes, active } = useIndexView()
  const gorunum = useBahcemStore((s) => s.gorunum)
  const cizim = useBahcemStore((s) => s.cizim)
  const degisim = useBahcemStore((s) => s.degisim)
  const karsilastirma = useBahcemStore((s) => s.karsilastirma)
  const setKatman = useBahcemStore((s) => s.setKatman)
  const setGorunum = useBahcemStore((s) => s.setGorunum)
  const setCizim = useBahcemStore((s) => s.setCizim)
  const setDegisim = useBahcemStore((s) => s.setDegisim)
  const setKarsilastirma = useBahcemStore((s) => s.setKarsilastirma)
  const patchKarsilastirma = useBahcemStore((s) => s.patchKarsilastirma)

  const isIndex = isIndexId(katman)
  const description = katman === TRUE_COLOR ? TRUE_COLOR_LABEL : INDEX_DEFS[katman]
  const gridReady = isIndex && Boolean(active?.indeksler[katman]?.veriVar)

  const dates = useMemo(() => usableDates(scenes, katman), [scenes, katman])
  const gridDates = useMemo(
    () => (scenes ?? []).filter((s) => isIndex && s.indeksler[katman]?.veriVar).map((s) => s.tarih),
    [scenes, katman, isIndex],
  )
  const reference = degisim && active && isIndex ? referenceDate(degisim.preset, active.tarih, gridDates, degisim.tarih) : null

  const contrastReason = !isIndex ? 'Gerçek renk skalasızdır' : !gridReady ? 'Ham veri hazır olunca kullanılabilir' : undefined
  const changeReason = contrastReason

  function startCompare() {
    if (!active) return
    const earlier = [...dates].reverse().find((d) => d < active.tarih) ?? dates.find((d) => d !== active.tarih) ?? null
    setKarsilastirma({ tarihB: earlier, katmanB: katman, bolme: 0.5 })
  }

  const datesB = karsilastirma ? usableDates(scenes, karsilastirma.katmanB) : []

  return (
    <section className="space-y-3 rounded-2xl bg-app-card p-3.5" aria-label="Görünüm">
      <div>
        <span className="mb-1.5 block text-caption font-medium text-app-text-muted">Katman</span>
        <div role="radiogroup" aria-label="Harita katmanı" className="flex flex-wrap gap-1.5">
          {LAYER_OPTIONS.map((option) => {
            const on = option.id === katman
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setKatman(option.id)}
                title={option.kisa}
                className={`h-8 rounded-full border px-3 text-caption font-medium transition-colors focus-visible:outline-2 focus-visible:outline-app-accent ${
                  on
                    ? 'border-app-accent bg-app-accent-soft text-app-accent'
                    : 'border-app-border text-app-text-muted hover:bg-app-card-hover hover:text-app-text'
                }`}
              >
                {option.ad}
              </button>
            )
          })}
        </div>
        <details className="mt-2 group">
          <summary className="cursor-pointer list-none text-caption text-app-text-muted marker:hidden">
            <span className="font-medium text-app-text">{description.kisa}</span>
            <span className="ml-1 text-app-text-dim group-open:hidden">· ayrıntı</span>
          </summary>
          <p className="mt-1.5 text-caption leading-relaxed text-app-text-muted">{description.aciklama}</p>
        </details>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Segmented<ViewMode>
          label="Değer görünümü"
          value={gorunum}
          onChange={setGorunum}
          disabledReason={contrastReason}
          options={[
            { value: 'mutlak', label: 'Mutlak' },
            { value: 'kontrastli', label: 'Kontrastlı' },
          ]}
        />
        <Segmented<DrawStyle>
          label="Çizim"
          value={cizim}
          onChange={setCizim}
          options={[
            { value: 'piksel', label: 'Piksel' },
            { value: 'yumusak', label: 'Yumuşak' },
          ]}
        />
      </div>
      {gorunum === 'kontrastli' && isIndex && (
        <p className="-mt-1 text-caption leading-snug text-app-text-dim">
          Skala, seçili tarihte bahçe içindeki değerlerin p2–p98 aralığına gerilir; bahçe içi farklar belirginleşir.
        </p>
      )}

      <div>
        <label htmlFor="degisim" className="mb-1 block text-caption font-medium text-app-text-muted">
          Değişim haritası
        </label>
        <select
          id="degisim"
          className={selectClass}
          disabled={Boolean(changeReason) || !active}
          title={changeReason}
          value={degisim?.preset ?? ''}
          onChange={(e) => {
            const preset = e.target.value as ChangePreset | ''
            setDegisim(preset ? { preset, tarih: null } : null)
          }}
        >
          <option value="">Kapalı</option>
          <option value="ikihafta">Son 2 hafta</option>
          <option value="gecenyil">Geçen yıl aynı dönem</option>
          <option value="ozel">Tarih seç…</option>
        </select>
        {degisim?.preset === 'ozel' && (
          <select
            aria-label="Karşılaştırılacak önceki tarih"
            className={`${selectClass} mt-1.5`}
            value={degisim.tarih ?? ''}
            onChange={(e) => setDegisim({ preset: 'ozel', tarih: e.target.value || null })}
          >
            <option value="">Tarih seçin</option>
            {gridDates
              .filter((d) => d !== active?.tarih)
              .reverse()
              .map((d) => (
                <option key={d} value={d}>
                  {formatDate(d)}
                </option>
              ))}
          </select>
        )}
        {degisim && active && (
          <p className="mt-1.5 text-caption leading-snug text-app-text-muted" aria-live="polite">
            {reference
              ? `${formatDate(active.tarih)} − ${formatDate(reference)} · kırmızı: düşüş, yeşil: artış`
              : degisim.preset === 'ozel'
                ? 'Karşılaştırılacak tarihi seçin.'
                : 'Bu tarih için uygun karşılaştırma görüntüsü yok.'}
          </p>
        )}
      </div>

      <div>
        {karsilastirma ? (
          <div className="space-y-2 rounded-xl border border-app-border p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-caption font-medium text-app-text">Karşılaştırma</span>
              <button
                type="button"
                onClick={() => setKarsilastirma(null)}
                aria-label="Karşılaştırmayı kapat"
                className="flex h-6 w-6 items-center justify-center rounded-md text-app-text-muted hover:bg-app-card-hover hover:text-app-text"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
            <p className="text-caption text-app-text-dim">
              Sol: {active ? `${description.ad ?? 'Gerçek renk'} · ${formatDate(active.tarih)}` : '—'}. Sağ tarafı seçin; ortadaki sürgüyle kaydırın.
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              <select
                aria-label="Sağ görüntünün katmanı"
                className={selectClass}
                value={karsilastirma.katmanB}
                onChange={(e) => {
                  const katmanB = e.target.value as LayerId
                  const stillValid = (scenes ?? []).some((s) => s.tarih === karsilastirma.tarihB && isUsable(s, katmanB))
                  patchKarsilastirma({ katmanB, tarihB: stillValid ? karsilastirma.tarihB : null })
                }}
              >
                {LAYER_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.ad}
                  </option>
                ))}
              </select>
              <select
                aria-label="Sağ görüntünün tarihi"
                className={selectClass}
                value={karsilastirma.tarihB ?? ''}
                onChange={(e) => patchKarsilastirma({ tarihB: e.target.value || null })}
              >
                <option value="">Tarih seçin</option>
                {[...datesB].reverse().map((d) => (
                  <option key={d} value={d}>
                    {formatDate(d)}
                  </option>
                ))}
              </select>
            </div>
            {karsilastirma.tarihB && !findScene(scenes, karsilastirma.tarihB) && (
              <p className="text-caption text-app-danger">Seçilen tarih bulunamadı.</p>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={startCompare}
            disabled={!active || dates.length < 2}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-app-border text-caption font-medium text-app-text transition-colors hover:bg-app-card-hover focus-visible:outline-2 focus-visible:outline-app-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ArrowLeftRight className="h-4 w-4" aria-hidden />
            Karşılaştır (sürgü)
          </button>
        )}
      </div>
    </section>
  )
}
