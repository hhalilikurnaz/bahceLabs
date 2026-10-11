import { RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { Button, Card, TextField } from '@/components/ui'
import { describeError } from '../../api/gardensApi'
import { useResetOverride, useSetOverride, type Phenology, type Stage } from '../../api/agroApi'
import { formatDate } from '../../lib/dates'
import { RuleBadge } from './RuleBadge'
import { useToast } from '../layout/toastContext'

const toMmdd = (iso: string) => iso.slice(5)

function StageRow({ gardenId, stage }: { gardenId: string; stage: Stage }) {
  const [from, setFrom] = useState(stage.baslangic)
  const [to, setTo] = useState(stage.bitis)
  const set = useSetOverride(gardenId)
  const reset = useResetOverride(gardenId)
  const toast = useToast()
  const dirty = from !== stage.baslangic || to !== stage.bitis

  function save() {
    set.mutate(
      { evre: stage.kod, baslangic: toMmdd(from), bitis: toMmdd(to) },
      { onSuccess: () => toast.show(`“${stage.ad}” tarihleri bu bahçe için güncellendi.`), onError: (err) => toast.show(describeError(err)) },
    )
  }

  return (
    <li className="rounded-md bg-app-text/5 p-2.5" data-testid="stage-row" data-stage={stage.kod}>
      <p className="flex items-center justify-between gap-2 text-small font-semibold text-app-text">
        {stage.ad}
        {stage.ozel && <span className="text-caption font-medium text-app-accent">bahçe düzeltmesi</span>}
      </p>
      <div className="mt-1.5 grid grid-cols-2 gap-2">
        <TextField label="Başlangıç" type="date" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} />
        <TextField label="Bitiş" type="date" value={to} onChange={(e) => e.target.value && setTo(e.target.value)} />
      </div>
      <p className="mt-1 text-caption text-app-text-dim">Şimdi: {formatDate(stage.baslangic)} – {formatDate(stage.bitis)}</p>
      <div className="mt-1.5 flex flex-wrap gap-2">
        <Button variant="primary" disabled={!dirty || to < from} loading={set.isPending} onClick={save}>
          Kaydet
        </Button>
        {stage.ozel && (
          <Button icon={<RotateCcw className="h-4 w-4" aria-hidden />} loading={reset.isPending} onClick={() => reset.mutate(stage.kod)}>
            Katalog değerine dön
          </Button>
        )}
      </div>
    </li>
  )
}

/** Bahçe düzeyinde fenoloji evresi tarih düzeltmesi: yalnızca bu bahçeyi etkiler; katalog değeri değişmez. */
export function PhenologyEditor({ gardenId, phenology }: { gardenId: string; phenology: Phenology }) {
  const current = phenology.evreler.filter((e) => e.sezon === phenology.sezon)
  return (
    <Card aria-label="Fenoloji evreleri" className="space-y-2 p-3" data-testid="phenology-editor">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-body font-semibold text-app-text">Evre tarihleri ({phenology.sezon}–{phenology.sezon + 1} sezonu)</h4>
        <RuleBadge meta={phenology.kural} />
      </div>
      <p className="text-small text-app-text-muted">Çiçeklenme gibi evrelerin tarihi bölgeye ve yıla göre değişir; kendi bahçenizde gözlediğiniz tarihlerle düzeltebilirsiniz.</p>
      <ul className="space-y-2">
        {current.map((stage) => (
          <StageRow key={`${stage.kod}-${stage.baslangic}-${stage.bitis}-${stage.ozel}`} gardenId={gardenId} stage={stage} />
        ))}
      </ul>
    </Card>
  )
}
