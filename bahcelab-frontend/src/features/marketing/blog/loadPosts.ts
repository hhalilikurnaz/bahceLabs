import { marked } from 'marked'
import { parseFrontmatter } from './parseFrontmatter'

export interface BlogPost {
  slug: string
  title: string
  description: string
  date: string
  author: string
  tags: string[]
  featured?: boolean
  cover: string
  content: string
  html: string
}

const coverModules = import.meta.glob('../../../assets/blog/covers/*.{png,jpg,webp,svg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

const coverBySlug: Record<string, string> = {}
for (const [path, url] of Object.entries(coverModules)) {
  const match = path.match(/\/([^/]+)\.(png|jpg|webp|svg)$/)
  if (!match) continue
  const [, slug, ext] = match
  // Favor real photo formats over svg
  if (!coverBySlug[slug] || ext === 'png' || ext === 'jpg' || ext === 'webp') {
    coverBySlug[slug] = url
  }
}

export function blogCoverPath(slug: string, fromFrontmatter?: string): string {
  if (fromFrontmatter) return fromFrontmatter
  return coverBySlug[slug] ?? `/blog/covers/${slug}.png`
}

const rawModules = import.meta.glob('../../../content/blog/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

marked.setOptions({ gfm: true, breaks: false })

function slugFromPath(path: string): string {
  return path.match(/\/([^/]+)\.md$/)?.[1] ?? ''
}

function parsePost(path: string, raw: string): BlogPost {
  const { data, content } = parseFrontmatter(raw)
  const slug = (data.slug as string) || slugFromPath(path)
  const body = content.trim()

  return {
    slug,
    title: String(data.title ?? ''),
    description: String(data.description ?? ''),
    date: String(data.date ?? ''),
    author: String(data.author ?? 'BahçeLab'),
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    featured: data.featured === true || data.featured === 'true',
    cover: blogCoverPath(slug, data.cover ? String(data.cover) : undefined),
    content: body,
    html: marked.parse(body) as string,
  }
}

export function getAllPosts(): BlogPost[] {
  return Object.entries(rawModules)
    .map(([path, raw]) => parsePost(path, raw))
    .filter((p) => p.title && p.slug)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
}

export function getPostBySlug(slug: string): BlogPost | undefined {
  return getAllPosts().find((p) => p.slug === slug)
}

/** Öne çıkan yazı + liste (öne çıkan listede tekrar etmez). */
export function getBlogListPosts(): { featured: BlogPost | undefined; rest: BlogPost[] } {
  const posts = getAllPosts()
  const featured = posts.find((p) => p.featured) ?? posts[0]
  const rest = featured ? posts.filter((p) => p.slug !== featured.slug) : posts
  return { featured, rest }
}

export function getRelatedPosts(excludeSlug: string, limit = 5): BlogPost[] {
  return getAllPosts().filter((p) => p.slug !== excludeSlug).slice(0, limit)
}
