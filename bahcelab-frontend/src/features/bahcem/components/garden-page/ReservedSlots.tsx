/** Adım 8'in "Bahçe skoru" ve "Bugün" kartları için ayrılmış yerler; içerik gelene kadar görünmez ama düzen sabit kalır. */
export function ReservedSlots() {
  return (
    <div className="hidden" data-slot="step8" aria-hidden>
      <div data-slot="garden-score" />
      <div data-slot="today" />
    </div>
  )
}
