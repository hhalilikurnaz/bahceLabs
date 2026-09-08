import tree0 from '@/assets/trees/tree-stage-0.png'
import tree6 from '@/assets/trees/tree-stage-6.png'
import tree12 from '@/assets/trees/tree-stage-12.png'
import tree18 from '@/assets/trees/tree-stage-18.png'
import tree24 from '@/assets/trees/tree-stage-24.png'
import tree36 from '@/assets/trees/tree-stage-36.png'
import tree48 from '@/assets/trees/tree-stage-48.png'

export type TreeStage =
  | 'seedling'
  | 'sprout'
  | 'young'
  | 'flowering'
  | 'harvest'
  | 'mature'
  | 'peak'

interface TreeStageConfig {
  src: string
  width: number
  height: number
  alt: string
}

const TREE_STAGES_CONFIG: Record<TreeStage, TreeStageConfig> = {
  seedling: { src: tree0, width: 28, height: 26, alt: 'Dikim aşaması fidesi' },
  sprout: { src: tree6, width: 34, height: 32, alt: 'Köklenme aşaması fidesi' },
  young: { src: tree12, width: 40, height: 36, alt: 'Gelişim aşaması genç ağaç' },
  flowering: { src: tree18, width: 48, height: 47, alt: 'Çiçeklenme aşaması ağacı' },
  harvest: { src: tree24, width: 60, height: 53, alt: 'İlk hasat limon ağacı' },
  mature: { src: tree36, width: 70, height: 63, alt: 'Verim artışı limon ağacı' },
  peak: { src: tree48, width: 80, height: 67, alt: 'Maksimum verim limon ağacı' },
}

interface TreeStageIllustrationProps {
  stage: TreeStage
  isHighlighted?: boolean
}

export function TreeStageIllustration({
  stage,
  isHighlighted,
}: TreeStageIllustrationProps) {
  const config = TREE_STAGES_CONFIG[stage]

  return (
    <div
      className="flex h-[72px] items-end justify-center"
      aria-hidden="true"
    >
      <img
        src={config.src}
        alt={config.alt}
        width={config.width}
        height={config.height}
        className={`pointer-events-none object-contain transition-all duration-200 ${
          isHighlighted
            ? 'drop-shadow-[0_0_16px_rgba(74,222,128,0.45)]'
            : 'drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]'
        }`}
        style={{
          width: config.width,
          height: config.height,
          imageRendering: '-webkit-optimize-contrast',
          filter: isHighlighted
            ? 'contrast(1.14) brightness(1.06) saturate(1.14)'
            : 'contrast(1.08) brightness(1.02) saturate(1.06)',
        }}
      />
    </div>
  )
}
