export function isPlanningApiMock(): boolean {
  return import.meta.env.VITE_PLANNING_API_MODE !== 'real'
}

export function getPlanningApiBaseUrl(): string {
  return import.meta.env.VITE_PLANNING_API_BASE_URL ?? '/api'
}

export function getWorkspaceId(): string {
  return (
    import.meta.env.VITE_WORKSPACE_ID ??
    '11111111-1111-4111-8111-111111111111'
  )
}
