import { Cloud, Star } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button, EmptyState, ErrorState, SelectField, Skeleton, Switch, cx } from '@/components/ui'
import { useArchive, type ArchiveScene } from '../../api/archiveApi'
import { ARCHIVE } from '../../lib/config'
import { formatDate, MONTHS_SHORT } from '../../lib/dates'
import { groupByMonth, type ArchiveState } from '../../lib/archive'

interface Props {
  gardenId: string
  state: ArchiveState
  selected: string | null
  /** Karşılaştırma/değişim modunda ikinci tarihi seçme düğmesi görünür */
  pickSecond: boolean
  onChange: (patch: Partial<ArchiveState>) => void
  /** Görünen tarihler (eskiden yeniye); ok tuşu gezinmesi bunu kullanır */
  onDates: (dates: string[]) => void
}

function Thumb({ scene, state, selected, pickSecond, onChange }: { scene: ArchiveScene; state: ArchiveState; selected: boolean; pickSecond: boolean; onChange: Props['onChange'] }) {
  const [failed, setFailed] = useState(false)
  const isB = state.b === scene.tarih
  const cloudy = scene.durum === 'bulutlu'
  return (
    <li className="relative">
      <button
        type="button"
        onClick={() => onChange({ tarih: scene.tarih })}
        aria-pressed={selected}
        aria-label={`${formatDate(scene.tarih)}${scene.bulutOrani != null ? `, bulut yüzde ${Math.round(scene.bulutOrani)}` : ''}${scene.enNet ? ', ayın en net görüntüsü' : ''}${cloudy ? ', bulutlu' : ''}`}
        data-testid="archive-thumb"
        data-date={scene.tarih}
        className={cx(
          'block w-full rounded-md border bg-app-card p-1 text-left transition-colors hover:bg-app-card-hover',
          selected ? 'border-app-accent ring-2 ring-app-accent' : isB ? 'border-app-warn ring-2 ring-app-warn' : 'border-app-border',
        )}
      >
        <span className="relative flex items-center justify-center rounded-sm bg-thumb" style={{ height: ARCHIVE.thumbPx }}>
          {scene.kucukResimUrl && !failed ? (
            <img src={scene.kucukResimUrl} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} className="ndvi-pixelated max-h-full max-w-full object-contain p-1" style={{ height: ARCHIVE.thumbPx }} />
          ) : (
            <Cloud className="h-6 w-6 text-white/60" aria-hidden />
          )}
          {scene.enNet && <Star className="absolute right-1 top-1 h-4 w-4 fill-lemon text-lemon" aria-hidden />}
        </span>
        <span className="tabular mt-1 block text-caption font-semibold text-app-text">{formatDate(scene.tarih).replace(/ \d{4}$/, '')}</span>
        <span className="tabular block text-caption text-app-text-dim">{scene.bulutOrani != null ? `bulut %${Math.round(scene.bulutOrani)}` : '—'}</span>
      </button>
      {pickSecond && !cloudy && (
        <button
          type="button"
          onClick={() => onChange({ b: scene.tarih })}
          aria-pressed={isB}
          aria-label={`${formatDate(scene.tarih)} tarihini ikinci görüntü (B) yap`}
          className={cx('absolute bottom-1.5 right-1.5 flex h-8 min-w-8 items-center justify-center rounded-full border text-caption font-bold', isB ? 'border-app-warn bg-app-warn text-white' : 'border-app-border bg-app-panel text-app-text-muted')}
        >
          B
        </button>
      )}
    </li>
  )
}

/** Sağ taraf: ay ay gruplanmış küçük resim ızgarası, sezon seçici ve «yalnız net görüntüler» filtresi. */
export function ArchiveDates({ gardenId, state, selected, pickSecond, onChange, onDates }: Props) {
  const [page, setPage] = useState(1)
  const query = useArchive(gardenId, state.parametre, state.sezon, page)
  const data = query.data
  const visible = useMemo(() => (data?.sahneler ?? []).filter((s) => (state.net ? s.net : true)), [data, state.net])
  const groups = useMemo(() => groupByMonth(visible), [visible])
  const ascending = useMemo(() => visible.map((s) => s.tarih).sort(), [visible])
  // Üst bileşene görünen tarihleri bildir (ok tuşları aynı listede gezinsin)
  useEffect(() => onDates(ascending), [ascending, onDates])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3" data-testid="archive-dates">
      <div className="flex flex-wrap items-end gap-3">
        <SelectField label="Sezon" value={data?.sezon ?? state.sezon ?? ''} onChange={(e) => { setPage(1); onChange({ sezon: Number(e.target.value) }) }} className="w-36">
          {(data?.sezonlar ?? (state.sezon ? [state.sezon] : [])).map((year) => (
            <option key={year} value={year}>
              {year} sezonu
            </option>
          ))}
        </SelectField>
        <Switch label="Yalnız net görüntüler" checked={state.net} onChange={(net) => onChange({ net })} />
      </div>
      {data && (
        <p className="text-caption text-app-text-dim">
          {data.netSayisi} net · {data.bulutluSayisi} bulutlu görüntü
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {query.isLoading ? (
          <div className="grid grid-cols-3 gap-2" aria-busy>
            {Array.from({ length: 9 }, (_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        ) : query.isError ? (
          <ErrorState title="Görüntü listesi yüklenemedi" description="Bağlantınızı kontrol edip tekrar deneyin." retrying={query.isFetching} onRetry={() => void query.refetch()} />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<Cloud className="h-6 w-6" aria-hidden />}
            title="Bu dönemde net görüntü yok"
            description={state.net && (data?.bulutluSayisi ?? 0) > 0 ? 'Bu sezon yalnızca bulutlu görüntüler var.' : 'Bu sezon için uydu görüntüsü bulunamadı.'}
            actions={state.net && (data?.toplam ?? 0) > 0 ? <Button onClick={() => onChange({ net: false })}>Bulutlu tarihleri göster</Button> : undefined}
          />
        ) : (
          groups.map((group) => (
            <section key={group.ay} aria-label={`${MONTHS_SHORT[Number(group.ay.slice(5)) - 1]} ${group.ay.slice(0, 4)}`} className="mb-4">
              <h3 className="mb-1.5 text-small font-semibold text-app-text">
                {MONTHS_SHORT[Number(group.ay.slice(5)) - 1]} {group.ay.slice(0, 4)}
              </h3>
              <ul className="grid grid-cols-3 gap-2">
                {group.items.map((scene) => (
                  <Thumb key={scene.tarih} scene={scene} state={state} selected={scene.tarih === selected} pickSecond={pickSecond} onChange={onChange} />
                ))}
              </ul>
            </section>
          ))
        )}
        {data && data.sayfaSayisi > 1 && (
          <div className="flex items-center justify-between gap-2 pb-2">
            <Button disabled={page <= 1} onClick={() => setPage(page - 1)}>Önceki</Button>
            <span className="tabular text-small text-app-text-muted">{page} / {data.sayfaSayisi}</span>
            <Button disabled={page >= data.sayfaSayisi} onClick={() => setPage(page + 1)}>Sonraki</Button>
          </div>
        )}
      </div>
    </div>
  )
}
