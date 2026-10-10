interface SparklineProps {
  values: number[]
  width?: number
  height?: number
  className?: string
  /** Erişilebilir özet; verilmezse dekoratif sayılır */
  label?: string
}

/** Mini çizgi grafik; renk `currentColor`. Son noktada nokta işareti. */
export function Sparkline({ values, width = 96, height = 28, className, label }: SparklineProps) {
  const finite = values.filter((v) => Number.isFinite(v))
  if (finite.length < 2) return null
  const min = Math.min(...finite)
  const max = Math.max(...finite)
  const span = max - min || 1
  const pad = 3
  const x = (i: number) => pad + (i / (values.length - 1)) * (width - pad * 2)
  const y = (v: number) => height - pad - ((v - min) / span) * (height - pad * 2)
  const points = values.flatMap((v, i) => (Number.isFinite(v) ? [[x(i), y(v)] as const] : []))
  const d = points.map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${px.toFixed(1)} ${py.toFixed(1)}`).join(' ')
  const last = points[points.length - 1]
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-testid="sparkline"
    >
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r={2.5} fill="currentColor" />
    </svg>
  )
}
