import type { Garden } from '../types'

export interface GardenApi {
  listGardens(): Promise<Garden[]>
  getGarden(id: string): Promise<Garden>
}
