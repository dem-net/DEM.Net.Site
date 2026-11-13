/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASEURL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.md' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent
  export default component
}
