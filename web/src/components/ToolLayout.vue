<script setup lang="ts">
/**
 * Map fills the screen; the panel sits on the left on desktop and below the map on mobile.
 * On desktop the panel can be resized by dragging its right edge (width is remembered).
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

defineProps<{ title: string; subtitle?: string }>()

const DEFAULT_WIDTH = 380
const MIN_WIDTH = 320
const STORAGE_KEY = 'dem.panelWidth'

function readWidth(): number {
  try {
    const v = Number(localStorage.getItem(STORAGE_KEY))
    return Number.isFinite(v) && v >= MIN_WIDTH ? v : DEFAULT_WIDTH
  } catch {
    return DEFAULT_WIDTH
  }
}

/** Leave at least ~35% of the window for the map (re-clamped when the window shrinks). */
const windowWidth = ref(window.innerWidth)
const onWindowResize = () => (windowWidth.value = window.innerWidth)
onMounted(() => window.addEventListener('resize', onWindowResize))
onBeforeUnmount(() => window.removeEventListener('resize', onWindowResize))
const maxWidth = () => Math.max(MIN_WIDTH, Math.round(windowWidth.value * 0.65))
const clamp = (w: number) => Math.min(maxWidth(), Math.max(MIN_WIDTH, Math.round(w)))

const width = ref(readWidth())
const dragging = ref(false)
const aside = ref<HTMLElement>()
const panelStyle = computed(() => ({ '--panel-w': `${clamp(width.value)}px` }))

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, String(width.value))
  } catch {
    /* storage unavailable */
  }
}

function onPointerMove(e: PointerEvent) {
  const left = aside.value?.getBoundingClientRect().left ?? 0
  width.value = clamp(e.clientX - left)
}

function stopDrag() {
  if (!dragging.value) return
  dragging.value = false
  document.body.style.removeProperty('cursor')
  document.body.style.removeProperty('user-select')
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', stopDrag)
  save()
}

function startDrag(e: PointerEvent) {
  if (e.button !== 0) return
  e.preventDefault()
  dragging.value = true
  // Keep the resize cursor and avoid selecting text while dragging over the map/panel.
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', stopDrag)
}

function onKey(e: KeyboardEvent) {
  const step = e.shiftKey ? 80 : 20
  if (e.key === 'ArrowLeft') width.value = clamp(width.value - step)
  else if (e.key === 'ArrowRight') width.value = clamp(width.value + step)
  else if (e.key === 'Home') width.value = MIN_WIDTH
  else if (e.key === 'End') width.value = maxWidth()
  else return
  e.preventDefault()
  save()
}

function reset() {
  width.value = DEFAULT_WIDTH
  save()
}

onBeforeUnmount(stopDrag)
</script>

<template>
  <div class="flex h-full min-h-0 flex-col md:flex-row">
    <aside
      ref="aside"
      :style="panelStyle"
      class="@container relative order-2 flex max-h-[55dvh] min-h-0 flex-col border-t border-line bg-surface md:order-1 md:max-h-none md:w-(--panel-w) md:shrink-0 md:border-t-0 md:border-r"
    >
      <div class="flex items-start gap-3 border-b border-line px-5 pt-4 pb-3">
        <div class="min-w-0 flex-1">
          <h1 class="text-lg font-semibold tracking-tight">{{ title }}</h1>
          <p v-if="subtitle" class="mt-0.5 text-sm text-ink-3">{{ subtitle }}</p>
        </div>
        <!-- Page actions next to the title (e.g. Share) -->
        <slot name="actions" />
      </div>
      <div
        class="min-h-0 flex-1 overflow-y-auto px-5 py-4"
        :class="$slots.footer ? '' : 'pb-[max(1rem,env(safe-area-inset-bottom))]'"
      >
        <slot name="panel" />
      </div>
      <!-- Primary action stays visible while the options scroll -->
      <div v-if="$slots.footer" class="border-t border-line px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <slot name="footer" />
      </div>

      <!-- Resize handle (desktop only) -->
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panel"
        :aria-valuenow="width"
        :aria-valuemin="MIN_WIDTH"
        tabindex="0"
        title="Drag to resize · double-click to reset"
        class="group absolute inset-y-0 -right-1.5 z-30 hidden w-3 cursor-col-resize touch-none md:block"
        @pointerdown="startDrag"
        @dblclick="reset"
        @keydown="onKey"
      >
        <span
          class="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 transition-colors group-hover:bg-accent group-focus-visible:bg-accent"
          :class="dragging ? 'bg-accent' : 'bg-transparent'"
        />
      </div>
    </aside>
    <section class="relative order-1 min-h-[45dvh] flex-1 md:order-2 md:min-h-0">
      <slot name="map" />
      <!-- While dragging, keep the map from grabbing pointer events -->
      <div v-if="dragging" class="absolute inset-0 z-40 cursor-col-resize" />
    </section>
  </div>
</template>
