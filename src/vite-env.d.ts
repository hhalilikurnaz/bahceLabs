/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PLANNING_API_MODE: 'mock' | 'real'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
