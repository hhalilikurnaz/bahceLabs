import type { KeyboardEvent, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cx } from './cx'

export interface TabItem<T extends string> {
  id: T
  label: string
  /** Verilirse sekme bir rota bağlantısıdır */
  to?: string
  badge?: ReactNode
}

interface TabsProps<T extends string> {
  label: string
  items: TabItem<T>[]
  value: T
  onChange?: (id: T) => void
  /** Paneller `${idPrefix}-panel-${id}` / sekmeler `${idPrefix}-tab-${id}` kimliğini kullanır */
  idPrefix?: string
  className?: string
}

/** Erişilebilir sekme çubuğu: ok tuşlarıyla gezinme, Home/End, 44 px hedef. */
export function Tabs<T extends string>({ label, items, value, onChange, idPrefix = 'tabs', className }: TabsProps<T>) {
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End']
    if (!keys.includes(event.key)) return
    const tabs = [...event.currentTarget.querySelectorAll<HTMLElement>('[role=tab]')]
    const current = tabs.findIndex((tab) => tab === document.activeElement)
    let next = current
    if (event.key === 'ArrowRight') next = (current + 1) % tabs.length
    if (event.key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = tabs.length - 1
    event.preventDefault()
    tabs[next]?.focus()
    tabs[next]?.click()
  }

  return (
    <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className={cx('flex gap-1 overflow-x-auto', className)}>
      {items.map((item) => {
        const selected = item.id === value
        const classes = cx(
          '-mb-px inline-flex min-h-11 shrink-0 items-center gap-1.5 border-b-2 px-2.5 text-body font-semibold transition-colors duration-[var(--duration-fast)]',
          selected ? 'border-app-accent text-app-text' : 'border-transparent text-app-text-muted hover:text-app-text',
        )
        const common = {
          role: 'tab' as const,
          id: `${idPrefix}-tab-${item.id}`,
          'aria-selected': selected,
          'aria-controls': `${idPrefix}-panel-${item.id}`,
          tabIndex: selected ? 0 : -1,
          className: classes,
        }
        return item.to ? (
          <Link key={item.id} to={item.to} {...common}>
            {item.label}
            {item.badge}
          </Link>
        ) : (
          <button key={item.id} type="button" onClick={() => onChange?.(item.id)} {...common}>
            {item.label}
            {item.badge}
          </button>
        )
      })}
    </div>
  )
}
