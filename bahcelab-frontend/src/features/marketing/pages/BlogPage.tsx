import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen } from 'lucide-react'
import type { BlogPost } from '../blog/loadPosts'
import { getBlogListPosts } from '../blog/loadPosts'
import { BlogSeo } from '../blog/BlogSeo'
import { DiagonalStripSection } from '../components/DiagonalStripSection'
import { ErkenErisimSection } from '../components/ErkenErisimSection'
import { MarketingNavbar } from '../components/MarketingNavbar'
import { Reveal } from '../components/Reveal'

function FeaturedBlogCard({ post }: { post: BlogPost }) {
  return (
    <Reveal>
      <article>
        <Link
          to={`/blog/${post.slug}`}
          className="group grid overflow-hidden rounded-mk border border-mk-ink/12 bg-mk-cream/80 transition-colors hover:border-mk-accent/35 hover:bg-mk-cream lg:grid-cols-[1.15fr_1fr]"
        >
          <div className="relative aspect-[16/10] min-h-[12rem] overflow-hidden bg-mk-photo-fallback lg:aspect-auto lg:min-h-[18rem]">
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
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-mk-night-deep/50 via-transparent to-transparent lg:bg-gradient-to-r lg:from-transparent lg:via-transparent lg:to-mk-night-deep/15"
              aria-hidden
            />
            <span
              className="absolute left-4 top-4 rounded-full border border-white/25 bg-mk-night-deep/55 px-3 py-1 text-caption font-semibold uppercase tracking-[0.14em] text-mk-on-dark backdrop-blur-sm"
            >
              Öne çıkan
            </span>
          </div>

          <div className="flex flex-col justify-center px-6 py-7 sm:px-8 sm:py-9 lg:px-10">
            {post.tags[0] && (
              <p className="text-caption font-semibold uppercase tracking-[0.16em] text-mk-accent">
                {post.tags[0]}
              </p>
            )}
            <h2 className="mt-2 text-balance text-[clamp(1.35rem,3.5vw,1.75rem)] font-semibold leading-snug tracking-[-0.03em] text-mk-ink">
              {post.title}
            </h2>
            <p className="mt-3 line-clamp-3 text-[15px] leading-relaxed text-mk-body">{post.description}</p>
            <span
              className="mt-6 inline-flex items-center gap-2 text-[13px] font-semibold text-mk-accent transition-colors group-hover:text-mk-ink"
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
    <Reveal as="li" delayMs={index * 50} className="border-b border-mk-ink/10 last:border-b-0">
      <div>
        <Link
          to={`/blog/${post.slug}`}
          className="group flex gap-4 py-6 transition-colors hover:bg-mk-cream/60 sm:gap-6 sm:py-7"
        >
          <div className="relative h-[4.5rem] w-[6.5rem] shrink-0 overflow-hidden rounded-lg border border-mk-ink/10 bg-mk-photo-fallback sm:h-[5.25rem] sm:w-[7.75rem]">
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
              <p className="text-caption font-semibold uppercase tracking-[0.14em] text-mk-accent">
                {post.tags[0]}
              </p>
            )}
            <h2 className="mt-1 text-[17px] font-semibold leading-snug tracking-[-0.02em] text-mk-ink sm:text-lg">
              <span className="bg-gradient-to-r from-mk-accent to-mk-accent bg-[length:0%_1px] bg-left-bottom bg-no-repeat transition-[background-size] duration-300 group-hover:bg-[length:100%_1px]">
                {post.title}
              </span>
            </h2>
            <p className="mt-2 line-clamp-2 text-[14px] leading-relaxed text-mk-muted">{post.description}</p>
          </div>
          <ArrowRight
            className="mt-2 hidden h-4 w-4 shrink-0 text-mk-accent opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100 sm:mt-3 sm:block"
            strokeWidth={2}
            aria-hidden
          />
        </Link>
      </div>
    </Reveal>
  )
}

export function BlogPage() {
  const { featured, rest } = getBlogListPosts()

  return (
    <div className="min-h-dvh bg-mk-night text-mk-text">
      <BlogSeo
        title="Blog | BahçeLab"
        description="Narenciye ve bahçe üretiminde sürdürülebilirlik, veri analitiği ve akıllı tarım üzerine rehber yazılar."
        path="/blog"
      />
      <MarketingNavbar variant="solid" />

      <main className="relative z-10 overflow-x-clip pt-16 text-mk-text">
        <DiagonalStripSection
          id="blog"
          tone="cream"
          topEdge="flat"
          overlap={false}
          className="rounded-t-sheet border-t border-mk-paper/40 shadow-e3 "
          glyph={{ icon: BookOpen, label: 'Blog' }}
        >
          <Reveal>
            <p className="text-caption font-semibold uppercase tracking-[0.16em] text-mk-accent">BahçeLab Blog</p>
            <h1 className="mt-3 max-w-3xl text-balance text-[clamp(2rem,5vw,3.25rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-mk-ink">
              Sahadan okunan blog yazıları
            </h1>
            <p className="mt-5 max-w-2xl text-[15px] leading-[1.75] text-mk-body sm:text-base">
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
                    <h2 className="text-caption font-semibold uppercase tracking-[0.2em] text-mk-accent">
                      Diğer yazılar
                    </h2>
                  </Reveal>
                  <ul className="mt-4 border-t border-mk-ink/10">
                    {rest.map((post, index) => (
                      <BlogListRow key={post.slug} post={post} index={index} />
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <p className="text-[15px] text-mk-muted">Henüz yayınlanmış yazı yok.</p>
          )}
        </DiagonalStripSection>

        <ErkenErisimSection secondaryCta={{ to: '/', label: 'Anasayfaya git' }} />
      </main>
    </div>
  )
}
