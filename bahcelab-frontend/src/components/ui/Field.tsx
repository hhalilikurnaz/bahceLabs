import { ChevronDown } from 'lucide-react'
import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { cx } from './cx'

const CONTROL =
  'min-h-11 w-full rounded-md border border-app-border-strong bg-app-card px-3 text-body text-app-text placeholder:text-app-text-dim transition-colors duration-[var(--duration-fast)] hover:border-app-accent focus:border-app-accent disabled:cursor-not-allowed disabled:opacity-60'

interface FieldShellProps {
  label: string
  hint?: ReactNode
  error?: string | null
  /** Etiketi görsel olarak gizler (ekran okuyucuya açık kalır) */
  hideLabel?: boolean
  className?: string
}

function FieldShell({
  id,
  label,
  hint,
  error,
  hideLabel = false,
  className,
  children,
}: FieldShellProps & { id: string; children: ReactNode }) {
  return (
    <div className={cx('block', className)}>
      <label htmlFor={id} className={cx('mb-1.5 block text-small font-semibold text-app-text', hideLabel && 'sr-only')}>
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-caption text-app-text-dim">{hint}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-caption font-medium text-app-danger">
          {error}
        </p>
      )}
    </div>
  )
}

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'>, FieldShellProps {}

export function TextField({ label, hint, error, hideLabel, className, ...rest }: TextFieldProps) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} hideLabel={hideLabel} className={className}>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={CONTROL}
        {...rest}
      />
    </FieldShell>
  )
}

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'>, FieldShellProps {}

export function SelectField({ label, hint, error, hideLabel, className, children, ...rest }: SelectFieldProps) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} hideLabel={hideLabel} className={className}>
      <span className="relative block">
        <select
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cx(CONTROL, 'cursor-pointer appearance-none pr-9')}
          {...rest}
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-text-muted"
          aria-hidden
        />
      </span>
    </FieldShell>
  )
}

interface SwitchProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  hint?: ReactNode
}

/** Aç/kapa anahtarı (checkbox rolü, 44 px yüksekliğinde satır). */
export function Switch({ label, checked, onChange, disabled = false, hint }: SwitchProps) {
  return (
    <label className={cx('flex min-h-11 cursor-pointer items-center justify-between gap-3', disabled && 'cursor-not-allowed opacity-60')}>
      <span>
        <span className="block text-body font-semibold text-app-text">{label}</span>
        {hint && <span className="block text-caption text-app-text-dim">{hint}</span>}
      </span>
      <span className="relative inline-flex shrink-0">
        <input
          type="checkbox"
          role="switch"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="h-6 w-11 rounded-full bg-app-border-strong transition-colors peer-checked:bg-app-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-app-accent" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-e1 transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  )
}
