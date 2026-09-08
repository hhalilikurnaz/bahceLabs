import { FEATURE_FOOTER_ITEMS } from '../../constants/planningSteps'

export function FeatureFooter() {
  return (
    <footer className="flex shrink-0 items-center justify-around border-t border-planning-border bg-planning-surface px-4 py-1.5">
      {FEATURE_FOOTER_ITEMS.map((item) => (
        <div key={item.label} className="text-center">
          <p className="text-[10px] font-medium text-planning-accent">
            {item.label}
          </p>
          <p className="text-[9px] text-planning-text-dim">{item.description}</p>
        </div>
      ))}
    </footer>
  )
}
