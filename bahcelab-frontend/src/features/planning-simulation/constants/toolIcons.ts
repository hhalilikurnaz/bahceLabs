import type { LucideIcon } from 'lucide-react'
import {
  MousePointer2,
  PlusCircle,
  SquareDashed,
  Trash2,
  Waves,
} from 'lucide-react'
import type { PlanningToolId } from '../types'

export interface ToolDefinition {
  id: PlanningToolId
  label: string
  icon: LucideIcon
}

export const PLANNING_TOOLS: ToolDefinition[] = [
  { id: 'select', label: 'Seçim Aracı', icon: MousePointer2 },
  { id: 'add-point', label: 'Dikim Noktası Ekle', icon: PlusCircle },
  { id: 'draw-irrigation', label: 'Sulama Hattı Çiz', icon: Waves },
  { id: 'define-region', label: 'Bölge Tanımla', icon: SquareDashed },
  { id: 'delete-edit', label: 'Sil / Düzenle', icon: Trash2 },
]
