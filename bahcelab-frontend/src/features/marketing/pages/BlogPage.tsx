import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen } from 'lucide-react'
import type { BlogPost } from '../blog/loadPosts'
import { getBlogListPosts } from '../blog/loadPosts'
import { BlogSeo } from '../blog/BlogSeo'
import { DiagonalStripSection } from '../components/DiagonalStripSection'
import { MarketingFooter } from '../components/MarketingFooter'
import { MarketingFutureStepsSection } from '../components/MarketingFutureStepsSection'
import { MarketingNavbar } from '../components/MarketingNavbar'
import { Reveal } from '../components/Reveal'

function FeaturedBlogCard({ post }: { post: BlogPost }) {
  return (
    <Reveal>
      <article>
        <Link
          to={`/blog/${post.slug}`}
          className="group grid overflow-hidden rounded-[1.25rem] border border-[#0c2418]/12 bg-[#f7f4ee]/80 transition-colors hover:border-[#2d6b45]/35 hover:bg-[#f7f4ee] sm:rounded-[1.5rem] lg:grid-cols-[1.15fr_1fr]"
        >
          <div className="relative aspect-[16/10] min-h-[12rem] overflow-hidden bg-[#d8e0d4] lg:aspect-auto lg:min-h-[18rem]">
            <img
              src={post.cover}
              alt=""
              width={1200}
              height={675}
              className="absolute inset-0 h-full w-full object-cover"
              decoding="async"
              fetchPriority="high"
            />
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#06140d]/50 via-transparent to-transparent lg:bg-gradient-to-r lg:from-transparent lg:via-transparent lg:to-[#06140d]/15"
              aria-hidden
            />
            <span
              className="absolute left-4 top-4 rounded-full border border-white/25 bg-[#06140d]/55 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#f3efe4] backdrop-blur-sm"
            >
              Öne çıkan
            </span>
          </div>

          <div className="flex flex-col justify-center px-6 py-7 sm:px-8 sm:py-9 lg:px-10">
            {post.tags[0] && (
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#2d6b45]">
                {post.tags[0]}
              </p>
            )}
            <h2 className="mt-2 text-balance text-[clamp(1.35rem,3.5vw,1.75rem)] font-semibold leading-snug tracking-[-0.03em] text-[#0c2418]">
              {post.title}
            </h2>
            <p className="mt-3 line-clamp-3 text-[15px] leading-relaxed text-[#4b554c]">{post.description}</p>
            <span
              className="mt-6 inline-flex items-center gap-2 text-[13px] font-semibold text-[#2d6b45] transition-colors group-hover:text-[#0c2418]"
            >
              Yazıyı oku
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
            </span>
          </div>
        </Link>
      </article>
    </Reveal>
  )
}

function BlogListRow({ post, index }: { post: BlogPost; index: number }) {
  return (
    <Reveal delayMs={index * 50}>
      <li className="border-b border-[#0c2418]/10 last:border-b-0">
        <Link
          to={`/blog/${post.slug}`}
          className="group flex gap-4 py-6 transition-colors hover:bg-[#f7f4ee]/60 sm:gap-6 sm:py-7"
        >
          <div className="relative h-[4.5rem] w-[6.5rem] shrink-0 overflow-hidden rounded-lg border border-[#0c2418]/10 bg-[#d8e0d4] sm:h-[5.25rem] sm:w-[7.75rem]">
            <img
              src={post.cover}
              alt=""
              width={1200}
              height={675}
              className="h-full w-full object-cover"
              decoding="async"
            />
          </div>
          <div className="min-w-0 flex-1 py-0.5">
            {post.tags[0] && (
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#2d6b45]/90">
                {post.tags[0]}
              </p>
            )}
            <h2 className="mt-1 text-[17px] font-semibold leading-snug tracking-[-0.02em] text-[#0c2418] sm:text-lg">
              <span className="bg-gradient-to-r from-[#2d6b45] to-[#2d6b45] bg-[length:0%_1px] bg-left-bottom bg-no-repeat transition-[background-size] duration-300 group-hover:bg-[length:100%_1px]">
                {post.title}
              </span>
            </h2>
            <p className="mt-2 line-clamp-2 text-[14px] leading-relaxed text-[#5c665d]">{post.description}</p>
          </div>
          <ArrowRight
            className="mt-2 hidden h-4 w-4 shrink-0 text-[#2d6b45] opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100 sm:mt-3 sm:block"
            strokeWidth={2}
            aria-hidden
          />
        </Link>
      </li>
    </Reveal>
  )
}

export function BlogPage() {
  const { featured, rest } = getBlogListPosts()

  return (
    <div className="min-h-dvh bg-[#0e1a12] text-[#1a241c]">
      <BlogSeo
        title="Blog | BahçeLab"
        description="Narenciye ve bahçe üretiminde sürdürülebilirlik, veri analitiği ve akıllı tarım üzerine rehber yazılar."
        path="/blog"
      />
      <MarketingNavbar variant="solid" />

      <main className="relative z-10 overflow-x-clip pt-16 text-[#1a241c]">
        <DiagonalStripSection
          id="blog"
          tone="cream"
          topEdge="flat"
          overlap={false}
          className="rounded-t-[2rem] border-t border-[#e8e4d9]/40 shadow-[0_-20px_80px_rgba(0,0,0,0.45)] sm:rounded-t-[2.75rem]"
          glyph={{ icon: BookOpen, label: 'Blog' }}
        >
          <Reveal>
            <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-[#2d6b45]/75">BahçeLab Blog</p>
            <h1 className="mt-3 max-w-3xl text-balance text-[clamp(2rem,5vw,3.25rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-[#0c2418]">
              Sahadan okunan blog yazıları
            </h1>
            <p className="mt-5 max-w-2xl text-[15px] leading-[1.75] text-[#4b554c] sm:text-base">
              Narenciye üreticileri, danışmanlar ve kooperatifler için sürdürülebilirlik, veri ve akıllı tarım
              üzerine kısa, uygulanabilir yazılar. Ürün kataloğu değil; karar vermenize yardım edecek içerikler.
            </p>
          </Reveal>
        </DiagonalStripSection>

        <DiagonalStripSection tone="sage" topEdge="slant-down">
          {featured ? (
            <>
              <FeaturedBlogCard post={featured} />

              {rest.length > 0 && (
                <div className="mt-14 sm:mt-16">
                  <Reveal>
                    <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#2d6b45]">
                      Diğer yazılar
                    </h2>
                  </Reveal>
                  <ul className="mt-4 border-t border-[#0c2418]/10">
                    {rest.map((post, index) => (
                      <BlogListRow key={post.slug} post={post} index={index} />
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <p className="text-[15px] text-[#5c665d]">Henüz yayınlanmış yazı yok.</p>
          )}
        </DiagonalStripSection>

        <MarketingFutureStepsSection secondaryCta={{ to: '/', label: 'Anasayfaya git' }} />

        <MarketingFooter />
      </main>
    </div>
  )
}
