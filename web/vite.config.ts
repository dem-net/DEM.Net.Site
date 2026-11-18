import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import Markdown from 'unplugin-vue-markdown/vite'
import { HEAD_BLOCK_RE, HOME_SEO, INDEXED_PAGES, headBlock, htmlFileFor, sitemapXml } from './src/seo'

/**
 * GitHub Pages has no SPA rewrites. Each indexed page gets its own copy of index.html
 * (/terrain → terrain.html) with its title, description and canonical, so it is served
 * with HTTP 200: Google drops pages answered with 404, whatever they render. Every other
 * path (/sketchfab_oauth2#access_token=…, old /playground_* URLs, typos) still boots the
 * app through 404.html, which is marked noindex. Also writes sitemap.xml.
 */
function pageHtml(): Plugin {
  let outDir = 'dist'
  return {
    name: 'page-html',
    configResolved(config) {
      outDir = config.build.outDir
    },
    // Dev and build: the home page's tags replace the placeholder comment in index.html.
    transformIndexHtml: (html) => html.replace(/<!-- seo:[^>]*-->/, headBlock(HOME_SEO)),
    closeBundle() {
      const index = readFileSync(resolve(outDir, 'index.html'), 'utf8')
      if (!HEAD_BLOCK_RE.test(index)) throw new Error('page-html: SEO block missing from index.html')
      for (const page of INDEXED_PAGES) {
        if (page.path === '/') continue
        writeFileSync(resolve(outDir, htmlFileFor(page.path)), index.replace(HEAD_BLOCK_RE, headBlock(page)))
      }
      writeFileSync(resolve(outDir, '404.html'), index.replace(HEAD_BLOCK_RE, headBlock(undefined)))
      writeFileSync(resolve(outDir, 'sitemap.xml'), sitemapXml())
    },
  }
}

/**
 * Content-Security-Policy as a <meta> tag (GitHub Pages can't send headers). Build only:
 * the dev server relies on inline scripts for HMR. Every third-party host the app talks to
 * must be listed here, or the browser silently blocks it.
 */
function contentSecurityPolicy(apiBase: string): Plugin {
  const api = new URL(apiBase)
  const apiWs = `${api.protocol === 'https:' ? 'wss:' : 'ws:'}//${api.host}`
  const csp = [
    "default-src 'self'",
    // wasm-unsafe-eval: model-viewer's optional Draco/Basis decoders (WebAssembly, no JS eval)
    "script-src 'self' 'wasm-unsafe-eval' https://m.elevationapi.com", // analytics script.js
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    `media-src 'self' blob: ${api.origin}`, // gallery turntables: the preview of a capture (blob:) and published clips
    [
      "connect-src 'self' data: blob:",
      api.origin,
      apiWs, // SignalR /elevation-hub
      'https://photon.komoot.io', // geocoder
      'https://tiles.openfreemap.org', // vector style, tiles, sprites, glyphs
      'https://tile.opentopomap.org',
      'https://s3.amazonaws.com', // Terrarium elevation tiles
      'https://www.gstatic.com', // model-viewer Draco/Basis decoders
      'https://m.elevationapi.com', // analytics beacons (sendBeacon)
    ].join(' '),
    "worker-src 'self' blob:",
    'frame-src https://player.vimeo.com',
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: csp }, injectTo: 'head-prepend' },
    ],
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [
    vue({
      include: [/\.vue$/, /\.md$/],
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag === 'model-viewer',
        },
      },
    }),
    Markdown({
      markdownItOptions: { linkify: true, typographer: true },
      wrapperClasses: 'prose',
    }),
    tailwindcss(),
    // Same default as API_BASE in src/api/client.ts
    contentSecurityPolicy(loadEnv(mode, process.cwd(), 'VITE_').VITE_API_BASEURL || 'https://api.elevationapi.com'),
    pageHtml(),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    chunkSizeWarningLimit: 1500,
  },
}))
