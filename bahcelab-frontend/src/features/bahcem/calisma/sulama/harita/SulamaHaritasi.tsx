import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '@/lib/motion'
import { useMap } from '../../../map/useMap'
import { GOSTERGE_AD, lejant, ortalama, type Gosterge, vanaGunu } from '../../../lib/sulamaHarita'
import { AltCubuk } from './AltCubuk'
import { tarihMetni } from './oynatma'
import { SulamaKatmani } from './SulamaKatmani'
import type { HaritaModeli } from './sulamaGeo'
import { useSulamaHaritaStore } from './sulamaHaritaStore'
import { useSulamaVeri } from './useSulamaVeri'
import { YagmurKanvasi } from './YagmurKanvasi'
import { DisariBulaniklik } from './DisariBulaniklik'
import { VanaCizimAraci } from './VanaCizimAraci'

const ETIKETLER: Gosterge[] = ['toprak', 'stres', 'fazla']
const f1 = (x: number) => String(Math.round(x * 10) / 10).replace('.', ',')

function OlcekVeKuzey() {
  const { map } = useMap()
  const cizgi = useRef<HTMLDivElement>(null)
  const metin = useRef<HTMLSpanElement>(null)
  const ok = useRef<SVGSVGElement>(null)
  useEffect(() => {
    if (!map) return
    const guncelle = () => {
      const enlem = map.getCenter().lat
      const mpp = (78271.517 * Math.cos((enlem * Math.PI) / 180)) / 2 ** map.getZoom()
      const adaylar = [5, 10, 20, 50, 100, 200, 500, 1000]
      const m = adaylar.filter((a) => a / mpp <= 120).pop() ?? adaylar[0]!
      if (cizgi.current) cizgi.current.style.width = `${Math.max(24, m / mpp)}px`
      if (metin.current) metin.current.textContent = m >= 1000 ? `${m / 1000} km` : `${m} m`
      if (ok.current) ok.current.style.transform = `rotate(${-map.getBearing()}deg)`
    }
    guncelle()
    map.on('move', guncelle)
    map.on('zoom', guncelle)
    map.on('rotate', guncelle)
    return () => { map.off('move', guncelle); map.off('zoom', guncelle); map.off('rotate', guncelle) }
  }, [map])
  return (
    <div className="glass absolute bottom-[176px] right-3.5 z-10 flex items-end gap-3 px-3 py-2 @max-[759px]:hidden" data-testid="olcek-kuzey">
      <div className="text-caption"><div ref={cizgi} className="h-1.5 border-x-2 border-b-2 border-app-text" style={{ width: 60 }} /><span ref={metin} className="tabular-nums">—</span></div>
      <svg ref={ok} width="26" height="30" viewBox="0 0 26 30" role="img" aria-label="Kuzey yönü" data-testid="kuzey-oku" style={{ transition: 'transform 250ms' }}><path d="M13 2 L21 24 L13 19 L5 24 Z" fill="var(--color-app-text)" /><text x="13" y="30" textAnchor="middle" fontSize="12" fill="var(--color-app-text)" style={{ display: 'none' }}>K</text></svg>
    </div>
  )
}

