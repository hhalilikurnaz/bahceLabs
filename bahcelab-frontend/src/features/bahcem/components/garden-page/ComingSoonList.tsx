import { Hourglass } from 'lucide-react'
import type { ComingSoonItem } from './comingSoonItems'

/** Henüz olmayan özelliklerin kısa listesi: tıklanamaz, hangi adımda geleceğini söyler. Her sekmenin altında yer alır. */
export function ComingSoonList({ items, heading }: { items: ComingSoonItem[]; heading?: string }) {
  return (
    <section aria-label={heading ?? 'Yakında'} className="pt-1">
      {heading && <h3 className="mb-1 text-caption font-semibold text-app-text-dim">{heading}</h3>}
      <ul className="divide-y divide-app-border rounded-md border border-dashed border-app-border-strong bg-app-card/50">
        {items.map((item) => (
          <li key={item.title} data-testid="coming-soon" className="flex items-start gap-2.5 px-3 py-2">
            <Hourglass className="mt-0.5 h-4 w-4 shrink-0 text-app-text-dim" aria-hidden />
            <span className="min-w-0 text-small text-app-text-muted">
              <span className="font-semibold text-app-text">{item.title}</span> · {item.step} — {item.text}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
