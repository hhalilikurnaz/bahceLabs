import type { Garden } from '../api/types'
import '../varliklar/defter.css'

/** Saha Defteri (9G): editoryal görünüm yalnız bu sayfada (`.notebook` kapsamı). */
export function DefterSayfasi({ garden }: { garden: Garden }) {
  return (
    <div className="notebook min-h-0 flex-1 overflow-y-auto" data-testid="bos-defter">
      <div className="mx-auto max-w-[760px] px-8 py-10">
        <div className="eyebrow">Saha Defteri · {garden.ad}</div>
        <h1 className="serif" style={{ fontSize: 40, margin: '6px 0 10px', lineHeight: 1.05 }}>Otomatik saha turu, telefonda.</h1>
        <p style={{ fontSize: 15, maxWidth: 560 }}>
          Haritadaki zayıf kesimler, tuzaklar ve gözlem noktaları sırayla gezilecek; konumlu fotoğraf, ilaç ve olay kayıtları bu deftere yazılacak.
        </p>
        <div className="rule-t" style={{ marginTop: 22, paddingTop: 12 }}>
          <span className="mono" style={{ fontSize: 12 }}>Adım 9G</span>
        </div>
      </div>
    </div>
  )
}
