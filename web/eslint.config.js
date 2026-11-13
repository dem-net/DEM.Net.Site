import pluginVue from 'eslint-plugin-vue'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'

export default defineConfigWithVueTs(
  { ignores: ['dist/**', 'node_modules/**'] },
  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,
  {
    rules: {
      // page components are single-word by design (HomePage is fine, but route files like FaqPage too)
      'vue/multi-word-component-names': 'off',
    },
  },
)
