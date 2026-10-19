import { useEffect, useMemo, useRef } from 'react'
import { useQueries } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import type { Garden } from '../../api/types'
import { useMultiyear, yilGridOptions, type YilGrid } from '../../api/multiyearApi'
import { paintGrid, percentileDomain } from '../../lib/izgara'
import { RAMPS } from '../../lib/paletler'
import { gardenPath } from '../../lib/routes'

function Kare({ grid, alan, halka, uyumsuz }: { grid: YilGrid; alan: [number, number]; halka: number[][]; uyumsuz: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const boyalı = paintGrid(grid, { ramp: RAMPS.canlilik, domain: alan, scale: 6, clip: halka })
    el.width = boyalı.width
    el.height = boyalı.height
    el.getContext('2d')?.drawImage(boyalı, 0, 0)
  }, [grid, alan, halka])
  return <canvas ref={ref} aria-hidden className={`h-28 w-full rounded object-contain ${uyumsuz ? 'outline-dashed outline-1 outline-offset-2 outline-app-text' : ''}`} />
}

/**
 * «Aynı bahçe, N yaz»: her yılın Haziran–Eylül ortanca canlılığı küçük harita; TÜM kareler tek ortak skalada (kıyaslanabilir).
 * Çok yıllı analizin uyumsuz saydığı yıl kesikli çerçevelidir (analiz yoksa çerçeve yok). Bir yıla dokununca çalışma alanı haritası o yaza açılır.
 */
export function YazHaritalari({ garden }: { garden: Garden }) {
  const multi = useMultiyear(garden.id).data
  const yillar = useMemo(() => (multi?.yillar ?? []).filter((y) => y.yil_net_sahne > 0 || y.sahne_sayisi > 0).map((y) => y.yil).sort((a, b) => a - b), [multi])
  const sorgular = useQueries({ queries: yillar.map((y) => yilGridOptions(garden.id, y)) })
  const gridler = sorgular.map((s) => s.data ?? null)
  const hazir = gridler.filter((g): g is YilGrid => g !== null)
  const alan = useMemo<[number, number]>(() => (hazir.length ? percentileDomain(hazir) : [0, 1]), [hazir.length]) // eslint-disable-line react-hooks/exhaustive-deps
  const halka = useMemo(() => (garden.geometry.type === 'Polygon' ? garden.geometry.coordinates[0] : garden.geometry.coordinates[0][0]) as number[][], [garden])
  const bilgi = new Map((multi?.yillar ?? []).map((y) => [y.yil, y]))
  const yukleniyor = sorgular.some((s) => s.isLoading)
  return (
    <section aria-label="Aynı bahçe, yaz yaz" className="rounded-md border border-app-border bg-app-card p-3.5" data-testid="yaz-haritalari">
      <h3 className="text-[13px] font-semibold">Aynı bahçe, {hazir.length || yillar.length || ''} yaz</h3>
      <p className="mt-1 text-[12.5px] text-app-text-muted">Her kare, o yılın Haziran–Eylül ortanca canlılığı; hepsi aynı renk skalasında. Kesikli çerçeve: çok yıllı analizin diğer yıllara benzemeyen saydığı yıl. Bir yıla dokunun, harita o yaza açılır.</p>
      {multi && multi.durum === 'yok' ? (
        <p className="mt-3 text-[13px] text-app-text-muted" data-testid="yaz-haritalari-bos">Çok yıllı analiz henüz yapılmadı; yıllık kareler analiz sonrası burada görünür.</p>
      ) : yukleniyor && !hazir.length ? (
        <div role="status" aria-label="Yaz haritaları yükleniyor" className="mt-3 h-24 animate-pulse rounded bg-app-card-hover" />
      ) : (
        <ul className="mt-3 grid grid-cols-6 gap-2.5 max-[1100px]:grid-cols-4 max-[560px]:grid-cols-3">
          {gridler.map((g, i) =>
            g ? (
              <li key={yillar[i]}>
                <Link to={`${gardenPath(garden.id)}?yil=${yillar[i]}`} data-testid="yaz-kare" data-yil={yillar[i]} data-uyumsuz={String(bilgi.get(yillar[i])?.uyumsuz === true)} className="block min-h-11 rounded p-1 hover:bg-app-card-hover" aria-label={`${yillar[i]} yazı${bilgi.get(yillar[i])?.uyumsuz ? ', diğer yıllara benzemiyor' : ''}; haritada aç`}>
                  <Kare grid={g} alan={alan} halka={halka} uyumsuz={bilgi.get(yillar[i])?.uyumsuz === true} />
                  <span className="num mt-1 flex items-baseline justify-between text-[12px]"><b>{yillar[i]}</b>{bilgi.get(yillar[i])?.uyumsuz && <span className="text-app-text-muted">uyumsuz</span>}</span>
                </Link>
              </li>
            ) : null,
          )}
        </ul>
      )}
    </section>
  )
}
