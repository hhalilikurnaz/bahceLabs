import { planningApiMock } from './planningApi.mock'

const useMock = import.meta.env.VITE_PLANNING_API_MODE !== 'real'

export const planningApi = useMock ? planningApiMock : planningApiMock

// Backend hazır olduğunda planningApi.real.ts buraya bağlanacak.
