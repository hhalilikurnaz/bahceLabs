import type { PlanningStepId } from '../types'

export interface PlanningStepDefinition {
  id: PlanningStepId
  order: number
  label: string
  description: string
}

export const PLANNING_STEPS: PlanningStepDefinition[] = [
  {
    id: 'land',
    order: 1,
    label: 'ARAZİ',
    description: 'Alanını Tanımla',
  },
  {
    id: 'product',
    order: 2,
    label: 'ÜRÜN SEÇİMİ',
    description: 'Ne Ekeceğiz?',
  },
  {
    id: 'planting',
    order: 3,
    label: 'PLANLAMA',
    description: 'Dikim Planı',
  },
  {
    id: 'maintenance',
    order: 4,
    label: 'BAKIM PLANI',
    description: 'Sulama & Besleme',
  },
  {
    id: 'simulation',
    order: 5,
    label: 'SİMÜLASYON',
    description: 'Gelişim & Hasat',
  },
]

export const PLANNING_TOOLS = [
  { id: 'select', label: 'Seçim Aracı', icon: '↖' },
  { id: 'add-point', label: 'Dikim Noktası Ekle', icon: '⊕' },
  { id: 'draw-irrigation', label: 'Sulama Hattı Çiz', icon: '〰' },
  { id: 'define-region', label: 'Bölge Tanımla', icon: '▢' },
  { id: 'delete-edit', label: 'Sil / Düzenle', icon: '✕' },
] as const

export const FEATURE_FOOTER_ITEMS = [
  { label: 'Akıllı Planlama', description: 'Araziye özel planlama' },
  { label: 'Dikim Optimizasyonu', description: 'Gerçek grid hesabı' },
  { label: 'Bakım Yönetimi', description: 'Plan düzeyinde bakım' },
  { label: 'Gelişim Simülasyonu', description: 'Zaman çizelgesi' },
  { label: 'Verim Tahmini', description: 'Senaryo simülasyonu' },
] as const