/** Sulama modu harita katmanı: motor + cam kartlar + yağmur + parsel dışı blur + alt çubuk + vana çizim aracı. MapProvider İÇİNDE çalışır. */
export function SulamaHaritasi({ gardenId }: { gardenId: string }) {
  const { panel, sim, yukleniyor } = useSulamaVeri(gardenId)
  const st = useSulamaHaritaStore()
  const azalt = useReducedMotion()
  const [model, setModel] = useState<HaritaModeli | null>(null)
  useEffect(() => { st.sifirla() }, [gardenId]) // eslint-disable-line react-hooks/exhaustive-deps
  // Oynatırken cam bulanıklığı kapanır (her karede yeniden bulanıklaştırma 60 fps'i bozar; lib/cam.ts ile aynı kural), durunca geri gelir
  useEffect(() => {
    if (!st.oynuyor) return
    document.documentElement.setAttribute('data-harita-hareket', '')
    return () => document.documentElement.removeAttribute('data-harita-hareket')
  }, [st.oynuyor])
  if (yukleniyor && !panel) return null
  if (!panel || panel.durum !== 'hazir' || !panel.gosterim || !sim || sim.durum !== 'hazir') {
    return <div role="status" className="glass absolute left-3.5 top-3.5 z-20 max-w-[320px] px-3 py-2 text-small" data-testid="harita-sulama-yok">{panel?.neden ?? sim?.neden ?? 'Sulama simülatörü için sulama bilgileri gerekli.'}</div>
  }
  const gun = Math.min(sim.gunler.length - 1, Math.max(0, st.gun ?? sim.bugun_idx ?? 0))
  const bantlar = { stres: panel.stres_pct, yakin: panel.yakin_pct, yeterli: panel.yeterli_pct }
  const vanalar = sim.sektorler.map((_, k) => vanaGunu(sim, k, gun, bantlar))
  const g = sim.gunler[gun]!
  const ort = ortalama(vanalar.map((v) => v.pct))
  const sulaniyorlar = vanalar.filter((v) => v.sulaniyor)
  const tetik = sim.tetik_pct ?? panel.tetik_pct
  const bugunMu = sim.bugun_idx === gun
  const chip = g.tahmin ? 'Tahmin' : bugunMu ? 'Bugün' : sulaniyorlar.length ? 'Sulama günü' : g.yagis_mm >= 1 ? 'Yağışlı gün' : 'Gün'
  const neden = sulaniyorlar.length
    ? `${sulaniyorlar.map((v) => v.ad).join(', ')} sulanıyor: kök bölgesi sulama eşiğine (%${tetik === null ? '—' : Math.round(tetik)}) indi · ${f1(sulaniyorlar[0]!.brutMm)} mm brüt su`
    : g.yagis_mm >= 1 ? `Yağış ${f1(g.yagis_mm)} mm — sulama gerekmedi` : `Sulama yok — toprak suyu eşiğin üstünde`
  const aralik = model?.aralikMetni
  const saat = (() => {
    const v = sim.vardiyalar.find((x) => x.tarih === g.tarih)
    if (!v || !sulaniyorlar.length || st.dilim <= 0) return v && sulaniyorlar.length ? `${v.baslangic} başlar` : '—'
    const saatli = v.kalemler.filter((k) => k.baslangic && k.sure_dk)
    if (!saatli.length) return v.baslangic
    const bas = Number(v.baslangic.slice(0, 2)) * 60 + Number(v.baslangic.slice(3, 5))
    const bit = Math.max(...saatli.map((k) => Number(k.baslangic!.slice(0, 2)) * 60 + Number(k.baslangic!.slice(3, 5)) + k.sure_dk!))
    const dk = Math.round(bas + st.dilim * (bit - bas))
    return `${String(Math.floor(dk / 60) % 24).padStart(2, '0')}:${String(dk % 60).padStart(2, '0')}`
  })()
  const hatVar = !!panel.ag.ana_boru || !!panel.ag.pompa
  return (
    <>
      <DisariBulaniklik parsel={model?.parsel ?? null} />
      <SulamaKatmani panel={panel} sim={sim} gunIdx={gun} hazirDurum={setModel} />
      {!azalt && g.yagis_mm >= 1 && <YagmurKanvasi mm={g.yagis_mm} />}
      <div className="glass absolute left-3.5 top-3.5 z-20 w-[min(300px,calc(100%-28px))] px-3 py-2.5 @max-[759px]:right-3.5 @max-[759px]:w-auto @max-[759px]:px-2.5 @max-[759px]:py-1" data-testid="durum-karti" aria-live="polite">
        <div className="flex items-center justify-between gap-2"><b className="text-small @max-[759px]:text-[12px]" data-testid="durum-tarih">{tarihMetni(g.tarih)}</b><span className="rounded-full bg-app-text px-2 text-[12px] leading-5 text-app-canvas" data-testid="durum-chip">{chip}</span></div>
        <p className="mt-1 text-small @max-[759px]:hidden" data-testid="durum-neden">{neden}</p>
        <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-caption @max-[759px]:hidden">
          <dt>Saat</dt><dd className="text-right tabular-nums" data-testid="durum-saat">{saat}</dd>
          <dt>Buharlaşma (ET₀)</dt><dd className="text-right tabular-nums" data-testid="durum-et0">{f1(g.et0_mm)} mm</dd>
          <dt>Yağış</dt><dd className="text-right tabular-nums" data-testid="durum-yagis">{f1(g.yagis_mm)} mm{g.olculen ? ' · ölçüm' : ''}</dd>
          <dt>Ort. toprak suyu</dt><dd className="text-right tabular-nums" data-testid="durum-ort">{ort === null ? '—' : `%${Math.round(ort)}`}</dd>
        </dl>
        {g.gecici && <p className="mt-1 text-[12px] text-app-text-dim" data-testid="durum-gecici">Geçici veri: ERA5 henüz kesinleşmedi</p>}
      </div>
      {!st.cizim && <div className="glass absolute right-3.5 top-3.5 z-20 w-[min(250px,calc(100%-28px))] px-3 py-2.5 @max-[759px]:left-3.5 @max-[759px]:right-3.5 @max-[759px]:top-[52px] @max-[759px]:w-auto @max-[759px]:px-1.5 @max-[759px]:py-1" data-testid="gosterge-karti">
        <div role="radiogroup" aria-label="Harita göstergesi" className="grid gap-1 @max-[759px]:grid-cols-3">
          {ETIKETLER.map((e) => <button key={e} type="button" role="radio" aria-checked={st.gosterge === e} onClick={() => st.setGosterge(e)} data-testid={`gosterge-${e}`} className={`min-h-11 rounded-md px-2 text-left text-small font-semibold @max-[759px]:justify-center @max-[759px]:px-1 @max-[759px]:text-center @max-[759px]:text-[12px] ${st.gosterge === e ? 'bg-app-text text-app-canvas' : 'text-app-text'}`}>{GOSTERGE_AD[e]}</button>)}
        </div>
        <ul className="mt-1.5 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[12px] @max-[759px]:hidden" data-testid="gosterge-lejant">
          {lejant(st.gosterge, panel.gosterim ?? { fazla_su_az_mm: 0, fazla_su_cok_mm: 0 }).map((l) => <li key={l.ad} className="flex items-center gap-1"><span aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm border border-app-border-strong" style={{ background: l.renk }} />{l.ad}</li>)}
        </ul>
        <div className="mt-1.5 flex flex-wrap gap-1 @max-[759px]:hidden" role="group" aria-label="Katmanlar">
          {([['tac', 'Taç'], ['hat', 'Hat'], ['serit', 'Islanan şerit']] as const).map(([k, ad]) => <button key={k} type="button" aria-pressed={st.katman[k]} disabled={k === 'hat' && !hatVar} title={k === 'hat' && !hatVar ? 'Boru/pompa çizilmedi (vana çizim aracı)' : undefined} onClick={() => st.toggleKatman(k)} data-testid={`katman-${k}`} className={`min-h-11 rounded-md border px-2 text-small font-semibold disabled:opacity-40 ${st.katman[k] ? 'border-app-text bg-app-text text-app-canvas' : 'border-app-border-strong'}`}>{ad}</button>)}
        </div>
      </div>}
      <OlcekVeKuzey />
      <div className="glass absolute bottom-[176px] left-3.5 z-10 max-w-[min(340px,calc(100%-28px))] px-3 py-2 text-caption @max-[759px]:hidden" data-testid="harita-notu">
        {model?.siraYok ? <p>Dikim aralığı girilmediği için ağaç sırası çizilmedi.</p> : (
          <p>Ağaç sırası {aralik} · yön {Math.round(model?.siraYonu ?? 0)}° ({model?.yonKaynak === 'kullanici' ? 'sizin seçiminiz' : 'parsel uzun ekseni'}) · <b>dikim aralığından çizildi · varsayım</b>{st.katman.serit && (st.sim.sistem ?? 'damla') === 'damla' ? ` · ıslanan şerit genişliği ${String(panel.gosterim?.serit_genislik_m ?? '').replace('.', ',')} m varsayım` : ''}</p>
        )}
        {!hatVar && <p className="mt-0.5 text-app-text-dim">Boru ve pompa çizilmedi, haritada gösterilmiyor.</p>}
      </div>
      {st.cizim && <VanaCizimAraci gardenId={gardenId} panel={panel} />}
      <AltCubuk sim={sim} gun={gun} tetik={tetik} />
    </>
  )
}
