import { useEffect } from 'react'
import { Send, Sparkles, X } from 'lucide-react'
import { useBahcemStore } from '../../stores/bahcemStore'

export function CopilotButton() {
  const open = useBahcemStore((s) => s.copilotOpen)
  const setOpen = useBahcemStore((s) => s.setCopilotOpen)

  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      aria-expanded={open}
      aria-controls="copilot-drawer"
      className={`absolute right-3 top-3 z-20 flex h-11 items-center gap-2 rounded-full border border-app-border bg-app-panel px-4 text-[14px] font-medium shadow-xl transition-all duration-300 hover:bg-app-card-hover focus-visible:outline-2 focus-visible:outline-app-accent ${
        open ? 'pointer-events-none opacity-0' : 'text-app-text opacity-100'
      }`}
    >
      <Sparkles className="h-4 w-4 text-app-accent" strokeWidth={1.9} aria-hidden />
      Copilot
    </button>
  )
}

export function CopilotDrawer() {
  const open = useBahcemStore((s) => s.copilotOpen)
  const setOpen = useBahcemStore((s) => s.setCopilotOpen)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  return (
    <aside
      id="copilot-drawer"
      aria-label="Copilot"
      aria-hidden={!open}
      inert={!open}
      className={`absolute inset-y-0 right-0 z-30 flex w-[min(380px,100vw)] flex-col border-l border-app-border bg-app-panel shadow-2xl transition-transform duration-300 ease-out ${
        open ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-app-border px-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-app-accent-soft text-app-accent">
            <Sparkles className="h-4 w-4" strokeWidth={1.9} aria-hidden />
          </span>
          <h2 className="text-[15px] font-semibold text-app-text">Copilot</h2>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Copilot'u kapat"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-app-text-muted transition-colors hover:bg-app-card hover:text-app-text"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="rounded-2xl bg-app-card p-4">
          <p className="text-[14px] font-medium text-app-text">Merhaba! 👋</p>
          <p className="mt-2 text-[13px] leading-relaxed text-app-text-muted">
            Ben BahçeLab Copilot. Bahçelerinizin uydu, hava durumu ve günlük verilerini birlikte
            yorumlayıp size gözlemler ve olası nedenler sunacağım.
          </p>
          <p className="mt-3 rounded-lg bg-app-bg/60 px-3 py-2 text-[12px] text-app-text-dim">
            Copilot çok yakında. Bahçe eklediğinizde burada soru sorabileceksiniz.
          </p>
        </div>
      </div>

      <form
        onSubmit={(e) => e.preventDefault()}
        className="shrink-0 border-t border-app-border p-3"
      >
        <div className="flex items-end gap-2 rounded-2xl border border-app-border bg-app-bg/60 p-2">
          <textarea
            disabled
            rows={2}
            aria-label="Mesajınız"
            placeholder="Copilot çok yakında…"
            className="min-h-10 flex-1 resize-none bg-transparent px-2 py-1.5 text-[14px] text-app-text outline-none placeholder:text-app-text-dim disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled
            aria-label="Gönder"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-app-card text-app-text-dim disabled:cursor-not-allowed"
          >
            <Send className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </form>
    </aside>
  )
}
