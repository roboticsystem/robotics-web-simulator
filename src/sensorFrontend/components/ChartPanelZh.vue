<script setup>
// 实时曲线面板
import { ref, watch, onMounted, onUnmounted } from 'vue';
import * as echarts from 'echarts';

const props = defineProps({
  series: { type: Object, default: () => ({}) },
  hidden: { type: Boolean, default: false },
  title: { type: String, default: '实时数据曲线' },
  description: { type: String, default: '默认展示最近 180 个采样点，适合观察短时动态变化。' },
});

defineEmits(['clear']);

const el = ref(null);
let chart;

const MAX_POINTS = 180;
const COLOR_PALETTE = [
  '#3dd6c6',
  '#f4a261',
  '#e76f51',
  '#4ea8de',
  '#a3b18a',
  '#ffb703',
  '#8ecae6',
  '#b5179e',
  '#90be6d',
  '#48bfe3',
];

function colorForName(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % COLOR_PALETTE.length;
  return COLOR_PALETTE[idx];
}

function buildOption() {
  const names = Object.keys(props.series || {}).sort();
  const series = names.map((name) => ({
    name,
    type: 'line',
    smooth: true,
    connectNulls: true,
    showSymbol: false,
    data: (props.series[name] || [])
      .slice(-MAX_POINTS)
      .sort((a, b) => a.t - b.t)
      .map((item) => [item.t, item.v]),
    lineStyle: { width: 1.5, color: colorForName(name) },
    itemStyle: { color: colorForName(name) },
  }));

  return {
    backgroundColor: 'transparent',
    textStyle: { color: '#8b9bb0', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
    },
    legend: {
      textStyle: { color: '#8b9bb0' },
      type: 'scroll',
      top: 0,
      selectedMode: 'multiple',
      tooltip: { show: true },
    },
    grid: { left: 48, right: 24, top: 40, bottom: 28 },
    xAxis: {
      type: 'time',
      name: '时间',
      nameTextStyle: { color: '#8b9bb0' },
      axisLine: { lineStyle: { color: '#2a3544' } },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      name: '数值',
      nameTextStyle: { color: '#8b9bb0' },
      axisLine: { lineStyle: { color: '#2a3544' } },
      splitLine: { lineStyle: { color: '#1e2630' } },
    },
    series,
  };
}

function resize() {
  chart?.resize();
}

onMounted(() => {
  chart = echarts.init(el.value, null, { renderer: 'canvas' });
  chart.setOption(buildOption());
  window.addEventListener('resize', resize);
});

onUnmounted(() => {
  window.removeEventListener('resize', resize);
  chart?.dispose();
});

watch(
  () => props.series,
  () => {
    if (!chart) return;
    chart.setOption(buildOption(), { notMerge: true });
  },
  { deep: true }
);
</script>

<template>
  <div v-show="!hidden" class="chart-card panel">
    <div class="chart-head">
      <div>
        <span class="panel-title" style="margin: 0">{{ title }}</span>
        <p class="desc">{{ description }}</p>
      </div>
      <button type="button" class="btn btn-ghost sm" @click="$emit('clear')">清空曲线</button>
    </div>
    <div ref="el" class="chart" />
  </div>
</template>

<style scoped>
.chart-card {
  padding: 10px 12px 12px;
}

.chart-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 8px;
}

.desc {
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 0.82rem;
}

.sm {
  font-size: 0.8rem;
  padding: 0.3rem 0.55rem;
}

.chart {
  width: 100%;
  height: 320px;
}
</style>
