import { FEATURE_FOOTER_ITEMS } from '../../constants/planningSteps'

export function FeatureFooter() {
  return (
    <footer className="flex items-center justify-around border-t border-planning-border bg-planning-surface px-6 py-3">
      {FEATURE_FOOTER_ITEMS.map((item) => (
        <div key={item.label} className="text-center">
          <p className="text-xs font-medium text-planning-accent">{item.label}</p>
          <p className="text-[10px] text-planning-text-dim">{item.description}</p>
        </div>
      ))}
    </footer>
  )
}
