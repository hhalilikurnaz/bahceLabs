import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, FileText } from 'lucide-react'
import { BlogRelatedPosts } from '../blog/BlogRelatedPosts'
import { getPostBySlug, getRelatedPosts } from '../blog/loadPosts'
import { BlogSeo } from '../blog/BlogSeo'
import '../blog/blog.css'
import { DiagonalStripSection } from '../components/DiagonalStripSection'
import { MarketingFooter } from '../components/MarketingFooter'
import { ErkenErisimSection } from '../components/ErkenErisimSection'
import { MarketingNavbar } from '../components/MarketingNavbar'
export function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>()
  const post = slug ? getPostBySlug(slug) : undefined
  const related = slug ? getRelatedPosts(slug) : []

  if (!post) {
    return (
      <div className="min-h-dvh bg-mk-night text-mk-text">
        <MarketingNavbar variant="solid" />
        <main className="overflow-x-clip pt-16">
          <DiagonalStripSection tone="cream" topEdge="flat" overlap={false} className="rounded-t-sheet ">
            <div className="mx-auto max-w-lg py-16 text-center">
              <h1 className="text-2xl font-semibold text-mk-ink">Yazı bulunamadı</h1>
              <Link to="/blog" className="mt-6 inline-block text-mk-accent no-underline hover:underline">
                Bloga dön
              </Link>
            </div>
          </DiagonalStripSection>
          <MarketingFooter />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-mk-night text-mk-text">
      <BlogSeo
        title={post.title}
        description={post.description}
        path={`/blog/${post.slug}`}
        type="article"
        published={post.date}
        image={post.cover}
      />
      <MarketingNavbar variant="solid" />

      <main className="relative z-10 pt-16 text-mk-text">
        <section
          className="relative overflow-hidden bg-mk-night marketing-strip-top-flat rounded-t-sheet border-t border-white/10 shadow-e3 "
        >
          <div className="relative w-full">
              <div className="relative min-h-[min(58vw,22rem)] sm:min-h-[min(46vw,24rem)]">
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
                  className="pointer-events-none absolute inset-0 bg-gradient-to-b from-mk-night-deep/75 via-mk-ink/25 to-mk-night-deep/88"
                  aria-hidden
                />
                <div className="relative mx-auto flex min-h-[min(58vw,22rem)] max-w-6xl flex-col px-5 pb-8 pt-6 sm:min-h-[min(46vw,24rem)] sm:px-8 sm:pb-10 sm:pt-8">
                  <Link
                    to="/blog"
                    className="inline-flex w-fit items-center gap-2 text-[13px] font-medium text-white/95 no-underline drop-shadow-[0_1px_3px_rgba(0,0,0,0.55)] transition-colors hover:text-white"
                  >
                    <ArrowLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                    Tüm yazılar
                  </Link>
                  <div className="mt-auto">
                    {post.tags.length > 0 && (
                      <ul className="flex flex-wrap gap-2">
                        {post.tags.map((tag) => (
                          <li
                            key={tag}
                            className="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-caption font-medium text-mk-on-dark backdrop-blur-sm"
                          >
                            {tag}
                          </li>
                        ))}
                      </ul>
                    )}
                    <h1 className="mt-4 max-w-4xl text-balance text-[clamp(1.75rem,4.5vw,2.75rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-mk-on-dark drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)]">
                      {post.title}
                    </h1>
                    <p className="mt-3 text-[13px] text-white/90 drop-shadow-[0_1px_4px_rgba(0,0,0,0.4)]">{post.author}</p>
                  </div>
                </div>
              </div>
            </div>
        </section>

        <DiagonalStripSection
          tone="sage"
          topEdge="slant-down"
          clipOverflow={false}
          glyph={{ icon: FileText, label: 'Yazı' }}
        >
          <div className="lg:flex lg:items-start lg:gap-x-12 xl:gap-x-14">
            <article
              className="blog-prose min-w-0 max-w-none flex-1"
              dangerouslySetInnerHTML={{ __html: post.html }}
            />

            <BlogRelatedPosts
              posts={related}
              layout="list"
              className="hidden w-[17.5rem] shrink-0 lg:sticky lg:top-20 lg:block xl:w-[19rem]"
            />
          </div>

          <BlogRelatedPosts
            posts={related}
            layout="grid"
            className="mt-12 border-t border-mk-ink/10 pt-10 lg:hidden"
          />
        </DiagonalStripSection>

        <ErkenErisimSection secondaryCta={{ to: '/', label: 'Anasayfaya git' }} />

        <MarketingFooter />
      </main>
    </div>
  )
}
