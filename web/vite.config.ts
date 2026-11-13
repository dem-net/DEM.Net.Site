import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import Markdown from 'unplugin-vue-markdown/vite'

// GitHub Pages has no SPA rewrites: serving index.html as 404.html lets deep links
// (e.g. /terrain, /sketchfab_oauth2#access_token=…) boot the app and be routed client-side.
function spaFallback(): Plugin {
  let outDir = 'dist'
  return {
    name: 'spa-404-fallback',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
    },
    closeBundle() {
      copyFileSync(resolve(outDir, 'index.html'), resolve(outDir, '404.html'))
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
    "script-src 'self' 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    [
      "connect-src 'self' data: blob:",
      api.origin,
      apiWs, // SignalR /elevation-hub
      'https://photon.komoot.io', // geocoder
      'https://tiles.openfreemap.org', // vector style, tiles, sprites, glyphs
      'https://tile.opentopomap.org',
      'https://s3.amazonaws.com', // Terrarium elevation tiles
      'https://www.gstatic.com', // model-viewer Draco/Basis decoders
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
    spaFallback(),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    chunkSizeWarningLimit: 1500,
  },
}))
