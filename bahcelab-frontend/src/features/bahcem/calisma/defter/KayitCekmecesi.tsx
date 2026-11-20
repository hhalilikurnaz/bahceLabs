import { useEffect, useRef, type ReactNode } from 'react'

/**
 * Yeni kayıt çekmecesi (ADIM 11 · Dilim 1): sayfanın dibine gömülü form yerine sabit panel. ≤ 900 px'te alttan açılır (harita üstte, aynı görünümde kalır); geniş ekranda sağ altta durur.
 * Esc kapatır; açılınca ilk alana odaklanır. Kapatılınca taslak korunur (form değerleri cihazda saklanır).
 */
export function KayitCekmecesi({ kapat, children }: { kapat: () => void; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const tus = (e: KeyboardEvent) => e.key === 'Escape' && kapat()
    window.addEventListener('keydown', tus)
    ref.current?.focus()
    return () => window.removeEventListener('keydown', tus)
  }, [kapat])
  return (
    <aside ref={ref} tabIndex={-1} role="dialog" aria-label="Yeni saha kaydı" data-testid="kayit-cekmecesi"
      className="fixed inset-x-0 bottom-0 z-30 max-h-[58dvh] overflow-y-auto border-t border-[var(--rule-2)] bg-[var(--paper)] p-3 shadow-lg outline-none min-[901px]:inset-x-auto min-[901px]:bottom-4 min-[901px]:right-4 min-[901px]:max-h-[calc(100dvh-160px)] min-[901px]:w-[440px] min-[901px]:border">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-[16px] font-semibold">Yeni kayıt</h2>
        <button type="button" onClick={kapat} data-testid="kayit-kapat" className="btn quiet">Kapat</button>
      </div>
      {children}
    </aside>
  )
}
