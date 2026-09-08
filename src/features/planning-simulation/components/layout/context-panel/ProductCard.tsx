import lemonMeyerImage from '@/assets/products/lemon-meyer.jpg'
import type { ProductSelection } from '../../../types'
import { EmptyState } from '../../shared/DataField'
import { PlanningCard } from '../../shared/PlanningCard'

interface ProductCardProps {
  productSelection: ProductSelection
  onChangeProduct?: () => void
  className?: string
}

function SummaryRow({
  label,
  value,
}: {
  label: string
  value: string | null
}) {
  return (
    <div className="flex flex-1 items-center justify-between gap-2">
      <span className="text-[10px] text-planning-text-muted">{label}</span>
      <span className="text-right text-[10px] font-medium text-planning-text">
        {value ?? '—'}
      </span>
    </div>
  )
}

export function ProductCard({
  productSelection,
  onChangeProduct,
  className = '',
}: ProductCardProps) {
  const hasProduct = Boolean(productSelection.productName)
  const productTitle =
    productSelection.varietyName && productSelection.productName
      ? `${productSelection.productName} (${productSelection.varietyName})`
      : productSelection.productName

  return (
    <PlanningCard
      compact
      fill
      title="Seçilen Ürün"
      className={className}
      bodyClassName="flex min-h-0 flex-1 flex-col px-3 py-3"
      footer={
        hasProduct ? (
          <button
            type="button"
            onClick={onChangeProduct}
            className="w-full rounded-md border border-planning-border bg-planning-surface px-3 py-1.5 text-[10px] font-medium text-planning-accent transition-colors hover:border-planning-accent/40"
          >
            Ürünü Değiştir
          </button>
        ) : undefined
      }
    >
      {hasProduct ? (
        <div className="flex h-full min-h-0 flex-1 flex-col justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-planning-border bg-planning-surface">
              <img
                src={productSelection.imageUrl ?? lemonMeyerImage}
                alt={productSelection.productName ?? 'Seçilen ürün'}
                className="h-full w-full object-cover"
              />
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-semibold leading-tight text-planning-text">
                {productTitle}
              </p>
              <div className="mt-1.5 space-y-1">
                <div className="flex justify-between gap-2 text-[10px]">
                  <span className="text-planning-text-dim">Çeşit</span>
                  <span className="font-medium text-planning-text-muted">
                    {productSelection.varietyName ?? '—'}
                  </span>
                </div>
                <div className="flex justify-between gap-2 text-[10px]">
                  <span className="text-planning-text-dim">Anaç</span>
                  <span className="font-medium text-planning-text-muted">
                    {productSelection.rootstockName ?? '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col justify-around border-t border-planning-border-subtle pt-2">
            <SummaryRow
              label="Önerilen Dikim Zamanı"
              value={productSelection.recommendedPlantingPeriod}
            />
            <SummaryRow
              label="Verim Başlangıcı"
              value={productSelection.yieldStartPeriod}
            />
          </div>
        </div>
      ) : (
        <EmptyState
          title="Ürün seçilmedi"
          description="Ürün seçerek devam edin."
        />
      )}
    </PlanningCard>
  )
}
