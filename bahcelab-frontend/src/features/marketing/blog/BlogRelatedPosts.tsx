import { Link } from 'react-router-dom'
import type { BlogPost } from './loadPosts'

interface BlogRelatedPostsProps {
  posts: BlogPost[]
  className?: string
  /** Makale altında: geniş mini kart ızgarası */
  layout?: 'list' | 'grid'
}

export function BlogRelatedPosts({ posts, className = '', layout = 'list' }: BlogRelatedPostsProps) {
  if (posts.length === 0) return null

  const listClass =
    layout === 'grid'
      ? 'mt-4 grid gap-3 border-t border-[#0c2418]/10 pt-6 sm:grid-cols-2'
      : 'mt-4 space-y-1 border-t border-[#0c2418]/10 pt-4'

  return (
    <aside className={className} aria-labelledby="blog-related-heading">
      <h2
        id="blog-related-heading"
        className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#2d6b45]"
      >
        İlginizi çekebilecek diğer yazılar
      </h2>
      <ul className={listClass}>
        {posts.map((item) => (
          <li key={item.slug}>
            <Link
              to={`/blog/${item.slug}`}
              className="group flex gap-3 rounded-lg py-2.5 no-underline transition-colors hover:bg-[#f7f4ee]/70"
            >
              <div className="relative h-14 w-[4.25rem] shrink-0 overflow-hidden rounded-md border border-[#0c2418]/10 bg-[#d8e0d4]">
                <img
                  src={item.cover}
                  alt=""
                  width={1200}
                  height={675}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <span className="min-w-0 flex-1">
                {item.tags[0] && (
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#2d6b45]/85">
                    {item.tags[0]}
                  </span>
                )}
                <span
                  className="mt-0.5 block text-[13px] font-semibold leading-snug tracking-[-0.01em] text-[#0c2418] group-hover:text-[#2d6b45]"
                >
                  {item.title}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <Link
        to="/blog"
        className="mt-5 inline-block text-[13px] font-medium text-[#2d6b45] no-underline hover:underline"
      >
        Tüm yazılar
      </Link>
    </aside>
  )
}
