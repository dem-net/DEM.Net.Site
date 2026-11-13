<script setup lang="ts">
import { computed } from 'vue'
import { LoaderCircle, Wand } from '@lucide/vue'
import type { SizeEstimate } from '@/api/types'

const props = defineProps<{
  estimate: SizeEstimate | null
  loading: boolean
  /** Mesh detail (%) that fits under the limit; null when even minimum detail is too large. */
  fitDetail: number | null
  /** When false (GPX: estimate from the track's area only), being over the limit warns instead of blocking. */
  blocking?: boolean
}>()
const emit = defineEmits<{ fit: [detail: number] }>()

const ratio = computed(() => (props.estimate ? props.estimate.sizeMB / props.estimate.maxMB : 0))
const level = computed(() => (!props.estimate ? 'ok' : !props.estimate.allowed ? 'over' : ratio.value > 0.7 ? 'near' : 'ok'))

const fmt = (mb: number) =>
  mb >= 100 ? Math.round(mb).toLocaleString() : mb >= 10 ? mb.toFixed(0) : mb >= 1 ? mb.toFixed(1) : mb.toFixed(2)

const barClass = computed(() => ({ ok: 'bg-accent', near: 'bg-warn', over: 'bg-danger' })[level.value])
</script>

<template>
  <div class="text-sm" aria-live="polite">
    <div class="flex items-baseline justify-between gap-2">
      <span class="text-ink-2">Estimated size</span>
      <span class="flex items-center gap-1.5 tabular-nums" :class="level === 'over' ? 'font-semibold text-danger' : 'text-ink'">
        <LoaderCircle v-if="loading" class="size-3.5 animate-spin text-ink-3" aria-label="Updating estimate" />
        <template v-if="estimate">≈ {{ fmt(estimate.sizeMB) }} MB <span class="font-normal text-ink-3">/ {{ fmt(estimate.maxMB) }} MB</span></template>
        <span v-else-if="!loading" class="text-ink-3">–</span>
      </span>
    </div>
    <div
      class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-subtle"
      role="meter"
      aria-label="Estimated size compared with the maximum"
      :aria-valuenow="estimate ? Math.round(ratio * 100) : undefined"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <div class="h-full rounded-full transition-[width] duration-300" :class="[barClass, loading ? 'opacity-50' : '']" :style="{ width: `${Math.min(100, ratio * 100)}%` }" />
    </div>

    <div v-if="level === 'over' && !loading" class="mt-2 rounded-lg px-3 py-2" :class="blocking ? 'bg-danger-soft text-danger' : 'bg-warn-soft text-warn'" role="alert">
      <p v-if="blocking">This model is too large to generate.</p>
      <p v-else>This model will probably be too large to generate.</p>
      <template v-if="fitDetail !== null">
        <p class="mt-0.5 text-xs opacity-90">Lowering the mesh detail to {{ fitDetail }}% should bring it under the limit.</p>
        <button type="button" class="btn btn-secondary mt-2 w-full py-1.5" @click="emit('fit', fitDetail)">
          <Wand class="size-4" /> Reduce to fit
        </button>
      </template>
      <p v-else class="mt-0.5 text-xs opacity-90">
        Even at minimum mesh detail it is over the limit. Choose a smaller area, or lower the texture quality.
      </p>
    </div>
    <p v-else-if="level === 'near' && !loading" class="mt-1 text-xs text-warn">Close to the limit.</p>
    <p v-else class="mt-1 text-xs text-ink-3">Approximate: the actual file can be smaller or larger.</p>
  </div>
</template>
