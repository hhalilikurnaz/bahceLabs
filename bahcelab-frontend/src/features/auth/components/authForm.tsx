import { Eye, EyeOff } from 'lucide-react'
import { useId, useState, type InputHTMLAttributes } from 'react'
import { authFieldClass, authLabelClass } from './AuthShell'

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'className'> & { label: string; hint?: string }

/** Şifre alanı: göster/gizle düğmesi (≥44 px) ve alanla ilişkili ipucu. */
export function PasswordField({ label, hint, ...rest }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)
  const hintId = useId()
  return (
    <div>
      <label className="block">
        <span className={authLabelClass}>{label}</span>
        <span className="relative mt-1.5 block">
          <input
            {...rest}
            type={visible ? 'text' : 'password'}
            aria-describedby={hint ? hintId : undefined}
            className={`${authFieldClass} !mt-0 pr-12`}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-pressed={visible}
            aria-label={visible ? 'Şifreyi gizle' : 'Şifreyi göster'}
            className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-app-text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-leaf-deep"
          >
            {visible ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
          </button>
        </span>
      </label>
      {hint && (
        <p id={hintId} className="mt-1 text-caption text-app-text-muted">
          {hint}
        </p>
      )}
    </div>
  )
}
