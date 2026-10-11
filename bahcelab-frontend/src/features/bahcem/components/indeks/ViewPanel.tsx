import { useMemo } from 'react'
import { ArrowLeftRight, X } from 'lucide-react'
import { Button, IconButton, SelectField, Segmented } from '@/components/ui'
import { useIndexView } from '../../hooks/useIndexView'
import { formatDate } from '../../lib/dates'
import { LAYER_OPTIONS, isIndexId, layerName, type LayerId } from '../../lib/indices'
import { findScene, isUsable, referenceDate, usableDates } from '../../lib/scenes'
import { useBahcemStore, type ChangePreset, type DrawStyle, type ViewMode } from '../../stores/bahcemStore'

/** Harita görünümü: skala, çizim, değişim haritası ve karşılaştırma (7B-2'de Görüntü Arşivi'ne taşınacak). */
export function ViewPanel() {
  const { katman, scenes, active } = useIndexView()
  const gorunum = useBahcemStore((s) => s.gorunum)
  const cizim = useBahcemStore((s) => s.cizim)
  const degisim = useBahcemStore((s) => s.degisim)
  const karsilastirma = useBahcemStore((s) => s.karsilastirma)
  const setGorunum = useBahcemStore((s) => s.setGorunum)
  const setCizim = useBahcemStore((s) => s.setCizim)
  const setDegisim = useBahcemStore((s) => s.setDegisim)
  const setKarsilastirma = useBahcemStore((s) => s.setKarsilastirma)
  const patchKarsilastirma = useBahcemStore((s) => s.patchKarsilastirma)

  const isIndex = isIndexId(katman)
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
    <section className="space-y-4" aria-label="Harita görünümü">
      <div className="space-y-3">
        <div title={contrastReason}>
          <span className="mb-1 block text-small font-semibold text-app-text">Renk skalası</span>
          <Segmented<ViewMode>
            label="Renk skalası"
            value={gorunum}
            onChange={setGorunum}
            className={`w-full ${contrastReason ? 'pointer-events-none opacity-50' : ''}`}
            options={[
              { value: 'mutlak', label: 'Genel skala' },
              { value: 'kontrastli', label: 'Bahçenin kendi farkları' },
            ]}
          />
        </div>
        <div>
          <span className="mb-1 block text-small font-semibold text-app-text">Görüntü</span>
          <Segmented<DrawStyle>
            label="Görüntü çizimi"
            value={cizim}
            onChange={setCizim}
            className="w-full"
            options={[
              { value: 'piksel', label: 'Ham' },
              { value: 'yumusak', label: 'Yumuşatılmış' },
            ]}
          />
        </div>
      </div>
      {gorunum === 'kontrastli' && isIndex && (
        <p className="text-small text-app-text-dim">
          Renkler bu bahçenin o tarihteki değer aralığına göre gerilir; bahçe içindeki farklar belirginleşir.
        </p>
      )}

      <div className="space-y-2">
        <SelectField
          label="Değişim haritası"
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
        </SelectField>
        {degisim?.preset === 'ozel' && (
          <SelectField
            label="Karşılaştırılacak önceki tarih"
            hideLabel
            value={degisim.tarih ?? ''}
            onChange={(e) => setDegisim({ preset: 'ozel', tarih: e.target.value || null })}
          >
            <option value="">Tarih seçin</option>
            {[...gridDates]
              .filter((d) => d !== active?.tarih)
              .reverse()
              .map((d) => (
                <option key={d} value={d}>
                  {formatDate(d)}
                </option>
              ))}
          </SelectField>
        )}
        {degisim && active && (
          <p className="text-small text-app-text-muted" aria-live="polite">
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
          <div className="space-y-2 rounded-md border border-app-border p-3">
            <div className="flex items-center justify-between">
              <span className="text-small font-semibold text-app-text">Karşılaştırma</span>
              <IconButton label="Karşılaştırmayı kapat" onClick={() => setKarsilastirma(null)}>
                <X className="h-4 w-4" aria-hidden />
              </IconButton>
            </div>
            <p className="text-small text-app-text-muted">
              Sol: {active ? `${layerName(katman)} · ${formatDate(active.tarih)}` : '—'}. Sağ tarafı seçin; ortadaki sürgüyle kaydırın.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <SelectField
                label="Sağ görüntünün parametresi"
                hideLabel
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
              </SelectField>
              <SelectField
                label="Sağ görüntünün tarihi"
                hideLabel
                value={karsilastirma.tarihB ?? ''}
                onChange={(e) => patchKarsilastirma({ tarihB: e.target.value || null })}
              >
                <option value="">Tarih seçin</option>
                {[...datesB].reverse().map((d) => (
                  <option key={d} value={d}>
                    {formatDate(d)}
                  </option>
                ))}
              </SelectField>
            </div>
            {karsilastirma.tarihB && !findScene(scenes, karsilastirma.tarihB) && (
              <p className="text-small text-app-danger">Seçilen tarih bulunamadı.</p>
            )}
          </div>
        ) : (
          <Button
            block
            onClick={startCompare}
            disabled={!active || dates.length < 2}
            icon={<ArrowLeftRight className="h-4 w-4" aria-hidden />}
          >
            İki tarihi karşılaştır
          </Button>
        )}
      </div>
    </section>
  )
}
