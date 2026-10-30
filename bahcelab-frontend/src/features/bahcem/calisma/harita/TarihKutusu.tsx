import { ChevronLeft, ChevronRight } from 'lucide-react'
import { yonAdi } from '../../api/radarApi'
import { gunAy, kaynakSatiri, yuzde } from '../../lib/format'
import { useCalismaStore } from '../calismaStore'
import type { HaritaGorunumu } from '../useHaritaGorunumu'

/** Sağ üst: ‹ tarih › (net görüntüler arasında) + kaynak satırı + «Geçmiş ↗». */
export function TarihKutusu({ view }: { view: HaritaGorunumu }) {
  const setTarih = useCalismaStore((s) => s.setTarih)
  const yil = useCalismaStore((s) => s.yil)
  const imlec = useCalismaStore((s) => s.imlecTarih)
  if (yil !== null && view.tanim.id === 'canlilik') {
    return (
      <div className="flex items-center gap-1" data-testid="tarih-kutusu" data-yil={yil}>
        <div className="min-w-[132px] px-2 leading-tight">
          <b className="num block text-small" data-testid="secili-tarih">{yil} yazı</b>
          <span className="num block text-caption text-app-text-muted">Haz–Eyl ortancası · çok yıllı kompozit</span>
        </div>
        <button type="button" onClick={() => setTarih(null)} data-testid="yil-gorunumunden-cik" className="flex h-9 max-[560px]:h-11 items-center rounded-md border border-app-border px-3 text-small font-semibold hover:border-app-text">Son görüntü</button>
      </div>
    )
  }
  const list = view.sahneler
  const i = view.sahne ? list.findIndex((s) => s.tarih === view.sahne!.tarih) : -1
  const go = (step: number) => {
    const next = list[i + step]
    if (next) setTarih(next.tarih === list[list.length - 1]?.tarih ? null : next.tarih)
  }
  const s = view.sahne
  return (
    <div className="flex items-center gap-1" data-testid="tarih-kutusu" data-imlec={imlec ?? undefined}>
      <button type="button" aria-label="Önceki görüntü" disabled={i <= 0} onClick={() => go(-1)} className="grid h-9 w-9 max-[560px]:h-11 max-[560px]:w-11 place-items-center rounded-md hover:bg-app-card-hover disabled:opacity-30">
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </button>
      <div className="min-w-0 flex-1 whitespace-nowrap px-1.5 leading-tight min-[561px]:min-w-[132px]">
        <b className="num block text-small" data-testid="secili-tarih">{s ? gunAy(s.tarih, 'always') : '—'}</b>
        <span className="num block line-clamp-2 text-caption text-app-text-muted max-[560px]:hidden" data-testid={s?.yorunge != null ? 'radar-yorunge' : undefined}>
          {s ? kaynakSatiri([view.tanim.id === 'degisim' && view.onceki ? `${gunAy(view.onceki.tarih)} ile fark` : null, s.yorunge != null ? `yörünge ${s.yorunge} · ${yonAdi(s.yon ?? '')}` : null, s.platform ? `Landsat ${s.platform.replace('L', '')}` : null, s.bulutOrani != null ? `bulut ${yuzde(s.bulutOrani)}` : null, view.tanim.cozunurluk]) : view.yukleniyor ? 'yükleniyor…' : view.hata ? 'alınamadı' : 'görüntü yok'}
        </span>
        {imlec && <span data-testid="imlec-tarih" className="mt-0.5 inline-block rounded-[4px] bg-app-accent-soft px-1 text-caption font-semibold text-app-accent">grafikte {gunAy(imlec, 'never')}</span>}
      </div>
      <button type="button" aria-label="Sonraki görüntü" disabled={i < 0 || i >= list.length - 1} onClick={() => go(1)} className="grid h-9 w-9 max-[560px]:h-11 max-[560px]:w-11 place-items-center rounded-md hover:bg-app-card-hover disabled:opacity-30">
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
    </div>
  )
}
