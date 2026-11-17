import { Link } from 'react-router-dom'
import { KVKK_TASLAK } from '@/features/auth/authConfig'
import { AYDINLATMA_SURUMU } from '@/features/auth/bekleme'
import { BlogSeo } from '../blog/BlogSeo'
import '../blog/blog.css'
import { MarketingFooter } from '../components/MarketingFooter'
import { MarketingNavbar } from '../components/MarketingNavbar'

/** Veri sorumlusu bilgisi yapılandırmadan gelir (kod içinde uydurma unvan/adres/e-posta yok). Boşsa metin sosyal kanalları gösterir. */
const SORUMLU = import.meta.env.VITE_KVKK_VERI_SORUMLUSU?.trim() || 'BahçeLab'
const ILETISIM_EPOSTA = import.meta.env.VITE_KVKK_ILETISIM_EPOSTA?.trim()

/** Erken erişim listesi için KVKK aydınlatma metni. Yalnız sistemin gerçekten yaptığı işlemleri anlatır. */
export function KvkkPage() {
  return (
    <div className="min-h-dvh bg-mk-cream text-mk-text">
      <BlogSeo title="Aydınlatma metni (KVKK) | BahçeLab" description="BahçeLab erken erişim listesi için 6698 sayılı KVKK kapsamında kişisel verilerin işlenmesine ilişkin aydınlatma metni." path="/kvkk" />
      <MarketingNavbar variant="solid" />
      <main className="mx-auto max-w-3xl px-5 pb-16 pt-28 sm:px-8">
        {KVKK_TASLAK && (
          <p role="note" data-testid="kvkk-taslak" className="mb-6 rounded-md border border-mk-ink/20 bg-mk-paper px-4 py-3 text-small font-semibold text-mk-ink">
            Taslak, hukuki onay bekliyor. Bu metin henüz hukuki incelemeden geçmedi; onaylanana kadar erken erişim başvurusu alınmıyor.
          </p>
        )}
        <p className="text-caption font-semibold uppercase tracking-[0.16em] text-mk-accent">Sürüm {AYDINLATMA_SURUMU}</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.02em] text-mk-ink sm:text-4xl">Aydınlatma metni</h1>
        <p className="mt-3 text-body text-mk-muted">6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) madde 10 kapsamında, erken erişim listesine katılan kişiler için.</p>

        <div className="blog-prose mt-8">
          <h2>Veri sorumlusu</h2>
          <p>
            {SORUMLU}. Başvurularınızı {ILETISIM_EPOSTA ? <a href={`mailto:${ILETISIM_EPOSTA}`}>{ILETISIM_EPOSTA}</a> : <>BahçeLab’ın LinkedIn ve Instagram hesapları üzerinden</>} iletebilirsiniz.
          </p>

          <h2>İşlenen kişisel veriler</h2>
          <ul>
            <li>E-posta adresi</li>
            <li>İl</li>
            <li>Yetiştirdiğiniz ürün (limon, portakal, mandalina ya da diğer)</li>
            <li>Açık rızanızın verildiği an ve rızanın verildiği aydınlatma metninin sürümü</li>
          </ul>
          <p>IP adresiniz ya da tarayıcı bilginiz kaydedilmez. Formun kötüye kullanılmasını yavaşlatmak için istek adresi yalnızca kısa süre bellekte sayılır, veritabanına yazılmaz.</p>

          <h2>İşleme amacı ve hukuki sebep</h2>
          <p>Verileriniz yalnızca BahçeLab erişime açıldığında size haber vermek için işlenir. Hukuki sebep, formdaki kutuyu işaretleyerek verdiğiniz açık rızanızdır.</p>

          <h2>Aktarım</h2>
          <p>Bu liste üçüncü kişilerle paylaşılmaz.</p>

          <h2>Saklama süresi</h2>
          <p>Verileriniz erken erişim süreci sona erene ya da rızanızı geri çekene kadar saklanır.</p>

          <h2>Haklarınız</h2>
          <p>KVKK madde 11 uyarınca verinizin işlenip işlenmediğini öğrenme, işlenmişse bilgi isteme, düzeltilmesini ya da silinmesini isteme ve işlemeye itiraz etme hakkına sahipsiniz. Rızanızı istediğiniz zaman geri çekebilirsiniz; bu durumda kaydınız listeden silinir.</p>
        </div>

        <p className="mt-8">
          <Link to="/register" className="text-small font-semibold text-mk-accent underline underline-offset-2">← Erken erişim formuna dön</Link>
        </p>
      </main>
      <MarketingFooter />
    </div>
  )
}
