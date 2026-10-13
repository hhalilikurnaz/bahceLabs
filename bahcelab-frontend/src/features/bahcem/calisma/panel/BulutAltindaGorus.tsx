import { useMemo } from 'react'
import { useEdinimler } from '../../api/edinimApi'
import { useGecmisDoldurma } from '../../api/gecmisApi'
import { useRadarDegisimler, useRadarEdinimler, yonAdi } from '../../api/radarApi'
import { useElementWidth } from '../../hooks/useElementWidth'
import { gunAy, sayi } from '../../lib/format'
import { PENCERE_GUN, buildSerit, bulguCumlesi } from '../../lib/radarSerit'
import { useCalismaStore } from '../calismaStore'

const KENAR = { sol: 44, sag: 10 }
const SATIR = { optik: 20, radar: 50, rviUst: 84, rviAlt: 134 }
const YUKSEKLIK = 158
const ALT_SATIR_PX = 8 // radar satırında her yörünge kendi alt satırında: üst üste binmez

/**
 * Su sekmesinin ilk bölümü: «Bulut altında görüş». Son 90 gün: optik satırı (net ● / bulutlu ○), radar satırı (■, anlamlı değişim adayı halkalı),
 * alt satırda bahçe RVI çizgisi (birincil yörünge). Bulutlu dönemler gri bant. Üstte bulgu cümlesi; eşikler ön değerdir.
 */
