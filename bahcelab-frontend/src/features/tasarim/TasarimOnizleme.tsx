import { useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import './tokens.css'
import { useProto } from './data'
import { AnalizFocus, Asistan, HavaFocus, Mobile, Workspace } from './Screens'
import './saha/saha.css'
import { Asistan as SAsistan, AnalizFocus as SAnaliz, HavaFocus as SHava } from './saha/Focus'
import { Mobile as SMobile, Workspace as SWorkspace } from './saha/Workspace'
import { useSaha } from './saha/useSaha'
import { Varliklar } from './saha/Varliklar'
import type { Yon } from './parts'

const FONTS =
  'https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&family=Inter+Tight:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Manrope:wght@400;500;600;700;800&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap'

/** /tasarim-onizleme/:yon/:ekran — YALNIZCA geliştirmede; gerçek bahçe verisiyle statik tasarım önizlemesi (ürün ekranı değildir). */
export function TasarimOnizleme() {
  const { yon = 'gece', ekran = 'calisma' } = useParams()
  const [q] = useSearchParams()
  const d = useProto(q.get('bahce'))
  useEffect(() => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = FONTS
    document.head.appendChild(link)
    return () => link.remove()
  }, [])
  const y: Yon = yon === 'toprak' ? 'toprak' : 'gece'
  const saha = useSaha(d)
  if (yon === 'saha') {
    return (
      <div className="sd" data-ready={ekran === 'varliklar' ? true : d.ready} style={{ height: ekran === 'varliklar' ? 'auto' : '100dvh', minHeight: '100dvh', width: '100vw', overflow: ekran === 'varliklar' ? 'visible' : 'hidden' }}>
        {ekran === 'varliklar' ? <Varliklar /> : !d.ready ? <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>Gerçek bahçe verisi yükleniyor…</div> : ekran === 'analiz' ? <SAnaliz d={d} s={saha} mod={q.get('mod') === 'son12' ? 'son12' : 'cok'} /> : ekran === 'hava' ? <SHava d={d} s={saha} /> : ekran === 'asistan' ? <SAsistan d={d} s={saha} /> : ekran === 'mobil' ? <SMobile d={d} s={saha} sheet={q.get('sayfa') === 'zaman' ? 'zaman' : q.get('sayfa') === 'ozet' ? 'ozet' : 'peek'} /> : <SWorkspace d={d} s={saha} layerOpen={q.get('katman') === '1'} narrow={q.get('dar') === '1'} />}
      </div>
    )
  }
  return (
    <div className="kc" data-yon={y} data-ready={d.ready} style={{ height: '100dvh', width: '100vw', overflow: 'hidden' }}>
      {!d.ready ? (
        <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--kc-ink2)' }}>Gerçek bahçe verisi yükleniyor…</div>
      ) : ekran === 'analiz' ? (
        <AnalizFocus d={d} yon={y} mod={q.get('mod') === 'son12' ? 'son12' : 'cok'} />
      ) : ekran === 'hava' ? (
        <HavaFocus d={d} yon={y} />
      ) : ekran === 'asistan' ? (
        <Asistan d={d} yon={y} />
      ) : ekran === 'mobil' ? (
        <Mobile d={d} yon={y} sheet={q.get('sayfa') === 'zaman' ? 'zaman' : q.get('sayfa') === 'ozet' ? 'ozet' : 'peek'} />
      ) : (
        <Workspace d={d} yon={y} flyout={q.get('liste') === '1'} layerOpen={q.get('katman') === '1'} zones={q.get('bolge') === '1'} />
      )}
    </div>
  )
}
