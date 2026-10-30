import { Link, useNavigate } from 'react-router-dom'
import type { Garden } from '../../api/types'
import { useGardenStatus, type StatusBilesen } from '../../api/agroApi'
import { StaleBadge } from '@/components/chart'
import { ErrorState } from '@/components/ui'
import { TodayCard } from '../../components/garden-page/TodayCard'
import { KADEME_META, seviyeMeta, type Kademe } from '../../lib/kademe'
import { gardenPath } from '../../lib/routes'
import { useEdinimler } from '../../api/edinimApi'
import { useRadarDegisimler, useRadarEdinimler } from '../../api/radarApi'
import { eskiOptikSatiri } from '../../lib/radarSerit'
import { useCalismaStore } from '../calismaStore'
import type { KatmanId } from '../katmanlar'
import { durumKarar, riskCumlesi } from '../../lib/karar'
import { useKonum } from '../useKonum'
import { GecmisCekiliyor } from './GecmisCekiliyor'
import { Akordeon, Akordeonlar, IkincilKart, KararBlogu, PanelKabuk } from './parcalar'
import { GostergeCubuklari } from './GostergeCubuklari'
import { SezonEgrisi } from './SezonEgrisi'
import { KademeSeridi } from './KademeSeridi'
import { NasilHesaplandi } from './NasilHesaplandi'

/** Çipe dokununca açılacak yer: harita katmanı (aynı sayfada) ya da sekme. */
const HEDEF: Record<StatusBilesen['kod'], { katman?: KatmanId; sekme?: 'su' }> = {
  agac_gucu: { katman: 'canlilik' },
  su: { sekme: 'su' },
  beslenme: { katman: 'klorofil' },
  ani_degisim: { katman: 'degisim' },
  isi: { katman: 'yuzeySicakligi' },
}
const EYLEM: Record<StatusBilesen['kod'], string> = {
  agac_gucu: 'Canlılık katmanını haritada aç',
  su: 'Su sekmesini aç',
  beslenme: 'Klorofil (beslenme) katmanını haritada aç',
  ani_degisim: 'Değişim katmanını haritada aç',
  isi: 'Yüzey sıcaklığı katmanını haritada aç',
}

