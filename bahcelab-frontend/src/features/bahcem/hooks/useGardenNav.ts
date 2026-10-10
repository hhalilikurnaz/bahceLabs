import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { gardenPath, type GardenTab } from '../lib/routes'

/** Bahçe açma/kapama: seçim URL'de tutulur (`/bahcem/:id/:sekme`). */
export function useGardenNav() {
  const navigate = useNavigate()
  const open = useCallback((id: string, tab: GardenTab = 'durum') => navigate(gardenPath(id, tab)), [navigate])
  const close = useCallback(() => navigate('/bahcem'), [navigate])
  return { open, close }
}
