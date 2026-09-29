import { useEffect } from 'react'

interface BlogSeoProps {
  title: string
  description: string
  path: string
  type?: 'website' | 'article'
  published?: string
  image?: string
}

function upsertMeta(name: string, content: string, attr: 'name' | 'property' = 'name') {
  let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, name)
    document.head.appendChild(el)
  }
  el.content = content
}

export function BlogSeo({ title, description, path, type = 'website', published, image }: BlogSeoProps) {
  useEffect(() => {
    const fullTitle = title.includes('BahçeLab') ? title : `${title} | BahçeLab`
    document.title = fullTitle
    upsertMeta('description', description)
    upsertMeta('og:title', fullTitle, 'property')
    upsertMeta('og:description', description, 'property')
    upsertMeta('og:type', type, 'property')
    upsertMeta('twitter:card', 'summary_large_image', 'name')
    upsertMeta('twitter:title', fullTitle, 'name')
    upsertMeta('twitter:description', description, 'name')

    const origin = window.location.origin
    const url = `${origin}${path}`
    upsertMeta('og:url', url, 'property')

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
    }
    canonical.href = url

    if (published && type === 'article') {
      upsertMeta('article:published_time', published, 'property')
    }

    if (image) {
      const imageUrl = image.startsWith('http') ? image : `${origin}${image}`
      upsertMeta('og:image', imageUrl, 'property')
      upsertMeta('twitter:image', imageUrl, 'name')
    }
  }, [title, description, path, type, published, image])

  return null
}
