import { useState, type ReactNode } from 'react'
import { describeError } from '../../api/gardensApi'
import type { Garden } from '../../api/types'
import { useDeleteGarden, useUpdateGarden } from '../../api/useGardens'
import { useBahcemStore } from '../../stores/bahcemStore'
import { useToast } from '../layout/toastContext'
import { ConfirmDialog } from './ConfirmDialog'

/** Liste ve detay panelinin ortak işlemleri: ad değiştir, sınırı düzenle, sil (onaylı). */
export function useGardenActions(): {
  rename: (garden: Garden, name: string) => Promise<void>
  editBoundary: (garden: Garden) => void
  requestDelete: (garden: Garden) => void
  dialog: ReactNode
} {
  const toast = useToast()
  const update = useUpdateGarden()
  const remove = useDeleteGarden()
  const selectedId = useBahcemStore((s) => s.selectedGardenId)
  const selectGarden = useBahcemStore((s) => s.selectGarden)
  const startEditingBoundary = useBahcemStore((s) => s.startEditingBoundary)

  const [toDelete, setToDelete] = useState<Garden | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function rename(garden: Garden, name: string) {
    try {
      await update.mutateAsync({ id: garden.id, patch: { ad: name } })
    } catch (err) {
      toast.show(describeError(err))
      throw err
    }
  }

  function editBoundary(garden: Garden) {
    if (garden.geometry.type !== 'Polygon' || garden.geometry.coordinates.length !== 1) {
      toast.show('Çok parçalı veya delikli bahçelerin sınırı şimdilik düzenlenemez.')
      return
    }
    startEditingBoundary(garden.id)
  }

  function requestDelete(garden: Garden) {
    setDeleteError(null)
    setToDelete(garden)
  }

  function confirmDelete() {
    if (!toDelete) return
    setDeleteError(null)
    remove.mutate(toDelete.id, {
      onSuccess: () => {
        if (selectedId === toDelete.id) selectGarden(null)
        toast.show(`“${toDelete.ad}” silindi.`)
        setToDelete(null)
      },
      onError: (err) => setDeleteError(describeError(err)),
    })
  }

  const dialog = toDelete ? (
    <ConfirmDialog
      title="Bahçe silinsin mi?"
      message={`“${toDelete.ad}”, sınırı ve tüm NDVI görüntüleri kalıcı olarak silinecek. Bu işlem geri alınamaz.`}
      confirmLabel="Sil"
      pending={remove.isPending}
      error={deleteError}
      onConfirm={confirmDelete}
      onCancel={() => setToDelete(null)}
    />
  ) : null

  return { rename, editBoundary, requestDelete, dialog }
}
