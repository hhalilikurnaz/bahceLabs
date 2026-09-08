import type { Garden } from '../types'
import { apiRequest } from './apiClient'
import type { GardenApi } from './gardenApi.types'

type ApiGarden = {
  id: string
  name: string
  location_label: string | null
  area_m2: number | null
  geometry: Garden['geometry']
}

function mapGardenFromApi(garden: ApiGarden): Garden {
  return {
    id: garden.id,
    name: garden.name,
    locationLabel: garden.location_label,
    areaM2: garden.area_m2,
    geometry: garden.geometry,
  }
}

export const gardenApiReal: GardenApi = {
  async listGardens() {
    const gardens = await apiRequest<ApiGarden[]>('/gardens')
    return gardens.map(mapGardenFromApi)
  },

  async getGarden(id: string) {
    const garden = await apiRequest<ApiGarden>(`/gardens/${id}`)
    return mapGardenFromApi(garden)
  },
}
