import { useMemo } from 'react'
import { KAYIT_TUR_AD, KAYIT_TUR_ISARET, useSahaKayitlari } from '../../api/sahaApi'
import { gunAy } from '../../lib/format'
import { noktaMi, temsilNoktasi } from '../../lib/saha'
import { HaritaIsaretleri, type Isaret } from '../defter/HaritaIsaretleri'
import { SahaCizgileri } from '../defter/SahaCizgileri'

/** Saha Defteri kayıtları çalışma alanı haritasında AYRI üst katman (katman menüsünden açılır): işaretler + alan çokgenleri. Kayıt yoksa hiçbir şey çizilmez. */
export function SahaKatmani({ gardenId }: { gardenId: string }) {
  const kayitlar = useSahaKayitlari(gardenId).data
  const isaretler = useMemo<Isaret[]>(
    () =>
      (kayitlar ?? []).flatMap((r) => {
        if (!r.konum) return []
        const [lng, lat] = temsilNoktasi(r.konum)
        return [{ id: r.id, lng, lat, etiket: KAYIT_TUR_ISARET[r.tur], baslik: `Saha kaydı: ${KAYIT_TUR_AD[r.tur]}, ${gunAy(r.tarih, 'always')}${r.aciklama ? ` — ${r.aciklama.slice(0, 60)}` : ''}`, stil: noktaMi(r.konum) ? ('kayit' as const) : ('alan' as const) }]
      }),
    [kayitlar],
  )
  const alanlar = useMemo(() => (kayitlar ?? []).flatMap((r) => (r.konum?.type === 'Polygon' ? [r.konum] : [])), [kayitlar])
  return (
    <>
      <SahaCizgileri rota={[]} alanlar={alanlar} taslak={[]} />
      <HaritaIsaretleri isaretler={isaretler} onSec={() => undefined} />
    </>
  )
}
