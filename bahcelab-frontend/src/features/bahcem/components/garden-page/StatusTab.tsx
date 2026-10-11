import { CalendarRange } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, ErrorState, SelectField, Skeleton } from '@/components/ui'
import { describeError } from '../../api/gardensApi'
import { useRefreshIndices } from '../../api/indeksApi'
import { usePhenology, useSeriesForSeasons } from '../../api/agroApi'
import type { Garden } from '../../api/types'
import { useWeather } from '../../api/weatherApi'
import { useIndexView } from '../../hooks/useIndexView'
import { archivePath } from '../../lib/archive'
import { formatDate, shiftDays, todayIstanbul } from '../../lib/dates'
import { INDEX_DEFS, INDEX_IDS, formatIndexValue, isIndexId, type IndexId } from '../../lib/indices'
import { defaultPeriod, periodRange, seasonBoundaries, seasonStartYear, type Band, type PeriodKind } from '../../lib/seasonAxis'
import { WeatherAlertsCard } from '../hava/WeatherAlertsCard'
import { AlertsCard } from '../indeks/AlertsCard'
import { SeriesChartCard } from '../indeks/SeriesChartCard'
import { StatusLine } from '../indeks/StatusLine'
import { TimeChart } from '../indeks/TimeChart'
import { ComingSoonList } from './ComingSoonList'
import { STATUS_ITEMS } from './comingSoonItems'
import { LatestValueCard } from './LatestValueCard'
import { PeriodSelector } from './PeriodSelector'
import { PhenologyEditor } from './PhenologyEditor'
import { RuleBadge } from './RuleBadge'
import { ScoreCard } from './ScoreCard'
import { ProductCard, TodayWeatherCard } from './SummaryCards'
import { TodayCard } from './TodayCard'

const nf = (digits: number) => (v: number) => v.toLocaleString('tr-TR', { maximumFractionDigits: digits })
const mm = nf(0)

