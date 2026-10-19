import { useDogrulukOzeti } from '../../api/sahaApi'

/** Uydu doğruluğu özeti (tür başına): yeterli doğrulama yoksa sayı yorumlanmaz, «henüz yeterli doğrulama yok» yazılır. */
export function DogrulukBolumu({ gardenId }: { gardenId: string }) {
  const sorgu = useDogrulukOzeti(gardenId)
  const o = sorgu.data
  return (
    <section aria-label="Uydu doğruluğu" data-testid="dogruluk-bolumu">
      <span className="eyebrow">UYDU DOĞRULUĞU</span>
      <h2 className="serif mt-1 text-[22px] leading-tight">Hangi türde ne kadar haklı çıktı?</h2>
      {sorgu.isLoading ? (
        <div role="status" aria-label="Özet yükleniyor" className="mt-3 h-16 animate-pulse bg-[var(--paper-3)]" />
      ) : !o || o.turler.length === 0 ? (
        <p className="mt-2 text-[13px] text-[var(--ink-3)]" data-testid="dogruluk-bos">Henüz olay ya da uyarı kaydı yok.</p>
      ) : (
        <table className="mt-2 w-full border-collapse text-left text-[12.5px]" data-testid="dogruluk-tablosu">
          <thead>
            <tr className="border-b border-[var(--rule-2)] text-[11.5px] text-[var(--ink-3)]">
              <th scope="col" className="py-1 pr-2 font-semibold">Tür</th>
              <th scope="col" className="py-1 pr-2 font-semibold">Özet</th>
              <th scope="col" className="py-1 font-semibold">Bekleyen</th>
            </tr>
          </thead>
          <tbody>
            {o.turler.map((t) => (
              <tr key={t.tur} className="border-b border-[var(--rule)]" data-testid="dogruluk-satiri" data-tur={t.tur} data-yeterli={String(t.yeterli)}>
                <th scope="row" className="py-1.5 pr-2 font-semibold">{t.ad}</th>
                <td className="py-1.5 pr-2">{t.metin}{t.bilinmiyor > 0 ? <span className="text-[var(--ink-3)]"> · {t.bilinmiyor} bilinmiyor</span> : null}</td>
                <td className="num py-1.5">{t.bekleyen}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {o && <p className="mt-1.5 text-[11.5px] text-[var(--ink-3)]">En az {o.asgari_dogrulama} doğrulama olmadan oran verilmez · {o.esik_durumu}. {o.not_}</p>}
    </section>
  )
}
