import type { SimulationPlan } from '../../types'
import { DataField, EmptyState } from '../shared/DataField'

interface ContextPanelProps {
  plan: SimulationPlan
}

export function ContextPanel({ plan }: ContextPanelProps) {
  const { productSelection, plantingPlan, maintenancePlan } = plan

  return (
    <aside className="flex w-72 shrink-0 flex-col gap-4 border-l border-planning-border bg-planning-panel p-4">
      <section className="rounded-xl border border-planning-border bg-planning-surface p-4">
        <h2 className="text-[10px] font-semibold uppercase tracking-wider text-planning-text-dim">
          Seçilen Ürün
        </h2>
        {productSelection.productName ? (
          <div className="mt-3">
            <div className="mb-3 h-24 rounded-lg bg-planning-border/40" />
            <p className="font-semibold">{productSelection.productName}</p>
            <DataField label="Çeşit" value={productSelection.varietyName} />
            <DataField label="Anaç" value={productSelection.rootstockName} />
            <DataField
              label="Önerilen Dikim"
              value={productSelection.recommendedPlantingPeriod}
            />
            <DataField
              label="Verim Başlangıcı"
              value={productSelection.yieldStartPeriod}
            />
          </div>
        ) : (
          <EmptyState
            title="Ürün seçilmedi"
            description="Ürün seçerek devam edin."
          />
        )}
      </section>

      <section className="rounded-xl border border-planning-border bg-planning-surface p-4">
        <h2 className="text-[10px] font-semibold uppercase tracking-wider text-planning-text-dim">
          Dikim Plan Özeti
        </h2>
        {plantingPlan ? (
          <div className="mt-3">
            <DataField
              label="Alan"
              value={plantingPlan.summary.totalAreaHa}
              unit="ha"
            />
            <DataField
              label="Dikim Mesafesi"
              value={plantingPlan.summary.spacingLabel}
            />
            <DataField
              label="Toplam Ağaç"
              value={plantingPlan.summary.plantingPointCount}
              unit="adet"
            />
            <DataField
              label="Sıra Sayısı"
              value={plantingPlan.summary.rowCount}
              unit="sıra"
            />
            <DataField
              label="Tahmini Verim (Simülasyon)"
              value={plantingPlan.summary.estimatedYieldLabel}
              availability={plantingPlan.summary.estimatedYieldAvailability}
            />
          </div>
        ) : (
          <EmptyState
            title="Henüz dikim planı oluşturulmadı"
            description="Dikim mesafesi belirleyerek plan oluşturun."
          />
        )}
      </section>

      <section className="rounded-xl border border-planning-border bg-planning-surface p-4">
        <h2 className="text-[10px] font-semibold uppercase tracking-wider text-planning-text-dim">
          Bakım Plan Özeti
        </h2>
        {maintenancePlan ? (
          <div className="mt-3">
            <DataField
              label="Sulama"
              value={maintenancePlan.irrigation.method}
              availability={maintenancePlan.irrigation.availability}
            />
            <DataField
              label="Sıklık"
              value={maintenancePlan.irrigation.frequency}
            />
            <DataField
              label="Besleme"
              value={maintenancePlan.fertilization.schedule}
              availability={maintenancePlan.fertilization.availability}
            />
            <DataField
              label="Budama"
              value={maintenancePlan.pruning.schedule}
              availability={maintenancePlan.pruning.availability}
            />
          </div>
        ) : (
          <EmptyState
            title="Bakım planı henüz oluşturulmadı"
            description="Bakım planı adımına geçerek oluşturun."
          />
        )}
        <button
          type="button"
          className="mt-4 w-full rounded-lg border border-planning-border px-4 py-2 text-xs text-planning-text-muted"
        >
          Detaylı Bakım Planı
        </button>
      </section>
    </aside>
  )
}
