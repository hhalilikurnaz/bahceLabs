import { useContext } from 'react'
import { MapContext, type MapContextValue } from './MapContext'

export function useMap(): MapContextValue {
  const ctx = useContext(MapContext)
  if (!ctx) throw new Error('useMap must be used within MapProvider')
  return ctx
}
