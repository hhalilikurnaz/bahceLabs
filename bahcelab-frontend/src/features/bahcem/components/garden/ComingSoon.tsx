import { Hourglass } from 'lucide-react'
import { EmptyState } from '@/components/ui'

/** Henüz olmayan sekme: dürüstçe "yakında" der ve hangi adımda geleceğini söyler. */
export function ComingSoon({ title, step, text }: { title: string; step: string; text: string }) {
  return (
    <EmptyState
      icon={<Hourglass className="h-7 w-7" strokeWidth={1.5} aria-hidden />}
      title={`${title} · Yakında – ${step}`}
      description={text}
    />
  )
}
