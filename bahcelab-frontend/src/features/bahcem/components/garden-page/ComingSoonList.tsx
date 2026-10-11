import { Hourglass } from 'lucide-react'
import { Badge } from '@/components/ui'

import type { ComingSoonItem } from './comingSoonItems'

/** Henüz olmayan özelliklerin yeri: tıklanamaz, hangi adımda geleceğini söyler (işlevsiz menü ucu bırakılmaz). */
export function ComingSoonList({ items, heading }: { items: ComingSoonItem[]; heading?: string }) {
  return (
    <section aria-label={heading ?? 'Yakında'} className="space-y-2">
      {heading && <h3 className="text-small font-semibold uppercase tracking-wide text-app-text-dim">{heading}</h3>}
      <ul className="grid grid-cols-1 gap-2 @2xl:grid-cols-2">
        {items.map((item) => (
          <li key={item.title} data-testid="coming-soon" className="flex gap-3 rounded-md border border-dashed border-app-border-strong bg-app-card/60 p-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-app-text/8 text-app-text-muted">
              <Hourglass className="h-4 w-4" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-body font-semibold text-app-text">{item.title}</span>
                <Badge tone="neutral">Yakında – {item.step}</Badge>
              </span>
              <span className="mt-0.5 block text-small text-app-text-muted">{item.text}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
