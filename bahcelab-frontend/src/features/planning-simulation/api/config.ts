export function isPlanningApiMock(): boolean {
  return import.meta.env.VITE_PLANNING_API_MODE !== 'real'
}
