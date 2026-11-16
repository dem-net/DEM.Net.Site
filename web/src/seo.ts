/**
 * Search-engine metadata for the public pages. Read at build time by `vite.config.ts`
 * (one static HTML file per page, so GitHub Pages answers 200 instead of serving the
 * 404.html fallback, plus sitemap.xml) and at runtime by the router (head tags follow
 * client-side navigation). No imports: this file is loaded by the Vite config in Node.
 */

export const SITE_URL = 'https://elevationapi.com'
export const SITE_NAME = 'Elevation API'

export interface PageSeo {
  path: string
  /** Full document title. */
  title: string
  description: string
}

export const HOME_SEO: PageSeo = {
  path: '/',
  title: 'Elevation API · 3D terrain models from any place on Earth',
  description:
    'Free elevation API and 3D terrain model generator. Draw an area or upload a GPX track and get a textured glTF or STL model.',
}

/** Every page that should be indexed. Add new public routes here. */
export const INDEXED_PAGES: PageSeo[] = [
  HOME_SEO,
  {
    path: '/terrain',
    title: 'Map to 3D · Elevation API',
    description:
      'Draw an area anywhere on Earth and download a textured 3D terrain model (glTF or STL), with OpenStreetMap buildings and roads.',
  },
  {
    path: '/gpx',
    title: 'GPX to 3D · Elevation API',
    description: 'Upload a GPX track from a hike, ride or run and get a 3D model of the track on the surrounding terrain.',
  },
  {
    path: '/textures',
    title: 'Textures · Elevation API',
    description:
      'Download the georeferenced satellite texture, normal map and 16-bit height map of any area, with world files.',
  },
  {
    path: '/elevation',
    title: 'Elevation · Elevation API',
    description: 'Get the elevation of any point on Earth, or draw a path and get its elevation profile.',
  },
  {
    path: '/stats',
    title: 'Statistics · Elevation API',
    description: 'Map of every 3D model generated with Elevation API, with a day-by-day replay and the datasets used.',
  },
  {
    path: '/expo',
    title: 'Expo · Elevation API',
    description: 'People and projects using Elevation API: 3D printing, games, research and more.',
  },
  {
    path: '/faq',
    title: 'FAQ · Elevation API',
    description: 'Answers about Elevation API: datasets, model formats, size limits, 3D printing and using the API.',
  },
  {
    path: '/about',
    title: 'About · Elevation API',
    description: 'About Elevation API and the open source DEM.Net library behind it, release notes and how to support the project.',
  },
  {
    path: '/privacy',
    title: 'Privacy · Elevation API',
    description: 'What Elevation API measures and stores: cookieless audience measurement and published generation statistics.',
  },
]

export function seoForPath(path: string): PageSeo | undefined {
  const normalized = path.length > 1 ? path.replace(/\/+$/, '') : path
  return INDEXED_PAGES.find((p) => p.path === normalized)
}

export function canonicalUrl(path: string): string {
  return SITE_URL + path
}

/** File that GitHub Pages serves for a page path ("/terrain" → "terrain.html"). */
export function htmlFileFor(path: string): string {
  return path === '/' ? 'index.html' : `${path.slice(1)}.html`
}

export function sitemapXml(): string {
  const urls = INDEXED_PAGES.map((p) => `  <url><loc>${canonicalUrl(p.path)}</loc></url>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

/**
 * The <head> tags that differ per page, between markers so the build can swap them.
 * `page` undefined: not an indexable page (404 fallback), so `noindex` and no canonical.
 */
export function headBlock(page: PageSeo | undefined): string {
  const p = page ?? HOME_SEO
  const tags = [
    `<title>${escapeAttr(page ? p.title : SITE_NAME)}</title>`,
    `<meta name="description" content="${escapeAttr(p.description)}" />`,
    page
      ? `<link rel="canonical" href="${canonicalUrl(p.path)}" />`
      : '<meta name="robots" content="noindex" />',
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:title" content="${escapeAttr(page ? p.title : SITE_NAME)}" />`,
    `<meta property="og:description" content="${escapeAttr(p.description)}" />`,
    ...(page ? [`<meta property="og:url" content="${canonicalUrl(p.path)}" />`] : []),
    `<meta property="og:image" content="${SITE_URL}/og-cover.jpg" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
  ]
  return `<!-- seo:start -->\n    ${tags.join('\n    ')}\n    <!-- seo:end -->`
}

export const HEAD_BLOCK_RE = /<!-- seo:start -->[\s\S]*?<!-- seo:end -->/
