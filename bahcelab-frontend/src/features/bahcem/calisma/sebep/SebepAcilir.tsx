import { useState } from 'react'
import { SebepKarti } from './SebepKarti'

/** «Olası sebepler (kesin değil)» açılır satırı: kart yalnız AÇILINCA yüklenir (sebep hesabı olay başına sorgu). */
export function SebepAcilir({ gardenId, olayId, testId }: { gardenId: string; olayId: string; testId: string }) {
  const [acik, setAcik] = useState(false)
  return (
    <details className="mt-1 text-small" data-testid={testId} onToggle={(e) => setAcik((e.currentTarget as HTMLDetailsElement).open)}>
      <summary className="flex min-h-9 cursor-pointer items-center font-semibold text-app-text max-[560px]:min-h-11">Olası sebepler (kesin değil)</summary>
      {acik && <div className="pb-1"><SebepKarti gardenId={gardenId} olayId={olayId} baslik={false} /></div>}
    </details>
  )
}
