import { useSulamaPanel, useSulamaSimulasyon, useSulamaSektorleri } from '../../../api/sulamaPanelApi'
import { useSulamaProfili } from '../../../api/sulamaApi'
import { simSorgu, useSulamaHaritaStore } from './sulamaHaritaStore'

/** Harita + alt çubuk + kartların ortak verisi: panel (Bugün), simülasyon (oynatma) ve ağ. Panel/Simülasyon sekmeleriyle AYNI sorgu anahtarları. */
export function useSulamaVeri(gardenId: string) {
  const sim = useSulamaHaritaStore((s) => s.sim)
  const sekme = useSulamaHaritaStore((s) => s.sekme)
  const profil = useSulamaProfili(gardenId)
  const panel = useSulamaPanel(gardenId)
  // «Bugün» sekmesinde harita BU YILI (bugünü) oynatır; Simülasyon sekmesinde seçili/tipik yılı (panelle aynı sorgu)
  const buYil = panel.data?.bugun ? Number(panel.data.bugun.slice(0, 4)) : undefined
  const girdi = simSorgu(sekme === 'bugun' ? { ...sim, yil: buYil } : sim, profil.data?.profil?.sistem ?? 'damla')
  const simQ = useSulamaSimulasyon(gardenId, girdi, sekme === 'simulasyon' || buYil !== undefined)
  const sektorler = useSulamaSektorleri(gardenId)
  return { panel: panel.data, sim: simQ.data, sektorler: sektorler.data, yukleniyor: panel.isLoading || simQ.isLoading }
}
