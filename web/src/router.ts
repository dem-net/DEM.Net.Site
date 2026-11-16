import { createRouter, createWebHistory } from 'vue-router'
import { routes } from './routes'
import { HOME_SEO, SITE_NAME, canonicalUrl, seoForPath } from './seo'

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: (to, _from, saved) => {
    if (saved) return saved
    // Plain anchors only (e.g. /about#support); OAuth hashes like #access_token=… are not selectors.
    // `top` keeps the target below the sticky header (vue-router ignores CSS scroll-margin).
    if (/^#[\w-]+$/.test(to.hash)) return { el: to.hash, top: 72, behavior: 'smooth' }
    return { top: 0 }
  },
})

/** Sets (or removes, when `value` is null) a <head> element's attribute, creating the element if needed. */
function setHead(selector: string, create: () => HTMLElement, attr: string, value: string | null) {
  let el = document.head.querySelector<HTMLElement>(selector)
  if (value === null) return el?.remove()
  if (!el) document.head.append((el = create()))
  el.setAttribute(attr, value)
}

function element(tag: string, attr: string, value: string) {
  return () => {
    const el = document.createElement(tag)
    el.setAttribute(attr, value)
    return el
  }
}
const metaName = (name: string) => element('meta', 'name', name)
const metaProperty = (property: string) => element('meta', 'property', property)

router.afterEach((to) => {
  // Same tags as the static per-page HTML written at build time (src/seo.ts).
  const seo = seoForPath(to.path)
  const title = seo?.title ?? (to.meta.title ? `${to.meta.title as string} · ${SITE_NAME}` : HOME_SEO.title)
  const description = (seo ?? HOME_SEO).description
  const canonical = seo ? canonicalUrl(seo.path) : null
  document.title = title
  setHead('meta[name="description"]', metaName('description'), 'content', description)
  setHead('meta[property="og:title"]', metaProperty('og:title'), 'content', title)
  setHead('meta[property="og:description"]', metaProperty('og:description'), 'content', description)
  setHead('meta[property="og:url"]', metaProperty('og:url'), 'content', canonical)
  setHead('link[rel="canonical"]', element('link', 'rel', 'canonical'), 'href', canonical)
  setHead('meta[name="robots"]', metaName('robots'), 'content', seo ? null : 'noindex')
})

export default router