/** Durum sekmesi (Yön C): karar cümlesi → tek büyük sayı («Normal» ya da «−%8») → sezon çizgisi → Yapılacaklar (AÇIK) → diğer göstergeler → ayrıntı akordeonları. */
export function DurumPaneli({ garden }: { garden: Garden }) {
  const { data, isLoading, isError, error, refetch, isFetching } = useGardenStatus(garden.id)
  const kademe: Kademe | null = data && data.durum !== 'veri_yok' ? data.durum : null
  const navigate = useNavigate()
  const setKatman = useCalismaStore((s) => s.setKatman)
  const setTarih = useCalismaStore((s) => s.setTarih)
  const konum = useKonum(garden.id)
  const edinim = useEdinimler(garden.id).data
  const radar = useRadarEdinimler(garden.id).data
  const olaylar = useRadarDegisimler(garden.id).data
  const sonOptik = edinim?.edinimler[edinim.edinimler.length - 1]?.tarih ?? null
  const eskiOptik = eskiOptikSatiri(new Date().toISOString().slice(0, 10), sonOptik, radar?.edinimler, olaylar?.degisimler)
  const ac = (kod: StatusBilesen['kod']) => {
    const hedef = HEDEF[kod]
    if (hedef.sekme) {
      void navigate(gardenPath(garden.id, hedef.sekme))
      return
    }
    if (hedef.katman) {
      setKatman(hedef.katman)
      setTarih(null)
      document.querySelector('[data-testid="harita-paneli"]')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }
  const karar = data ? (konum.konum ? durumKarar(konum.konum) : kademe ? data.ozet : 'Bahçe durumu için veri yetersiz.') : null
  const riskC = data ? riskCumlesi(data.riskler) : ''
  const alt = data && kademe && kademe !== 'iyi' ? (riskC && data.riskSinirladi ? `İzlemede: ${riskC.charAt(0).toLowerCase()}${riskC.slice(1)}` : data.ozet) : null
  return (
    <PanelKabuk karar={karar} testId="durum-paneli-ic">
      <GecmisCekiliyor gardenId={garden.id} />
      {isLoading ? (
        <div className="m-skeleton space-y-3 rounded-md border border-app-border bg-app-card p-5" aria-label="Durum yükleniyor" role="status">
          <div className="h-8 w-4/5 rounded bg-app-card-hover" /><div className="h-4 w-3/5 rounded bg-app-card-hover" /><div className="h-14 w-2/5 rounded bg-app-card-hover" /><div className="h-2 rounded bg-app-card-hover" />
        </div>
      ) : isError || !data ? (
        <ErrorState title="Durum alınamadı" error={error} retrying={isFetching} onRetry={() => void refetch()} />
      ) : (
        <>
          {eskiOptik && <p className="rounded-md border border-app-border bg-app-card px-3 py-2 text-small leading-snug text-app-text-muted" data-testid="eski-optik-satiri">{eskiOptik}</p>}
          <div data-testid="durum-karti" data-kademe={data.durum}>
            <KararBlogu karar={karar!} alt={alt} sayi={konum.sayi?.buyuk ?? null} etiket={konum.sayi ? 'normale göre' : undefined} kucuk={konum.sayi?.kucuk}
              yas={konum.yasGun !== null ? <StaleBadge kaynak="Sentinel-2" gun={konum.yasGun} /> : undefined}>
              <div className="mt-4"><KademeSeridi kademe={kademe} /></div>
              {kademe ? <p className="mt-3 flex items-baseline gap-2 text-body" data-testid="kademe-ad"><b style={{ color: KADEME_META[kademe].renk }}><span aria-hidden>{KADEME_META[kademe].isaret}</span> {KADEME_META[kademe].ad}</b><span className="text-app-text-muted" data-testid="durum-ozet">{data.ozet}</span></p> : <p className="mt-3 text-body" data-testid="kademe-satiri"><b data-testid="kademe-ad">Veri yetersiz</b> <span className="text-app-text-muted" data-testid="durum-ozet">{data.ozet}</span></p>}
              <p className="mt-1 text-small text-app-text-muted" data-testid="durum-guven"><b className={data.guven === 'dusuk' ? 'text-app-warn' : ''}>Güven {{ dusuk: 'düşük', orta: 'orta', yuksek: 'yüksek' }[data.guven]}</b> · {data.guvenNedeni.replace(/veri bayat/g, 'veri eski')}</p>
            </KararBlogu>
          </div>
          <SezonEgrisi gardenId={garden.id} />
          <TodayCard gardenId={garden.id} />
          <IkincilKart baslik="Diğer göstergeler" testId="diger-gostergeler"><GostergeCubuklari gardenId={garden.id} /></IkincilKart>
          <Akordeonlar>
            <Akordeon baslik="Veri durumu" ozet={`${data.bilesenler.filter((b) => b.bayat).length ? `${data.bilesenler.filter((b) => b.bayat).length} bileşende veri eski` : 'veriler güncel'}`} testId="veri-durumu">
              <ul className="grid gap-2" aria-label="Bileşenler">
                {data.bilesenler.map((b) => {
                  const meta = seviyeMeta(b.kod, b.seviye)
                  return (
                    <li key={b.kod}>
                      <button type="button" onClick={() => ac(b.kod)} aria-label={`${b.ad}: ${meta?.ad ?? 'veri yok'}. ${EYLEM[b.kod]}`} data-testid="durum-cip" data-kod={b.kod} data-seviye={b.seviye ?? 'yok'} data-bayat={String(b.bayat)}
                        className="flex min-h-11 w-full items-start gap-3 rounded-md border border-app-border bg-app-card px-3 py-2 text-left hover:border-app-border-strong">
                        <span aria-hidden className="mt-0.5 w-4 text-center text-small" style={{ color: meta?.renk }}>{meta?.isaret ?? '–'}</span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2"><b className="text-body">{b.ad}</b><span className="text-small font-semibold" style={{ color: meta?.renk }} data-testid="durum-cip-etiket">{meta?.ad ?? (b.bayat ? 'veri eski' : 'veri yok')}</span></span>
                          <span className="mt-0.5 block text-small leading-snug text-app-text-muted">{b.neden.replace('veri bayat', 'veri eski')}</span>
                        </span>
                      </button>
                    </li>
                  )
                })}
                <li>
                  <Link to={gardenPath(garden.id, 'hava')} className="flex min-h-11 w-full items-start gap-3 rounded-md border border-app-border bg-app-card px-3 py-2 hover:border-app-border-strong" data-testid="durum-risk-satiri" data-risk={data.riskler.length ? 'var' : 'yok'}
                    aria-label={`Risk: ${data.riskler.length ? data.riskler.join(', ') : 'aktif risk görünmüyor'}. Hava sekmesini aç`}>
                    <span aria-hidden className="mt-0.5 w-4 text-center text-small" style={{ color: data.riskler.length ? 'var(--color-app-watch)' : 'var(--color-app-success)' }}>{data.riskler.length ? '▲' : '✓'}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2"><b className="text-body">Risk</b><span className="text-small font-semibold">{data.riskler.length ? 'aktif' : 'yok'}</span></span>
                      <span className="mt-0.5 block text-small leading-snug text-app-text-muted">{data.riskler.length ? `${data.riskler.join(', ')} (risk tahmini, teşhis değil)${data.riskSinirladi ? ' · kademeyi sınırlıyor' : ''}` : 'Zararlı, hastalık ya da hava riski görünmüyor.'}</span>
                    </span>
                  </Link>
                </li>
              </ul>
            </Akordeon>
            <NasilHesaplandi nasil={data.nasil} esikDurumu={data.esikDurumu} />
          </Akordeonlar>
        </>
      )}
    </PanelKabuk>
  )
}
