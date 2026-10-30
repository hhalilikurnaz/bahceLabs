import { useEffect, useMemo, useState } from 'react'
import { ChartState } from '@/components/chart'
import { Button } from '@/components/ui'
import { useReducedMotion } from '@/lib/motion'
import { useSulamaSezon, type SezonYaniti } from '../../api/sulamaApi'
import { sayi } from '../../lib/format'

const AY = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
const gunMetni = (iso: string) => `${Number(iso.slice(8, 10))} ${AY[Number(iso.slice(5, 7)) - 1]}`
const ADIM_MS = 70

/**
 * Sezon animasyonu: zaman çubuğu sezonu GERÇEK o yılın havasıyla oynatır. Kova boşalır/dolar, sulama günleri vurgulanır, birikimli m³ ve TL sayaçları ilerler.
 * Ağaç başına damla animasyonu YOK (konum yok). «Hareketi azalt» açıkken oynatma yok: gün gün ileri/geri adımlanır.
 */
export function SezonAnimasyonu({ gardenId, yillar, varsayilanYil }: { gardenId: string; yillar: number[]; varsayilanYil: number }) {
  const [yil, setYil] = useState(varsayilanYil)
  const sezon = useSulamaSezon(gardenId, yil)
  return (
    <section className="rounded-md border border-app-border bg-app-card p-4" data-testid="sezon-anim" aria-label="Sezon animasyonu">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lead font-semibold">Sezon nasıl geçerdi? <span className="text-small font-normal text-app-text-dim">gerçek hava, seçtiğiniz yıl</span></h3>
        <label className="flex items-center gap-2 text-small font-semibold">Yıl
          <select value={yil} onChange={(e) => setYil(Number(e.target.value))} className="min-h-11 rounded-md border border-app-border-strong bg-app-card px-2 text-body" data-testid="anim-yil">
            {yillar.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
      </div>
      {sezon.isLoading ? <ChartState tur="yukleniyor" yukseklik={160} />
        : sezon.isError || !sezon.data || sezon.data.gunler.length === 0 ? <ChartState tur="yok" neden={`${yil} için sezon hesaplanamadı.`} nezaman="Hava verisi ya da toprak bilgisi gelince dolar." yukseklik={160} />
        : <Oynatici key={yil} sezon={sezon.data} yil={yil} />}
    </section>
  )
}

/** Oynatıcı: yıl değişince `key` ile baştan kurulur (durumu sıfırlamak için efekt gerekmez). */
function Oynatici({ sezon, yil }: { sezon: SezonYaniti; yil: number }) {
  const azalt = useReducedMotion()
  const [i, setI] = useState(0)
  const [oynuyor, setOynuyor] = useState(false)
  const n = sezon.gunler.length
  useEffect(() => {
    if (!oynuyor || azalt) return
    const t = window.setInterval(() => setI((o) => (o + 1 >= n ? (setOynuyor(false), o) : o + 1)), ADIM_MS)
    return () => window.clearInterval(t)
  }, [oynuyor, azalt, n])
  const gun = sezon.gunler[Math.min(i, n - 1)]
  const doluluk = useMemo(() => Math.max(0, Math.min(1, (sezon.taw_mm - gun.tukenme_mm) / sezon.taw_mm)), [sezon.taw_mm, gun.tukenme_mm])
  const esik = 1 - sezon.raw_mm / sezon.taw_mm
  const tl = gun.kumulatif_tl
  return (
    <>
      <div className="mt-3 grid grid-cols-[88px_minmax(0,1fr)] items-end gap-4 max-[560px]:grid-cols-[72px_minmax(0,1fr)]">
        <svg viewBox="0 0 88 150" className="h-[150px] w-full" role="img" aria-label={`Toprak kovası ${Math.round(doluluk * 100)} yüzde dolu`} data-testid="anim-kova">
          <rect x="14" y="6" width="60" height="132" rx="4" fill="none" stroke="var(--color-app-border-strong)" strokeWidth="2" />
          <rect x="16" y={6 + 132 * (1 - doluluk)} width="56" height={132 * doluluk} fill="var(--color-app-water)" opacity={gun.stres ? 0.45 : 0.8} style={azalt ? undefined : { transition: 'y 90ms linear, height 90ms linear' }} data-testid="anim-su" />
          <line x1="10" x2="78" y1={6 + 132 * (1 - esik)} y2={6 + 132 * (1 - esik)} stroke="var(--color-app-warn)" strokeDasharray="5 3" strokeWidth="1.5" />
          <text x="44" y={6 + 132 * (1 - esik) - 4} textAnchor="middle" fontSize="11" fill="var(--color-app-warn)" fontWeight="600">eşik</text>
        </svg>
        <div>
          <p className="text-h2 font-semibold tabular-nums" data-testid="anim-gun">{gunMetni(gun.tarih)} {yil}</p>
          <p className="mt-1 h-6 text-body" data-testid="anim-durum" aria-live="polite">
            {gun.brut_mm > 0 ? <b className="rounded-sm bg-app-primary px-2 py-0.5 text-app-on-primary">Sulama günü · {sayi(gun.brut_mm, 0)} mm</b> : gun.stres ? <span className="text-app-warn">Eşiğin altında</span> : <span className="text-app-text-muted">{gun.yagis_mm >= 2 ? `Yağış ${sayi(gun.yagis_mm, 0)} mm` : 'Sulama yok'}</span>}
          </p>
          <dl className="mt-2 flex gap-6">
            <div><dt className="text-caption text-app-text-muted">toplam su</dt><dd className="text-h2 font-semibold tabular-nums" data-testid="anim-sayac-m3">{sayi(gun.kumulatif_m3, 0)} m³</dd></div>
            <div><dt className="text-caption text-app-text-muted">toplam maliyet</dt><dd className="text-h2 font-semibold tabular-nums" data-testid="anim-sayac-tl">{tl == null ? '—' : `${sayi(tl, 0)} TL`}</dd></div>
          </dl>
          {tl == null && <p className="mt-1 text-caption text-app-text-dim">TL için birim fiyat ya da pompa bilgisi gerekir (Maliyet).</p>}
        </div>
      </div>
      <div className="mt-3 flex h-6 items-end gap-px" role="presentation" data-testid="anim-serit">
        {sezon.gunler.map((g, k) => (
          <button key={g.tarih} type="button" tabIndex={-1} aria-hidden onClick={() => { setOynuyor(false); setI(k) }} className="flex-1" style={{ height: g.brut_mm > 0 ? 24 : 8, background: g.brut_mm > 0 ? 'var(--color-app-primary)' : k <= i ? 'var(--color-app-text-dim)' : 'var(--color-app-border)', opacity: k <= i ? 1 : 0.55 }} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {azalt ? (
          <>
            <Button onClick={() => setI(Math.max(0, i - 1))} data-testid="anim-geri">Önceki gün</Button>
            <Button onClick={() => setI(Math.min(n - 1, i + 1))} data-testid="anim-ileri">Sonraki gün</Button>
            <Button onClick={() => setI(Math.min(n - 1, i + 7))} data-testid="anim-hafta">7 gün ileri</Button>
          </>
        ) : (
          <Button variant="primary" onClick={() => { if (i >= n - 1) setI(0); setOynuyor(!oynuyor) }} data-testid="anim-oynat">{oynuyor ? 'Durdur' : i >= n - 1 ? 'Baştan oynat' : 'Oynat'}</Button>
        )}
        <input type="range" min={0} max={Math.max(0, n - 1)} value={Math.min(i, n - 1)} onChange={(e) => { setOynuyor(false); setI(Number(e.target.value)) }} aria-label="Sezon günü" className="min-h-11 flex-1" data-testid="anim-slider" />
      </div>
      <p className="mt-1 text-caption text-app-text-dim" data-testid="anim-ozet">{yil} sezonu: {sezon.sulama_sayisi} sulama · {sayi(sezon.toplam_m3, 0)} m³ · yağış {sayi(sezon.yagis_mm, 0)} mm · eşik altı {sezon.stres_gun} gün{sezon.tahmin_dahil ? ' · bu yıl: hava verisi olan günlere kadar' : ''}. Ön değer · mühendis onayı bekliyor.</p>
    </>
  )
}
