import { describe, expect, it } from 'vitest'
import { parseFrontmatter } from '@/features/marketing/blog/parseFrontmatter'

describe('parseFrontmatter', () => {
  it('frontmatter ve gövdeyi ayırır', () => {
    const raw = `---
title: Test yazısı
slug: test-yazi
tags:
  - akıllı tarım
  - narenciye
---

İlk paragraf.`

    const { data, content } = parseFrontmatter(raw)
    expect(data.title).toBe('Test yazısı')
    expect(data.slug).toBe('test-yazi')
    expect(data.tags).toEqual(['akıllı tarım', 'narenciye'])
    expect(content).toBe('İlk paragraf.')
  })

  it('frontmatter yoksa ham metni döner', () => {
    const raw = 'Sadece içerik.'
    const { data, content } = parseFrontmatter(raw)
    expect(data).toEqual({})
    expect(content).toBe('Sadece içerik.')
  })
})
