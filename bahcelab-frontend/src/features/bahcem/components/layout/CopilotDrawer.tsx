import { Send, Sparkles } from 'lucide-react'
import { Drawer } from '@/components/ui'
import { useBahcemStore } from '../../stores/bahcemStore'

/** Sağ üstteki Copilot düğmesi (koyu harita denetimi). */
export function CopilotButton() {
  const open = useBahcemStore((s) => s.copilotOpen)
  const setOpen = useBahcemStore((s) => s.setCopilotOpen)

  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      aria-expanded={open}
      aria-controls="copilot-drawer"
      className={`surface-dark absolute right-3 top-3 z-20 flex h-11 items-center gap-2 rounded-full border border-app-border bg-app-panel px-4 text-body font-semibold shadow-e2 transition-all duration-[var(--duration-panel)] hover:bg-app-card-hover ${
        open ? 'pointer-events-none opacity-0' : 'text-app-text opacity-100'
      }`}
    >
      <Sparkles className="h-4 w-4 text-lemon" strokeWidth={1.9} aria-hidden />
      Copilot
    </button>
  )
}

/** Adım 16'ya kadar "yakında": çekmece açılır, yazı alanı kapalıdır. */
export function CopilotDrawer() {
  const open = useBahcemStore((s) => s.copilotOpen)
  const setOpen = useBahcemStore((s) => s.setCopilotOpen)

  return (
    <Drawer
      id="copilot-drawer"
      title="Copilot"
      open={open}
      onClose={() => setOpen(false)}
      icon={<Sparkles className="h-4 w-4" strokeWidth={1.9} aria-hidden />}
      footer={
        <form onSubmit={(e) => e.preventDefault()}>
          <div className="flex items-end gap-2 rounded-md border border-app-border bg-app-bg p-2">
            <textarea
              disabled
              rows={2}
              aria-label="Mesajınız"
              placeholder="Copilot yakında – Adım 16"
              className="min-h-11 flex-1 resize-none bg-transparent px-2 py-1.5 text-body text-app-text outline-none placeholder:text-app-text-dim disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled
              aria-label="Gönder"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-app-card text-app-text-dim disabled:cursor-not-allowed"
            >
              <Send className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </form>
      }
    >
      <div className="rounded-md border border-app-border bg-app-card p-4">
        <p className="font-display text-h2 text-app-text">Yakında</p>
        <p className="mt-2 text-body text-app-text-muted">
          BahçeLab Copilot, bahçelerinizin uydu, hava ve günlük verilerini birlikte yorumlayıp gözlemler ve olası nedenler
          sunacak.
        </p>
        <p className="mt-3 rounded-sm bg-app-bg px-3 py-2 text-caption text-app-text-dim">
          Copilot Adım 16'da açılacak; o zamana kadar soru alanı kapalıdır.
        </p>
      </div>
    </Drawer>
  )
}
