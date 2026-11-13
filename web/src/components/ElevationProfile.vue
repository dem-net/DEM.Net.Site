<script setup lang="ts">
import { computed } from 'vue'
import {
  Chart as ChartJS,
  Filler,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from 'chart.js'
import { Line } from 'vue-chartjs'
import type { GeoPoint } from '@/api/types'

ChartJS.register(LineElement, PointElement, LinearScale, Filler, Tooltip)

const props = defineProps<{ points: GeoPoint[] }>()
const emit = defineEmits<{ hover: [point: GeoPoint | null] }>()

function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

const data = computed<ChartData<'line', { x: number; y: number }[]>>(() => {
  const accent = cssVar('--c-accent')
  return {
    datasets: [
      {
        data: props.points.map((p) => ({ x: (p.distanceFromOriginMeters ?? 0) / 1000, y: p.elevation })),
        borderColor: accent,
        backgroundColor: `color-mix(in srgb, ${accent} 18%, transparent)`,
        fill: 'start',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.15,
      },
    ],
  }
})

const options = computed<ChartOptions<'line'>>(() => {
  const ink = cssVar('--c-ink-3')
  const grid = cssVar('--c-line')
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: {
        type: 'linear',
        // End the axis at the path length instead of the next "nice" tick
        min: 0,
        max: (props.points.at(-1)?.distanceFromOriginMeters ?? 0) / 1000 || undefined,
        ticks: { color: ink, callback: (v) => `${+Number(v).toFixed(1)} km`, maxTicksLimit: 6 },
        grid: { color: grid },
      },
      y: { ticks: { color: ink, callback: (v) => `${v} m`, maxTicksLimit: 5 }, grid: { color: grid } },
    },
    plugins: {
      tooltip: {
        displayColors: false,
        callbacks: {
          title: (items) => `${(items[0].parsed.x ?? 0).toFixed(2)} km`,
          label: (item) => `${Math.round(item.parsed.y ?? 0)} m`,
        },
      },
    },
    onHover: (_e, elements) => emit('hover', elements.length ? props.points[elements[0].index] : null),
  }
})
</script>

<template>
  <!-- Grows with the (resizable) panel width: ToolLayout's aside is a size container -->
  <div class="h-44 @lg:h-60 @2xl:h-80 @4xl:h-96" @mouseleave="emit('hover', null)">
    <Line :data="data" :options="options" aria-label="Elevation profile chart" role="img" />
  </div>
</template>
