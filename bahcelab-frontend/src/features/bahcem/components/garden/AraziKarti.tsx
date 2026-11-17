import { useDon, sayiTr } from '../../api/donApi'

/** Topografya profili (Copernicus DEM 30 m, BETİMLEYİCİ): eğim, bakı, çukur/yamaç/sırt; bahçe içi göreli soğuk nokta neden üretildi/üretilmedi. °C VERMEZ. */
export function AraziKarti({ gardenId }: { gardenId: string }) {
  const { data } = useDon(gardenId)
  const t = data?.topografya
  if (!t) return <p className="text-small text-app-text-muted" data-testid="arazi-yok">Arazi profili henüz hesaplanmadı (günlük iş çalışınca oluşur).</p>
  const p = t.profil
  return (
    <section aria-label="Arazi" className="rounded-md border border-app-border bg-app-card px-3 py-2.5 text-small" data-testid="arazi-karti" data-sinif={t.konum.sinif}>
      <h3 className="font-semibold">Arazi</h3>
      <p className="mt-0.5" data-testid="arazi-cumle">{t.konum.cumle}</p>
      <dl className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 text-app-text-muted">
        <div><dt className="inline">Eğim: </dt><dd className="inline tabular-nums">{sayiTr(p.egim_der)}°</dd></div>
        <div><dt className="inline">Bakı: </dt><dd className="inline">{t.konum.baki_adi}</dd></div>
        <div><dt className="inline">Rakım: </dt><dd className="inline tabular-nums">{sayiTr(p.yukseklik_m, 0)} m</dd></div>
        <div><dt className="inline">Gökyüzü görüş: </dt><dd className="inline tabular-nums">{sayiTr(p.svf, 2)}</dd></div>
      </dl>
      {t.bahce_ici && !t.bahce_ici.uygun && <p className="mt-1.5 text-app-text-muted" data-testid="arazi-bahce-ici-neden">Bahçe içi soğuk nokta üretilmedi: {t.bahce_ici.neden?.replace('Bahçe içi göreli soğuk nokta üretilmedi: ', '')}</p>}
      <p className="mt-1.5 text-caption text-app-text-muted">{t.not} · {t.kaynak}</p>
    </section>
  )
}
