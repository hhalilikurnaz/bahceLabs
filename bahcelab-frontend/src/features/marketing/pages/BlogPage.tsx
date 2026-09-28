import { Link } from 'react-router-dom'
import { MarketingFooter } from '../components/MarketingFooter'
import { MarketingNavbar } from '../components/MarketingNavbar'

export function BlogPage() {
  return (
    <div className="min-h-dvh bg-[#06140d] text-[#f3efe4]">
      <MarketingNavbar variant="solid" />
      <main className="mx-auto max-w-2xl px-5 pb-20 pt-28 sm:px-8">
        <h1 className="text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">Blog</h1>
        <p className="mt-4 text-[15px] leading-relaxed text-[#f3efe4]/75">
          Admin panelinden yayınlanan yazılar burada listelenecek. CMS entegrasyonu gelene kadar bu
          sayfa hazırlık aşamasında.
        </p>
        <p className="mt-6 text-[14px] text-[#f3efe4]/55">
          İlk içerikler; sürdürülebilir üretim, bahçe yönetimi kültürü ve sektörden haberler
          olacak — ürün tanıtımı ve teknik dokümantasyon değil.
        </p>
        <Link
          to="/"
          className="mt-10 inline-block text-[13px] font-medium text-[#c9f27a] no-underline hover:underline"
        >
          Ana sayfaya dön
        </Link>
      </main>
      <MarketingFooter />
    </div>
  )
}
