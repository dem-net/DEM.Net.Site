import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { routes } from './routes'
import { HEAD_BLOCK_RE, INDEXED_PAGES, headBlock, htmlFileFor, seoForPath, sitemapXml } from './seo'

describe('seo', () => {
  const router = createRouter({ history: createMemoryHistory(), routes })

  it('only lists real, non-redirect routes', () => {
    for (const page of INDEXED_PAGES) {
      const match = router.resolve(page.path)
      expect(match.name, page.path).not.toBe('not-found')
      expect(match.path).toBe(page.path)
    }
  })

  it('has unique paths, titles and descriptions', () => {
    for (const key of ['path', 'title', 'description'] as const) {
      expect(new Set(INDEXED_PAGES.map((p) => p[key])).size).toBe(INDEXED_PAGES.length)
    }
  })

  it('maps paths to the file GitHub Pages serves', () => {
    expect(htmlFileFor('/')).toBe('index.html')
    expect(htmlFileFor('/terrain')).toBe('terrain.html')
  })

  it('finds a page with or without a trailing slash', () => {
    expect(seoForPath('/faq/')?.path).toBe('/faq')
    expect(seoForPath('/sketchfab_oauth2')).toBeUndefined()
  })

  it('writes a canonical for indexed pages and noindex for the fallback', () => {
    const terrain = headBlock(seoForPath('/terrain'))
    expect(terrain).toMatch(HEAD_BLOCK_RE)
    expect(terrain).toContain('<link rel="canonical" href="https://elevationapi.com/terrain" />')
    expect(terrain).not.toContain('noindex')
    const fallback = headBlock(undefined)
    expect(fallback).toContain('<meta name="robots" content="noindex" />')
    expect(fallback).not.toContain('canonical')
  })

  it('lists every page in the sitemap', () => {
    const xml = sitemapXml()
    for (const page of INDEXED_PAGES) expect(xml).toContain(`<loc>https://elevationapi.com${page.path}</loc>`)
  })
})
