/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PLANNING_API_MODE: 'mock' | 'real'
  readonly VITE_PLANNING_API_BASE_URL?: string
  readonly VITE_REGISTRATION_ENABLED?: string
  readonly VITE_MAPTILER_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
