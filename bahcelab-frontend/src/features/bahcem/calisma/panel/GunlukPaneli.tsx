import { useState } from 'react'
import { Link } from 'react-router-dom'
import { KAYIT_TUR_AD, KAYIT_TUR_ISARET, useGunlukSozlugu, useSahaKayitlari } from '../../api/sahaApi'
import type { Garden } from '../../api/types'
import { gunAy } from '../../lib/format'
import { gardenPagePath } from '../../lib/routes'
import { PanelKabuk } from './parcalar'

const SATIR_AZAMI = 30

/** Günlük sekmesi (ADIM 11 · Dilim 1): Saha Defteri kayıtlarının akışı (gözlem etiketli, konumlu, fotoğraflı), kategori süzgeci ve sabit «+ Kayıt» eylemi (kayıt formu Saha Defteri'nde, harita ile birlikte açılır). */
export function GunlukPaneli({ garden }: { garden: Garden }) {
  const sozluk = useGunlukSozlugu().data
  const [kategori, setKategori] = useState<string | null>(null)
  const sorgu = useSahaKayitlari(garden.id, { kategori })
  const kayitlar = sorgu.data ?? []
  const ekle = `${gardenPagePath(garden.id, 'defter')}?kayit=yeni`
  const karar = sorgu.isLoading ? null : kayitlar.length === 0 && !kategori ? 'Günlükte henüz kayıt yok.' : `Günlükte ${kayitlar.length} kayıt var.`
  return (
    <PanelKabuk karar={karar} testId="gunluk-paneli">
      <div className="grid gap-3 p-4" data-testid="gunluk-icerik">
        <div className="flex flex-wrap items-center gap-2">
          <Link to={ekle} data-testid="gunluk-kayit-ekle" className="inline-flex min-h-11 items-center rounded-md bg-app-primary px-4 text-small font-semibold text-app-on-primary">+ Kayıt</Link>
          <Link to={gardenPagePath(garden.id, 'defter')} data-testid="gunluk-defter" className="inline-flex min-h-11 items-center rounded-md border border-app-border px-4 text-small font-semibold hover:bg-app-card-hover">Saha Defteri</Link>
        </div>
        {sozluk && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Kategori süzgeci">
            {sozluk.kategoriler.map((k) => (
              <button key={k.kod} type="button" aria-pressed={kategori === k.kod} onClick={() => setKategori(kategori === k.kod ? null : k.kod)} data-testid={`gunluk-kategori-${k.kod}`}
                className={`min-h-11 rounded-md border px-3 text-caption font-semibold ${kategori === k.kod ? 'border-app-text bg-app-text text-app-panel' : 'border-app-border hover:bg-app-card-hover'}`}>{k.ad}</button>
            ))}
          </div>
        )}
        {sorgu.isLoading ? (
          <div role="status" aria-label="Kayıtlar yükleniyor" className="h-20 animate-pulse rounded-md bg-app-card-hover" />
        ) : kayitlar.length === 0 ? (
          <p className="text-small text-app-text-muted" data-testid="gunluk-bos">{kategori ? 'Bu kategoride kayıt yok.' : 'Sahada gördüklerinizi ve yaptıklarınızı konumuyla, etiketiyle ve fotoğrafıyla buraya kaydedin.'}</p>
        ) : (
          <ul className="divide-y divide-app-border rounded-md border border-app-border bg-app-card" data-testid="gunluk-liste">
            {kayitlar.slice(0, SATIR_AZAMI).map((k) => (
              <li key={k.id} className="px-3 py-2.5" data-testid="gunluk-satiri" data-tur={k.tur} data-kategori={k.gozlem?.kategori ?? ''}>
                <p className="text-small"><span aria-hidden>{KAYIT_TUR_ISARET[k.tur]}</span> <b>{KAYIT_TUR_AD[k.tur]}</b> <span className="num text-app-text-muted">{gunAy(k.tarih, 'always')}</span></p>
                {k.gozlem && (
                  <p className="text-small" data-testid="gunluk-etiket">
                    <b>{k.gozlem.kategori_ad}</b> · {k.gozlem.etiket_ad}{k.gozlem.siddet_ad ? ` · ${k.gozlem.siddet_ad.toLowerCase()}` : ''}{k.gozlem.yayginlik_ad ? ` · ${k.gozlem.yayginlik_ad.toLowerCase()}` : ''}
                  </p>
                )}
                {k.aciklama && <p className="text-small text-app-text-muted">{k.aciklama}</p>}
                {k.fotograflar.length > 0 && <p className="text-caption text-app-text-dim">{k.fotograflar.length} fotoğraf</p>}
              </li>
            ))}
          </ul>
        )}
        {kayitlar.length > SATIR_AZAMI && <p className="text-caption text-app-text-dim">İlk {SATIR_AZAMI} kayıt gösteriliyor; tümü Saha Defteri'nde.</p>}
      </div>
    </PanelKabuk>
  )
}