export function BulutAltindaGorus({ gardenId }: { gardenId: string }) {
  const [ref, genislik] = useElementWidth<HTMLDivElement>()
  const edinim = useEdinimler(gardenId)
  const radar = useRadarEdinimler(gardenId)
  const olaylar = useRadarDegisimler(gardenId)
  const gecmis = useGecmisDoldurma(gardenId).data
  const setKatman = useCalismaStore((s) => s.setKatman)
  const setTarih = useCalismaStore((s) => s.setTarih)
  const bugun = new Date().toISOString().slice(0, 10)
  const serit = useMemo(() => buildSerit(bugun, edinim.data, radar.data?.edinimler, olaylar.data?.degisimler), [bugun, edinim.data, radar.data, olaylar.data])
  const yukleniyor = edinim.isLoading || radar.isLoading || olaylar.isLoading
  const w = Math.max(280, genislik)
  const iw = w - KENAR.sol - KENAR.sag
  const X = (gun: number) => KENAR.sol + (gun / PENCERE_GUN) * iw
  const rviler = serit.rvi
  const [lo, hi] = useMemo(() => {
    if (!rviler.length) return [0, 1] as const
    const v = rviler.map((r) => r.deger)
    const pay = (Math.max(...v) - Math.min(...v)) * 0.15 || 0.05
    return [Math.min(...v) - pay, Math.max(...v) + pay] as const
  }, [rviler])
  const Y = (v: number) => SATIR.rviAlt - ((v - lo) / (hi - lo || 1)) * (SATIR.rviAlt - SATIR.rviUst)
  const cizgi = rviler.length ? `M${rviler.map((r) => `${X(r.gun).toFixed(1)},${Y(r.deger).toFixed(1)}`).join(' L')}` : ''
  const aylar = useMemo(() => {
    const out: { gun: number; ad: string }[] = []
    const bas = new Date(`${serit.baslangic}T00:00:00Z`)
    for (let g = 0; g <= PENCERE_GUN; g++) {
      const d = new Date(bas.getTime() + g * 86_400_000)
      if (d.getUTCDate() === 1) out.push({ gun: g, ad: gunAy(d.toISOString().slice(0, 10)).split(' ')[1] })
    }
    return out
  }, [serit.baslangic])
  const sonRvi = rviler[rviler.length - 1]
  const yorungeSirasi = useMemo(() => [...new Set(serit.radar.map((r) => r.yorunge))].sort((a, b) => a - b), [serit.radar])
  const birincilYorunge = radar.data?.yorungeler.find((y) => y.birincil)?.yorunge
  const radarKaydi = (radar.data?.edinimler.length ?? 0) > 0

  return (
    <section aria-label="Bulut altında görüş" className="rounded-md border border-app-border bg-app-card p-3.5" data-testid="bulut-altinda-gorus">
      <h3 className="text-[13px] font-semibold">Bulut altında görüş</h3>
      {yukleniyor ? (
        <div role="status" className="mt-2 h-[150px] animate-pulse rounded bg-app-card-hover" aria-label="Şerit yükleniyor" />
      ) : !radarKaydi ? (
        <p className="mt-2 rounded border border-dashed border-app-border px-3 py-6 text-center text-[13px] text-app-text-muted" data-testid="radar-bos">
          {gecmis?.durum === 'isleniyor' ? 'Radar geçmişi çekiliyor; şerit çekildikçe dolacak.' : 'Bu bahçe için henüz radar geçişi kaydı yok.'}
        </p>
      ) : (
        <>
          <p className="mt-1 text-[13.5px] leading-snug" data-testid="radar-bulgu">{bulguCumlesi(serit)}</p>
          <div ref={ref} className="mt-2">
            <svg width={w} height={YUKSEKLIK} viewBox={`0 0 ${w} ${YUKSEKLIK}`} role="img" aria-label="Son 90 gün: optik uydu ve radar geçişleri, bahçe RVI çizgisi" className="block overflow-visible">
              {serit.bantlar.map((b, i) => (
                <rect key={i} x={X(b.bas)} y={6} width={Math.max(2, X(b.bit) - X(b.bas))} height={YUKSEKLIK - 30} fill="var(--color-app-border-strong)" opacity={0.28} data-testid="bulutlu-bant" />
              ))}
              <text x={0} y={SATIR.optik + 4} fontSize={11} fontWeight={600} fill="var(--color-app-text)">Optik</text>
              <text x={0} y={SATIR.radar + 4} fontSize={11} fontWeight={600} fill="var(--color-app-text)">Radar</text>
              <text x={0} y={SATIR.rviUst - 8} fontSize={11} fontWeight={600} fill="var(--color-app-text)">RVI</text>
              <line x1={KENAR.sol} x2={w - KENAR.sag} y1={SATIR.optik} y2={SATIR.optik} stroke="var(--color-app-border)" />
              <line x1={KENAR.sol} x2={w - KENAR.sag} y1={SATIR.radar} y2={SATIR.radar} stroke="var(--color-app-border)" />
              {serit.optik.map((o) =>
                o.tur === 'net' ? (
                  <circle key={`n${o.tarih}`} cx={X(o.gun)} cy={SATIR.optik} r={4} fill="var(--color-app-text)" data-testid="optik-net"><title>{`${gunAy(o.tarih)} · optik net`}</title></circle>
                ) : (
                  <circle key={`b${o.tarih}`} cx={X(o.gun)} cy={SATIR.optik} r={3.6} fill="var(--color-app-card)" stroke="var(--color-app-text-muted)" strokeWidth={1.5} data-testid="optik-bulutlu"><title>{`${gunAy(o.tarih)} · bulutlu, alınamadı`}</title></circle>
                ),
              )}
              {serit.radar.map((r) => {
                const alt = (yorungeSirasi.indexOf(r.yorunge) - (yorungeSirasi.length - 1) / 2) * ALT_SATIR_PX
                const birincil = r.yorunge === birincilYorunge
                return (
                <g key={`${r.tarih}-${r.yorunge}`} data-testid="radar-gecis" data-aday={r.aday ? 'evet' : 'hayir'}>
                  <rect x={X(r.gun) - 2.5} y={SATIR.radar + alt - 2.5} width={5} height={5} fill="var(--color-app-text)" opacity={birincil ? 1 : 0.5}>
                    <title>{`${gunAy(r.tarih)} · yörünge ${r.yorunge} · ${yonAdi(r.yon)}${r.aday ? ` · olay adayı (${r.aday.buyukluk_db > 0 ? '+' : ''}${r.aday.buyukluk_db.toFixed(1)} dB)` : ''}`}</title>
                  </rect>
                  {r.aday && <rect x={X(r.gun) - 5.5} y={SATIR.radar + alt - 5.5} width={11} height={11} fill="none" stroke="var(--color-app-text)" strokeWidth={1.4} />}
                </g>
                )
              })}
              {cizgi && <path d={cizgi} fill="none" stroke="var(--color-app-text)" strokeWidth={1.6} strokeLinejoin="round" data-testid="rvi-cizgi" />}
              {rviler.map((r) => <circle key={r.tarih} cx={X(r.gun)} cy={Y(r.deger)} r={1.8} fill="var(--color-app-text)" />)}
              {sonRvi && <text x={Math.min(X(sonRvi.gun) + 4, w - 36)} y={Y(sonRvi.deger) - 7} fontSize={11} fontWeight={700} fill="var(--color-app-text)" className="num" data-testid="rvi-son">{sayi(sonRvi.deger, 2)}</text>}
              {rviler.length > 0 && <text x={KENAR.sol - 6} y={SATIR.rviAlt + 3} textAnchor="end" fontSize={10} fill="var(--color-app-text-muted)" className="num">{sayi(lo, 2)}</text>}
              {rviler.length > 0 && <text x={KENAR.sol - 6} y={SATIR.rviUst + 12} textAnchor="end" fontSize={10} fill="var(--color-app-text-muted)" className="num">{sayi(hi, 2)}</text>}
              <line x1={KENAR.sol} x2={w - KENAR.sag} y1={SATIR.rviAlt + 6} y2={SATIR.rviAlt + 6} stroke="var(--color-app-border)" />
              {aylar.map((a) => <text key={a.gun} x={X(a.gun)} y={YUKSEKLIK - 6} fontSize={10} fill="var(--color-app-text-muted)" textAnchor="middle">{a.ad}</text>)}
            </svg>
          </div>
          <p className="mt-1 text-[11.5px] leading-snug text-app-text-muted">● net optik · ○ bulutlu (alınamadı) · ■ radar geçişi (yörünge başına ayrı satır; birincil yörünge koyu) · çerçeveli ■ radar olay adayı · gri bant bulutlu dönem. RVI: birincil yörünge, bahçe ortalaması. Eşikler ön değer · mühendis onayı bekliyor.</p>
          <button type="button" className="mt-1.5 flex min-h-9 items-center text-[12.5px] font-semibold underline underline-offset-2 max-[560px]:min-h-11" onClick={() => (setKatman('radarVh'), setTarih(null))} data-testid="radar-haritada">Radar (VH) katmanını haritada aç</button>
        </>
      )}
    </section>
  )
}
