import { CoordTicks, HatchDefs, ICONS, ILLUSTRATIONS, Icon, Logo, NorthArrow, ScaleBar, type IconName } from './assets'
import { INDEX_CSS, STATUS, ZONE_HEX, rampCss } from './palette'

const NAMES: Record<IconName, string> = { yaprak: 'Yaprak', limon: 'Meyve', tuzak: 'Tuzak', damla: 'Damla', don: 'Don', ilac: 'İlaç', budama: 'Budama', hasat: 'Hasat', toprak: 'Toprak', gunes: 'Güneş', ruzgar: 'Rüzgâr', bolge: 'Bölge', bahce: 'Bahçe', asistan: 'Asistan', defter: 'Defter', kontur: 'Kontur' }
const ILL_NAMES: Record<string, string> = { dal: 'Limon dalı', cicek: 'Limon çiçeği', kesit: 'Meyve kesiti', agac: 'Ağaç silueti', yaprak: 'Yaprak levhası' }

function Block({ n, title, note, children }: { n: string; title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="rule-t" style={{ padding: '22px 0 8px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 28 }}>
        <div><div className="eyebrow">{n}</div><h2 className="serif" style={{ margin: '4px 0 6px', fontSize: 26 }}>{title}</h2>{note && <div style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{note}</div>}</div>
        <div>{children}</div>
      </div>
    </section>
  )
}

/** Varlık sayfası: ikonlar, gravürler, kartografik öğeler, renkler, tipografi. */
export function Varliklar() {
  return (
    <div style={{ padding: '30px 44px 50px', maxWidth: 1360, margin: '0 auto' }}>
      <HatchDefs id="v" />
      <header style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
        <Logo size={38} />
        <div><div className="eyebrow">Tasarım dili</div><h1 className="serif" style={{ margin: 0, fontSize: 44, lineHeight: 1 }}>Saha defteri × kartografi</h1></div>
        <div style={{ flex: 1 }} />
        <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', textAlign: 'right' }}>Varlıklar · sürüm 1<br />tüm çizimler SVG, repoda</div>
      </header>

      <Block n="1 · İkonlar" title="On altı tarım ikonu" note="Tek çizgi kalınlığı (1,5), 24 ızgara, yuvarlak uçlar. Genel ikon kütüphanesi yalnız temel kontrollerde (bildirim, ayarlar, arama).">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 0, borderTop: '1px solid var(--ink)', borderLeft: '1px solid var(--rule)' }}>
          {(Object.keys(ICONS) as IconName[]).map((k) => (
            <div key={k} style={{ borderRight: '1px solid var(--rule)', borderBottom: '1px solid var(--rule)', padding: '14px 8px 8px', display: 'grid', justifyItems: 'center', gap: 8 }}>
              <Icon name={k} size={40} weight={1.3} />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Icon name={k} size={20} /><Icon name={k} size={14} /></div>
              <div className="eyebrow">{NAMES[k]}</div>
            </div>
          ))}
        </div>
      </Block>

      <Block n="2 · Gravürler" title="Botanik levhalar" note="İnce çizgi ve tarama; boş durumlar, başlıklar ve karşılama ekranları için. Kâğıt zemin üstünde mürekkep.">
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: 0 }}>
          {Object.entries(ILLUSTRATIONS).map(([k, C], i) => (
            <figure key={k} style={{ margin: 0, padding: 16, display: 'grid', justifyItems: 'center', gap: 6, borderRight: '1px solid var(--rule)', borderBottom: '1px solid var(--rule)', gridColumn: i === 0 ? '1 / 2' : undefined }}>
              <C size={i === 0 ? 260 : 170} />
              <figcaption className="eyebrow">Levha {i + 1} · {ILL_NAMES[k]}</figcaption>
            </figure>
          ))}
        </div>
      </Block>

      <Block n="3 · Kartografi" title="Ölçek, yön, koordinat, tarama" note="Her haritada: ölçek çubuğu, kuzey oku, çerçeve kenarında koordinat işaretleri; zayıf bölgeler tarama desenli; seçili bahçe dışı soluk.">
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 24 }}>
          <div style={{ position: 'relative', width: 440, height: 230, border: '1px solid var(--ink)', background: `repeating-linear-gradient(0deg, transparent 0 22px, var(--rule) 22px 23px), var(--paper-2)` }}>
            <CoordTicks bounds={{ w: 34.3822, s: 36.6571, e: 34.3858, n: 36.6609 }} width={440} height={230} />
            <div style={{ position: 'absolute', left: 90, top: 70, width: 190, height: 110, border: '1.6px solid var(--ink)', background: 'var(--paper)' }}>
              <div style={{ position: 'absolute', inset: 0, background: 'url(#)', backgroundImage: 'repeating-linear-gradient(45deg, var(--ink) 0 1.2px, transparent 1.2px 6px)', clipPath: 'polygon(0 0, 55% 0, 40% 100%, 0 100%)', opacity: 0.85 }} />
              <span className="maplabel" style={{ left: 120, top: 50 }}>0,43</span>
              <span className="mappin" style={{ position: 'absolute', left: 40, top: 10 }}>−%14 · 2,3 da</span>
            </div>
            <div style={{ position: 'absolute', left: 14, bottom: 14, background: 'rgb(251 250 246 / .9)', padding: '2px 4px' }}><ScaleBar pxPerMeter={1.1} /></div>
            <div style={{ position: 'absolute', right: 16, top: 34, background: 'rgb(251 250 246 / .9)' }}><NorthArrow /></div>
          </div>
          <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
            <div><div className="eyebrow">Tarama desenleri</div>
              <svg width={330} height={76} style={{ marginTop: 6 }}><HatchDefs id="v2" />
                {['hatch', 'cross', 'dots'].map((p, i) => <g key={p}><rect x={i * 112} y={0} width={100} height={44} fill={`url(#v2-${p})`} stroke="var(--ink)" /><text x={i * 112} y={58} fontSize={10} fontFamily="var(--font-mono)" fill="var(--ink-3)">{['çizgi', 'çapraz', 'nokta'][i]}</text><text x={i * 112} y={70} fontSize={9} fill="var(--ink-3)">{['zayıf bölge', 'eksik veri', 'uygun değil'][i]}</text></g>)}
              </svg></div>
            <div><div className="eyebrow">Kontur</div><div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 4 }}>Eş değer çizgileri 0,01 aralıkla; her 4. çizgi kalın ve değer etiketli (haritada «Kontur» düğmesi).</div></div>
          </div>
        </div>
      </Block>

      <Block n="4 · Renk" title="Renk yalnız veride" note="Arayüz mürekkep ve gri. Marka koyu yeşili yalnız logo ve «İyi» durumunda; limon sarısı yalnız birincil eylem ve seçili tarihte. İndeks, bölge ve durum paletleri ayrı; renk körü testinden geçirildi.">
        <div style={{ display: 'grid', gap: 18 }}>
          <div><div className="eyebrow">İndeks skalası · algısal olarak düzgün, açıktan koyuya tek yönlü</div><div style={{ height: 22, background: INDEX_CSS, border: '1px solid var(--ink)', marginTop: 6 }} /><div style={{ display: 'flex', marginTop: 6 }}>{[0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => <div key={t} style={{ flex: 1 }}><i style={{ display: 'block', height: 14, background: rampCss(t), border: '1px solid var(--rule-2)' }} /><span className="mono" style={{ fontSize: 10 }}>{t.toFixed(1)}</span></div>)}</div></div>
          <div><div className="eyebrow">Bölge paleti · kategorik, renk körü testi geçti (ΔE ≥ 8 CVD, ≥ 15 normal)</div><div style={{ display: 'flex', marginTop: 6, gap: 0 }}>{ZONE_HEX.map((h, i) => <div key={h} style={{ flex: 1 }}><i style={{ display: 'block', height: 34, background: h, border: '1px solid var(--ink)' }} /><span className="mono" style={{ fontSize: 10.5 }}>{i + 1} · {h}</span></div>)}</div></div>
          <div><div className="eyebrow">Durum · simge + etiketle birlikte</div><div style={{ display: 'flex', gap: 28, marginTop: 6, fontSize: 15, fontWeight: 700 }}>{(['iyi', 'izle', 'dikkat'] as const).map((k) => <span key={k} style={{ color: STATUS[k].color }}>{STATUS[k].mark} {STATUS[k].label} <span className="mono" style={{ fontSize: 11, fontWeight: 400 }}>{STATUS[k].color}</span></span>)}</div></div>
          <div style={{ display: 'flex', gap: 14 }}>
            {[['Kâğıt', 'var(--paper)'], ['Kâğıt 2', 'var(--paper-2)'], ['Kâğıt 3', 'var(--paper-3)'], ['Çizgi', 'var(--rule)'], ['Mürekkep', 'var(--ink)'], ['Grafit', 'var(--ink-2)'], ['Marka', 'var(--brand)'], ['Limon', 'var(--lemon)']].map(([n, c]) => <div key={n} style={{ flex: 1 }}><i style={{ display: 'block', height: 34, background: c, border: '1px solid var(--ink)' }} /><span className="eyebrow">{n}</span></div>)}
          </div>
        </div>
      </Block>

      <Block n="5 · Tipografi" title="Serif başlık, ince sans, mono rakam" note="Newsreader (başlık) · Inter Tight (arayüz) · JetBrains Mono (rakam, tabular). Sayılar büyük ve net, birimler küçük.">
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 28 }}>
          <div><div className="serif" style={{ fontSize: 46, lineHeight: 1.05 }}>Bahçeniz bugün<br />şöyle görünüyor.</div><div className="serif" style={{ fontSize: 22, marginTop: 10 }}>Zayıf kesim yıllardır zayıf kalıyor.</div><p style={{ fontSize: 14, maxWidth: 440, marginTop: 10 }}>Arayüz metni Inter Tight: ince, okunaklı ve sıkı. Etiketler küçük ve harf aralıklı; paragraflar sakin.</p></div>
          <div>
            <div className="eyebrow">Rakamlar</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}><span className="num-big" style={{ fontSize: 58 }}>0,43</span><span className="unit" style={{ fontSize: 14 }}>NDVI</span></div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}><span className="num-big">31,9</span><span className="unit">mm yağış</span></div>
            <table className="tbl" style={{ marginTop: 12 }}><thead><tr><th>Bölge</th><th style={{ textAlign: 'right' }}>Alan</th><th style={{ textAlign: 'right' }}>Fark</th></tr></thead><tbody><tr><td>Güçlü</td><td className="mono" style={{ textAlign: 'right' }}>2,7 da</td><td className="mono" style={{ textAlign: 'right' }}>+%8,5</td></tr><tr><td>Zayıf</td><td className="mono" style={{ textAlign: 'right' }}>6,7 da</td><td className="mono" style={{ textAlign: 'right' }}>−%4,6</td></tr></tbody></table>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}><button className="btn primary">Görev oluştur</button><button className="btn">İkincil</button><button className="btn quiet">Sessiz</button><div className="seg"><button data-on="true">Son 12 ay</button><button>Bu sezon</button></div></div>
      </Block>
    </div>
  )
}
