import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const contentDir = path.join(root, 'src/content/blog')
const publicDir = path.join(root, 'public')
const siteUrl = (process.env.SITE_URL || 'https://bahcelabs.com').replace(/\/$/, '')

function escapeXml(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function parseMarkdownFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8')
  const slug = path.basename(filePath, '.md')
  const slugMatch = raw.match(/^slug:\s*(\S+)/m)
  const dateMatch = raw.match(/^date:\s*(\S+)/m)
  return {
    slug: slugMatch?.[1] ?? slug,
    lastmod: dateMatch?.[1] ?? new Date().toISOString().slice(0, 10),
  }
}

const today = new Date().toISOString().slice(0, 10)
const staticPaths = [
  { path: '/', lastmod: today },
  { path: '/blog', lastmod: today },
]

const posts = fs
  .readdirSync(contentDir)
  .filter((name) => name.endsWith('.md'))
  .map((name) => parseMarkdownFile(path.join(contentDir, name)))

const urls = [
  ...staticPaths.map(({ path: p, lastmod }) => ({ loc: `${siteUrl}${p}`, lastmod })),
  ...posts.map(({ slug, lastmod }) => ({ loc: `${siteUrl}/blog/${slug}`, lastmod })),
]

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${escapeXml(u.loc)}</loc>
    <lastmod>${u.lastmod}</lastmod>
  </url>`,
  )
  .join('\n')}
</urlset>
`

const robots = `User-agent: *
Allow: /

Disallow: /planning

Sitemap: ${siteUrl}/sitemap.xml
`

fs.mkdirSync(publicDir, { recursive: true })
fs.writeFileSync(path.join(publicDir, 'robots.txt'), robots)
fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemap)

console.log(`SEO files: ${urls.length} URLs → public/sitemap.xml, public/robots.txt`)
