import { isPlanningApiMock } from './config'
import { gardenApiMock } from './gardenApi.mock'
import { gardenApiReal } from './gardenApi.real'

export const gardenApi = isPlanningApiMock() ? gardenApiMock : gardenApiReal

export type { GardenApi } from './gardenApi.types'
