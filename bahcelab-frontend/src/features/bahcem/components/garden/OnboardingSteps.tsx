import { Satellite, Sprout, Spline } from 'lucide-react'
import { AddGardenMenu } from './AddGardenMenu'

const STEPS = [
  { icon: Spline, title: 'Sınırı çizin veya dosya yükleyin', text: 'Haritada bahçenizin çevresini çizin ya da KML/KMZ/GeoJSON dosyası yükleyin.' },
  { icon: Sprout, title: 'Bilgileri girin', text: 'Bahçenin adını, ürününü ve çeşidini yazın; dekar otomatik hesaplanır.' },
  { icon: Satellite, title: 'Uydu verisi gelsin', text: 'Son 13 ayın uydu görüntüleri hazırlanır; durum ve hava burada görünür.' },
] as const

/** Hiç bahçe yokken: "İlk bahçeni ekle" ve 3 adımlı yönlendirme. */
export function OnboardingSteps() {
  return (
    <div className="px-1 py-4" data-testid="onboarding">
      <h2 className="font-display text-h1 text-app-text">İlk bahçenizi ekleyin</h2>
      <p className="mt-1 text-body text-app-text-muted">Üç adımda uydu ve hava verisiyle izlemeye başlayın.</p>
      <ol className="mt-4 space-y-3">
        {STEPS.map(({ icon: Icon, title, text }, index) => (
          <li key={title} className="flex gap-3 rounded-md border border-app-border bg-app-card p-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-app-accent-soft text-app-accent">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <span>
              <span className="block text-body font-semibold text-app-text">
                {index + 1}. {title}
              </span>
              <span className="block text-small text-app-text-muted">{text}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-5">
        <AddGardenMenu />
      </div>
    </div>
  )
}