/** Durum sekmesi: skor + «Bugün», üç özet kart, ortak zaman eksenli üç grafik (parametre · yağış · GDD), uyarılar. */
export function StatusTab({ garden }: { garden: Garden }) {
  const gardenId = garden.id
  const navigate = useNavigate()
  const { data, scenes, isLoading, isError, isFetching, refetch, active, katman } = useIndexView()
  const refresh = useRefreshIndices(gardenId)
  const weather = useWeather(gardenId)
  const phenology = usePhenology(gardenId)
  const today = todayIstanbul()
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [compare, setCompare] = useState<IndexId | ''>('')
  const [hoverDate, setHoverDate] = useState<string | null>(null)
  const [kind, setKind] = useState<PeriodKind>(() => defaultPeriod(today))
  const [custom, setCustom] = useState({ from: shiftDays(today, -90), to: today })
  const [editing, setEditing] = useState(false)

  const range = useMemo(() => periodRange(kind, today, custom), [kind, today, custom])
  const seasons = useMemo(() => {
    const first = seasonStartYear(range.from)
    const last = seasonStartYear(range.to < today ? range.to : today)
    return Array.from({ length: Math.max(1, last - first + 1) }, (_, i) => first + i).filter((y) => y <= seasonStartYear(today))
  }, [range, today])
  const agro = useSeriesForSeasons(gardenId, seasons)

  const bands = useMemo<Band[]>(
    () => (phenology.data?.evreler ?? []).map((e) => ({ kod: e.kod, ad: e.ad, baslangic: e.baslangic, bitis: e.bitis, ozel: e.ozel })),
    [phenology.data],
  )
  const marks = useMemo(() => seasonBoundaries(range), [range])
  const bandNote = phenology.data?.kural?.durum === 'dogrulanmadi' ? 'ön değer' : undefined

  const indexLayer: IndexId = isIndexId(katman) ? katman : 'ndvi'
  const processing = data?.isleme?.durum === 'bekliyor' || data?.isleme?.durum === 'isleniyor'
  const hasImages = scenes?.some((s) => s.durum === 'tamam') ?? false

  // Büyük özet rakamlar: aralığın son (bugüne kadar) günü
  const lastDay = [...agro.days].reverse().find((d) => d.tarih <= range.to && d.tarih <= today)
  const latestInRange = [...(scenes ?? [])].reverse().find((s) => s.durum === 'tamam' && s.indeksler[indexLayer] && s.tarih >= range.from && s.tarih <= range.to)
  const rainSummary = lastDay
    ? { value: mm(lastDay.yagisBirikimli), unit: 'mm', caption: lastDay.oncekiYagisBirikimli !== null ? `geçen sezon aynı gün: ${mm(lastDay.oncekiYagisBirikimli)} mm` : 'geçen sezon verisi yok' }
    : null
  const gddSummary = lastDay && lastDay.gddBirikimli !== null
    ? { value: mm(lastDay.gddBirikimli), unit: 'GDD', caption: `geçen sezon aynı gün: ${lastDay.oncekiGddBirikimli !== null ? mm(lastDay.oncekiGddBirikimli) : '—'}` }
    : null
  const paramSummary = latestInRange
    ? { value: formatIndexValue(indexLayer, latestInRange.indeksler[indexLayer]?.ortalama), caption: `${formatDate(latestInRange.tarih)} · son net görüntü` }
    : null

  if (isError && !data) {
    return (
      <Card>
        <ErrorState title="Uydu verisi alınamadı" description="İnternet bağlantınızı kontrol edip tekrar deneyin." retrying={isFetching} onRetry={() => void refetch()} />
      </Card>
    )
  }
  if (isLoading || !data) {
    return (
      <div className="space-y-3" aria-label="Uydu verisi yükleniyor" aria-busy>
        <Skeleton className="h-44" />
        <div className="grid grid-cols-1 gap-2 @md:grid-cols-3">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
        <Skeleton className="h-72" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <StatusLine
        data={data}
        refreshing={refresh.isPending}
        onRefresh={() => {
          setRefreshError(null)
          refresh.mutate(undefined, { onError: (err) => setRefreshError(describeError(err)) })
        }}
        refreshError={refreshError}
      />

      <div className="grid grid-cols-1 gap-3 @2xl:grid-cols-2" data-testid="score-today">
        <ScoreCard gardenId={gardenId} />
        <TodayCard gardenId={gardenId} />
      </div>

      <div className="grid grid-cols-1 gap-2 @md:grid-cols-3" data-testid="summary-cards">
        <LatestValueCard indeks={indexLayer} scenes={scenes} loading={false} processing={processing} alerts={data.uyarilar} />
        <ProductCard garden={garden} />
        <TodayWeatherCard gardenId={gardenId} />
      </div>

      {hasImages && (
        <section aria-label="Zaman grafikleri" className="space-y-3" data-testid="charts">
          <Card className="space-y-3 p-3">
            <h3 className="font-display text-h2 text-app-text">Sezon grafikleri</h3>
            <PeriodSelector kind={kind} onKind={setKind} custom={custom} onCustom={setCustom} max={today} />
            <p className="text-caption text-app-text-dim" data-testid="period-label">
              {formatDate(range.from)} – {formatDate(range.to)} · üç grafik aynı zaman eksenindedir
            </p>
          </Card>

          <Card aria-label="Parametre grafiği" data-testid="time-chart" className="space-y-2 p-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h3 className="font-display text-h2 text-app-text" data-testid="chart-title">
                {INDEX_DEFS[indexLayer].ad} – zaman grafiği
              </h3>
              <SelectField label="Karşılaştır" value={compare} onChange={(event) => setCompare(event.target.value as IndexId | '')} className="w-56">
                <option value="">İkinci parametre yok</option>
                {INDEX_IDS.filter((id) => id !== indexLayer).map((id) => (
                  <option key={id} value={id}>
                    {INDEX_DEFS[id].ad}
                  </option>
                ))}
              </SelectField>
            </div>
            <div className="flex flex-col gap-1 @[26rem]:flex-row @[26rem]:gap-3">
              <div className="order-2 min-w-0 flex-1 @[26rem]:order-none">
                <TimeChart
                  scenes={data.gozlemler}
                  indeks={indexLayer}
                  range={range}
                  compare={compare || null}
                  activeDate={active?.tarih ?? null}
                  onSelect={(tarih) => navigate(archivePath(gardenId, { parametre: indexLayer, tarih }))}
                  bands={bands}
                  seasonMarks={marks}
                  bandNote={bandNote}
                  hoverDate={hoverDate}
                  onHoverDate={setHoverDate}
                />
              </div>
              <div className="order-1 flex flex-wrap items-baseline gap-x-2 @[26rem]:order-none @[26rem]:block @[26rem]:w-24 @[26rem]:shrink-0 @[26rem]:self-center @[26rem]:text-right" data-testid="time-chart-summary">
                {paramSummary ? (
                  <>
                    <p className="tabular whitespace-nowrap font-display text-display text-app-text">{paramSummary.value}</p>
                    <p className="text-small font-semibold text-app-text-muted">{INDEX_DEFS[indexLayer].ad}</p>
                    <p className="mt-0.5 text-caption text-app-text-muted">{paramSummary.caption}</p>
                  </>
                ) : (
                  <p className="text-caption text-app-text-dim">Bu dönemde net görüntü yok</p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-app-text-muted">
              <span className="flex items-center gap-1.5">
                <i className="h-0.5 w-4 rounded" style={{ background: INDEX_DEFS[indexLayer].cizgi }} aria-hidden /> Bu dönem
              </span>
              <span className="flex items-center gap-1.5">
                <i className="h-0 w-4 border-t-2 border-dashed" style={{ borderColor: INDEX_DEFS[indexLayer].cizgi }} aria-hidden /> Geçen yıl aynı dönem
              </span>
            </div>
          </Card>

          {agro.loading ? (
            <Skeleton className="h-52" aria-label="Yağış ve sıcaklık serisi yükleniyor" />
          ) : agro.error ? (
            <Card>
              <ErrorState title="Yağış ve GDD serisi alınamadı" description={describeError(agro.error)} retrying={false} onRetry={() => window.location.reload()} />
            </Card>
          ) : (
            <>
              <SeriesChartCard
                testId="rain-chart"
                title="Birikmiş yağış"
                summary={rainSummary}
                days={agro.days}
                pick={(d) => ({ current: d.yagisBirikimli, previous: d.oncekiYagisBirikimli })}
                color="var(--color-app-water)"
                unit="mm"
                format={(v) => `${mm(v)} mm`}
                range={range}
                bands={bands}
                seasonMarks={marks}
                bandNote={bandNote}
                hoverDate={hoverDate}
                onHoverDate={setHoverDate}
                emptyText="Bu dönem için yağış verisi yok"
                note={<p className="mt-1 text-caption text-app-text-dim">Sezon başından (1 Ekim) birikmiş; kaynak: hava servisi geçmiş analizi.</p>}
              />
              <SeriesChartCard
                testId="gdd-chart"
                title="Etkili sıcaklık toplamı (GDD)"
                summary={gddSummary}
                days={agro.days}
                pick={(d) => ({ current: d.gddBirikimli, previous: d.oncekiGddBirikimli })}
                color="var(--color-app-warn)"
                unit="GDD"
                format={(v) => mm(v)}
                range={range}
                bands={bands}
                seasonMarks={marks}
                bandNote={bandNote}
                hoverDate={hoverDate}
                onHoverDate={setHoverDate}
                emptyText={agro.latest && agro.latest.gddTabanC === null ? 'Bu ürün için GDD tabanı tanımlı değil' : 'Bu dönem için sıcaklık verisi yok'}
                note={
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-caption text-app-text-dim">
                    {agro.latest?.gddTabanC != null && <span>Taban {agro.latest.gddTabanC.toLocaleString('tr-TR')} °C · günlük max(0, (Tmax+Tmin)/2 − taban)</span>}
                    <RuleBadge meta={agro.latest?.gddKural ?? null} />
                  </div>
                }
              />
              {agro.series.flatMap((s) => s.notlar).length > 0 && (
                <p className="px-1 text-caption text-app-text-dim" data-testid="series-notes">
                  {[...new Set(agro.series.flatMap((s) => s.notlar))].join(' ')}
                </p>
              )}
            </>
          )}

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 px-1 text-caption text-app-text-muted" data-testid="phenology-note">
              {phenology.data?.kuralYok ? (
                <span>Bu ürün için fenoloji kuralı tanımlı değil; evre bantları gösterilmiyor.</span>
              ) : (
                <>
                  <span>Arka plandaki bantlar fenoloji evreleridir{garden.cesitKodu ? '' : ' (çeşit seçilmediğinden ürün değerleri)'}.</span>
                  <RuleBadge meta={phenology.data?.kural ?? null} />
                </>
              )}
            </div>
            {phenology.data && !phenology.data.kuralYok && (
              <>
                <Button icon={<CalendarRange className="h-4 w-4" aria-hidden />} onClick={() => setEditing((v) => !v)} aria-expanded={editing}>
                  {editing ? 'Evre tarihlerini gizle' : 'Evre tarihlerini düzenle'}
                </Button>
                {editing && <PhenologyEditor gardenId={gardenId} phenology={phenology.data} />}
              </>
            )}
          </div>
        </section>
      )}

      <AlertsCard alerts={data.uyarilar} />
      <WeatherAlertsCard alerts={weather.data?.uyarilar ?? []} quiet />
      <ComingSoonList heading="Yakında" items={STATUS_ITEMS} />
    </div>
  )
}
