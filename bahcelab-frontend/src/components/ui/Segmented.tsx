import { cx } from './cx'

interface SegmentedProps<T extends string> {
  label: string
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string }[]
  className?: string
}

/** Tek seçimli düğme grubu (radiogroup); her düğme 44 px yüksekliğinde. */
export function Segmented<T extends string>({ label, value, onChange, options, className }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={cx('inline-flex rounded-md bg-app-text/8 p-1', className)}>
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cx(
              'min-h-9 flex-1 rounded-sm px-3 text-small font-semibold transition-colors duration-[var(--duration-fast)]',
              selected ? 'bg-app-card text-app-text shadow-e1' : 'text-app-text-muted hover:text-app-text',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
