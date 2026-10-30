import { Droplets } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useSulamaPlani } from '../../api/sulamaApi'
import { sulamaSatiri } from '../../lib/karar'
import { sulamaPath } from '../../lib/routes'

/** Durum/Bugün kartında TEK satır: «Sulama: Perşembe, 2 sa 25 dk» + «Plana git». Plan yoksa (profil/veri yok) hiç çizilmez; ayrıntı Sulama planı sayfasındadır. */
export function SulamaSatiri({ gardenId }: { gardenId: string }) {
  const plan = useSulamaPlani(gardenId).data
  const satir = plan ? sulamaSatiri(plan) : null
  if (!satir) return null
  return (
    <p className="mt-2 flex min-h-11 items-center gap-2 border-t border-app-border pt-2 text-body" data-testid="bugun-sulama-satiri">
      <Droplets className="h-5 w-5 shrink-0 text-app-water" aria-hidden />
      <span className="min-w-0 flex-1 font-semibold">{satir}</span>
      <Link to={sulamaPath(gardenId)} data-testid="bugun-plana-git" className="flex h-9 shrink-0 items-center rounded-md border border-app-border px-3 text-small font-semibold hover:border-app-text max-[560px]:h-11">Plana git</Link>
    </p>
  )
}
