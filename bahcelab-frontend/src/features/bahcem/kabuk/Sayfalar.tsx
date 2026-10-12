import { useAuth } from '@/features/auth/useAuth'
import { NotificationPreferences } from '../components/notifications/NotificationPreferences'
import { BosDurum } from './BosDurum'

/** Henüz gelmeyen bölümler: dürüst «yakında» + ne getireceği. */
export function AsistanSayfasi() {
  return (
    <BosDurum gravur="dal" baslik="Asistan, Adım 16’da açılıyor" fayda="Bahçenizin verisine dayanarak soru yanıtlayacak; cevabın dayandığı görüntü ve kuralı gösterecek. Şimdilik ⌘K ile komutlar çalışır: «zayıf bölgeleri göster», «ilaçlama zamanı»." adim="Adım 16" testId="asistan-sayfasi" />
  )
}
export function IslerimSayfasi() {
  return <BosDurum gravur="kesit" baslik="İşlerim" fayda="Hibe ve destek, kalıntı ve ihracat uyumu, sertifika, sigorta, kredi dosyası ve satış işlerini sizin adınıza hazırlayan yardımcılar." adim="Faz 1.5" />
}
export function HizmetlerSayfasi() {
  return <BosDurum gravur="agac" baslik="Hizmetler" fayda="Drone ilaçlama, budama, hasat ekibi, nakliye; toprak/yaprak/su analizi ve ziraat mühendisi danışmanlığını buradan isteyeceksiniz." adim="Faz 1.5" />
}
export function PazarSayfasi() {
  return <BosDurum gravur="cicek" baslik="Pazar" fayda="Hasat sonrası ürününüzü kaydedip depo ve satış durumunu izleyeceksiniz; girdi ve finansman Faz 1.5’te." adim="Adım 17" />
}
export function AyarlarSayfasi() {
  const { user } = useAuth()
  return (
    <div className="mx-auto w-full max-w-[720px] overflow-y-auto px-6 py-8">
      <h1 className="text-[22px] font-bold">Ayarlar</h1>
      <section className="mt-5 rounded-lg border border-app-border bg-app-panel p-4">
        <div className="text-[11px] font-semibold uppercase tracking-[.08em] text-app-text-dim">Hesap</div>
        <b className="mt-1 block text-[15px]">{user?.name}</b>
        <span className="text-[13px] text-app-text-muted">{user?.email}</span>
      </section>
      <div className="mt-5"><NotificationPreferences /></div>
    </div>
  )
}
