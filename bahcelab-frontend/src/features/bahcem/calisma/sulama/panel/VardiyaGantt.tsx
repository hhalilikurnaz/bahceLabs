import type { Vardiya } from '../../../api/sulamaPanelApi'
import { sayi } from '../../../lib/format'

const dk = (hhmm: string): number => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
const saatMetni = (m: number): string => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

/**
 * Vana programı (Gantt, prototip): saat ekseni, vana başına çubuk (başlangıç–bitiş · m³), kırmızı «şu an» çizgisi. Debi yoksa saat yoktur: çubuk çizilmez, satır olarak sıra ve miktar gösterilir.
 * `simdiDk`: «şu an» (gün içinde dakika); null → çizgi yok. Gece yarısını aşan vardiya 24:00'te kesilir ve «+1 gün» notu düşer.
 */
export function VardiyaGantt({ v, simdiDk = null, aktifVana = null, testId = 'vardiya-gantt' }: { v: Vardiya; simdiDk?: number | null; aktifVana?: string | null; testId?: string }) {
  const saatli = v.kalemler.filter((k) => k.baslangic && k.bitis && k.sure_dk)
  if (saatli.length === 0) {
    return (
      <ul className="divide-y divide-app-border rounded-md border border-app-border" data-testid={testId}>
        {v.kalemler.map((k) => <li key={k.sektor} className="flex justify-between px-3 py-2 text-small" data-testid="vardiya-kalemi"><b>{k.sektor === 'Bahçe' ? 'Bahçe' : k.sektor}</b><span className="tabular-nums">{sayi(k.m3, 0)} m³ · saat yok</span></li>)}
      </ul>
    )
  }
  const bas = dk(v.baslangic)
  const bit = Math.max(...saatli.map((k) => dk(k.baslangic as string) + (k.sure_dk as number)))
  const eksenBas = Math.min(240, Math.floor(bas / 60) * 60)
  const eksenBit = Math.min(1440, Math.max(1320, Math.ceil(bit / 60) * 60))
  const W = 520
  const sol = 36
  const sag = 8
  const X = (m: number) => sol + ((Math.min(m, eksenBit) - eksenBas) / (eksenBit - eksenBas)) * (W - sol - sag)
  const satir = 26
  const H = v.kalemler.length * satir + 22
  const tikler: number[] = []
  for (let m = Math.ceil(eksenBas / 180) * 180; m <= eksenBit; m += 180) tikler.push(m)
  const asan = bit > 1440
  return (
    <div data-testid={testId}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label={`Vana programı: ${v.kalemler.map((k) => `${k.sektor} ${k.baslangic ?? 'saat yok'}${k.bitis ? `–${k.bitis}` : ''}`).join(', ')}`}>
        {v.kalemler.map((k, i) => {
          const y = i * satir
          const b = k.baslangic && k.bitis && k.sure_dk ? dk(k.baslangic) : null
          const e = b !== null ? b + (k.sure_dk as number) : null
          const acik = simdiDk !== null && b !== null && e !== null && simdiDk >= b && simdiDk < e
          return (
            <g key={k.sektor} data-testid="vardiya-kalemi" data-vana={k.sektor} data-acik={String(acik || aktifVana === k.sektor)}>
              <rect x={sol} y={y + 3} width={W - sol - sag} height={satir - 6} fill="var(--color-app-card-hover)" rx={2} />
              <text x={0} y={y + 17} fontSize={12} fontWeight={700} fill="var(--color-app-text)">{k.sektor === 'Bahçe' ? 'Bahçe' : k.sektor}</text>
              {b !== null && e !== null ? (
                <>
                  <rect x={X(b)} y={y + 3} width={Math.max(3, X(e) - X(b))} height={satir - 6} rx={2} fill={acik || aktifVana === k.sektor ? 'var(--color-app-text)' : 'var(--color-app-water)'} opacity={acik ? 1 : 0.55} />
                  <text x={Math.min(X(b) + 5, W - 120)} y={y + 17} fontSize={12} fontWeight={600} fill={acik ? 'var(--color-app-on-primary)' : 'var(--color-app-text)'} style={{ paintOrder: 'stroke', stroke: acik ? 'none' : 'var(--color-app-card)', strokeWidth: 3 }}>{k.baslangic}–{k.bitis} · {sayi(k.m3, 0)} m³</text>
                </>
              ) : <text x={sol + 6} y={y + 17} fontSize={12} fill="var(--color-app-text-dim)">saat yok · {sayi(k.m3, 0)} m³</text>}
            </g>
          )
        })}
        {tikler.map((m) => <text key={m} x={X(m)} y={H - 4} fontSize={12} textAnchor="middle" fill="var(--color-app-text-dim)">{saatMetni(m)}</text>)}
        {simdiDk !== null && simdiDk >= eksenBas && simdiDk <= eksenBit && <g data-testid="gantt-simdi"><line x1={X(simdiDk)} x2={X(simdiDk)} y1={0} y2={H - 16} stroke="var(--color-app-danger)" strokeWidth={1.5} /><circle cx={X(simdiDk)} cy={0} r={3.5} fill="var(--color-app-danger)" /></g>}
      </svg>
      {asan && <p className="mt-1 text-caption text-app-text-dim" data-testid="gantt-asan">Vardiya gece yarısını aşıyor ({saatMetni(bit)} ertesi gün).</p>}
    </div>
  )
}
