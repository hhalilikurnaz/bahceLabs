import { Button } from '@/components/ui'
import { useToast } from '../../../components/layout/toastContext'
import { useSistemKontrolYanit, type SistemKontrol, type SistemKontrolYaniti } from '../../../api/sulamaPanelApi'

const YANITLAR: { id: SistemKontrolYaniti; ad: string }[] = [
  { id: 'sorun_yok', ad: 'Kontrol ettim: sorun yoktu' },
  { id: 'damlatici_tikali', ad: 'Damlatıcı tıkalıydı' },
  { id: 'baska_sorun', ad: 'Başka bir sorun vardı' },
]

/** Vana satırında «sulama sistemini kontrol edin» işareti: tek cümle neden + «nasıl hesaplandı» + kullanıcı yanıtı (Saha Defteri'ne düşer). Yalnız durum = isaret iken çizilir. */
export function SistemKontrolIsareti({ gardenId, vana, sk }: { gardenId: string; vana: string; sk: SistemKontrol }) {
  const yanit = useSistemKontrolYanit(gardenId)
  const toast = useToast()
  if (sk.durum !== 'isaret') return null
  const gonder = (y: SistemKontrolYaniti) => {
    if (!sk.sahne_tarihi) return
    yanit.mutate({ sektor: vana, sahne_tarihi: sk.sahne_tarihi, yanit: y }, { onSuccess: () => toast.show(y === 'sorun_yok' ? 'Teşekkürler: işaret kapatıldı; yeni sahnelerde yeniden değerlendirilir.' : 'Teşekkürler: Saha Defteri\'ne işlendi.'), onError: (e) => toast.show(e instanceof Error ? e.message : 'Yanıt kaydedilemedi.', { tone: 'warn' }) })
  }
  return (
    <div className="mt-2 basis-full rounded-md border border-app-warn bg-app-warn/10 p-3" role="note" data-testid="sistem-kontrol" data-vana={vana} data-guven={sk.guven ?? ''}>
      <p className="text-small font-semibold" data-testid="sistem-kontrol-cumle"><span aria-hidden>⚠ </span>{sk.cumle}</p>
      <p className="mt-0.5 text-caption text-app-text-muted" data-testid="sistem-kontrol-guven">
        Güven: {sk.guven === 'yuksek' ? 'yüksek' : 'orta'}{sk.karsilastirma ? ` · ${sk.karsilastirma}` : ''}
      </p>
      <details className="mt-1 text-caption" data-testid="sistem-kontrol-nasil">
        <summary className="min-h-6 cursor-pointer font-semibold underline">Nasıl hesaplandı?</summary>
        <p className="mt-1 text-app-text-muted">{sk.nasil}</p>
        <ul className="mt-1 list-disc pl-5 text-app-text-muted">{sk.sahneler.map((s) => <li key={s.tarih} className="tabular-nums">{s.tarih}: NDMI {s.ndmi.toFixed(2).replace('.', ',')} · z {s.z.toFixed(1).replace('.', ',')}</li>)}</ul>
      </details>
      {sk.yanit ? (
        <p className="mt-2 text-small font-semibold" data-testid="sk-yanit-verildi">Yanıtınız: {sk.yanit_ad}</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={`${vana} için yanıt`}>
          {YANITLAR.map((y) => <Button key={y.id} variant="secondary" loading={yanit.isPending && yanit.variables?.yanit === y.id} onClick={() => gonder(y.id)} data-testid={`sk-yanit-${y.id}`}>{y.ad}</Button>)}
        </div>
      )}
    </div>
  )
}
