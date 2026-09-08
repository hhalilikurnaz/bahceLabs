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
    description: 'Ne Ekilecek?',
  },
  {
    id: 'planting',
    order: 3,
    label: 'PLANLAMA',
    description: 'Dikim & Yerleşim',
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

export const FEATURE_FOOTER_ITEMS = [
  { label: 'Akıllı Planlama', description: 'Araziye özel planlama' },
  { label: 'Dikim Optimizasyonu', description: 'Gerçek grid hesabı' },
  { label: 'Bakım Yönetimi', description: 'Plan düzeyinde bakım' },
  { label: 'Gelişim Simülasyonu', description: 'Zaman çizelgesi' },
  { label: 'Verim Tahmini', description: 'Senaryo simülasyonu' },
] as const
