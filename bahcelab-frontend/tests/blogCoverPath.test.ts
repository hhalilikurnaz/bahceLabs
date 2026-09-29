import { describe, expect, it } from 'vitest'
import { blogCoverPath } from '@/features/marketing/blog/loadPosts'

describe('blogCoverPath', () => {
  it('frontmatter cover varsa onu kullanır', () => {
    expect(blogCoverPath('ornek-slug', '/custom/cover.png')).toBe('/custom/cover.png')
  })

  it('cover yoksa slug ile public yolu üretir', () => {
    expect(blogCoverPath('bilinmeyen-slug')).toBe('/blog/covers/bilinmeyen-slug.png')
  })
})
