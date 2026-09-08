import { isPlanningApiMock } from './config'
import { planningApiMock } from './planningApi.mock'
import { planningApiReal } from './planningApi.real'

export const planningApi = isPlanningApiMock() ? planningApiMock : planningApiReal

export type { PlanningApi } from './planningApi.types'
