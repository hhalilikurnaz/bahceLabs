import { STUB_GARDENS, getStubGarden } from '../fixtures/stubGardens.fixture'
import type { GardenApi } from './gardenApi.types'

export const gardenApiMock: GardenApi = {
  async listGardens() {
    return STUB_GARDENS
  },

  async getGarden(id: string) {
    const garden = getStubGarden(id)
    if (!garden) {
      throw new Error(`Garden not found: ${id}`)
    }
    return garden
  },
}
