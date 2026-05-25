<script setup>
import { computed, ref } from "vue";
import { translateLogLevel } from "../lib/analytics.js";

const props = defineProps({
  logs: {
    type: Array,
    default: () => []
  },
  hidden: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(["export", "exportFiltered", "clearLogs"]);

const keyword = ref("");
const level = ref("all");
const startAt = ref("");
const endAt = ref("");

function parseLocalDateTimeInput(value) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return null;
  }

  const match = normalized.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/
  );
  if (!match) {
    const fallback = new Date(normalized).getTime();
    return Number.isNaN(fallback) ? null : fallback;
  }

  const [, year, month, day, hour, minute, second = "0"] = match;
  const parsed = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    0
  ).getTime();

  return Number.isNaN(parsed) ? null : parsed;
}

const filtered = computed(() => {
  let list = props.logs.slice().reverse();

  if (level.value !== "all") {
    list = list.filter((item) => item.payload?.level === level.value);
  }

  if (keyword.value.trim()) {
    const query = keyword.value.trim().toLowerCase();
    list = list.filter((item) =>
      JSON.stringify(item.payload ?? {}).toLowerCase().includes(query)
    );
  }

  const startMs = parseLocalDateTimeInput(startAt.value);
  if (startMs !== null) {
    list = list.filter((item) => item.timestamp >= startMs);
  }

  const endMs = parseLocalDateTimeInput(endAt.value);
  if (endMs !== null) {
    list = list.filter((item) => item.timestamp <= endMs);
  }

  return list.slice(0, 400);
});

function levelClass(currentLevel) {
  if (currentLevel === "warning") {
    return "warn";
  }

  if (currentLevel === "error") {
    return "err";
  }

  return "";
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  return `${date.toLocaleTimeString("zh-CN", { hour12: false })}.${String(
    date.getMilliseconds()
  ).padStart(3, "0")}`;
}

function exportFiltered(kind) {
  emit("exportFiltered", { kind, rows: [...filtered.value].reverse() });
}

</script>

<template>
  <section v-show="!hidden" class="log-panel panel">
    <div class="toolbar">
      <div class="heading">
        <h3>仿真日志</h3>
        <p>记录传感器采样、脚本执行和场景事件。</p>
      </div>
      <div class="actions">
        <input v-model="keyword" class="inp" placeholder="搜索日志内容" />
        <input v-model="startAt" class="time" type="datetime-local" title="开始时间" />
        <input v-model="endAt" class="time" type="datetime-local" title="结束时间" />
        <select v-model="level" class="sel">
          <option value="all">全部级别</option>
          <option value="info">信息</option>
          <option value="warning">警告</option>
          <option value="error">错误</option>
        </select>
        <button type="button" class="secondary" @click="emit('clearLogs')">清空日志</button>
        <button type="button" class="secondary" @click="emit('export', 'txt')">导出全部 TXT</button>
        <button type="button" class="secondary" @click="emit('export', 'csv')">导出全部 CSV</button>
        <button type="button" class="secondary" @click="exportFiltered('txt')">导出筛选 TXT</button>
        <button type="button" class="secondary" @click="exportFiltered('csv')">导出筛选 CSV</button>
      </div>
    </div>

    <div class="rows">
      <div
        v-for="(row, index) in filtered"
        :key="row.id ?? index"
        class="row"
        :class="levelClass(row.payload?.level)"
      >
        <span class="t">{{ formatTime(row.timestamp) }}</span>
        <span class="lv">[{{ translateLogLevel(row.payload?.level) }}]</span>
        <span class="msg">{{ row.payload?.message }}</span>
        <span v-if="row.payload?.sensorId" class="sid">{{ row.payload.sensorId }}</span>
      </div>
      <div v-if="filtered.length === 0" class="empty">当前没有符合条件的日志。</div>
    </div>
  </section>
</template>

<style scoped>
.log-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 280px;
  max-height: 360px;
  padding: 16px 18px;
  border-radius: 22px;
}

.toolbar {
  display: grid;
  gap: 12px;
}

.heading h3,
.heading p {
  margin: 0;
}

.heading h3 {
  font-size: 1rem;
  color: var(--text);
}

.heading p {
  margin-top: 4px;
  color: var(--muted);
  font-size: 0.88rem;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.inp,
.sel,
.time {
  min-height: 38px;
  padding: 8px 12px;
  border: 1px solid var(--panel-border);
  border-radius: 12px;
  background: var(--surface2);
  color: var(--text);
  outline: none;
}

.inp {
  flex: 1 1 260px;
  min-width: 220px;
}

.rows {
  flex: 1;
  overflow-y: auto;
  font-family: var(--mono);
  font-size: 12px;
  line-height: 1.5;
}

.row {
  display: grid;
  grid-template-columns: 132px 68px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: start;
  padding: 8px 0;
  border-bottom: 1px solid rgba(86, 118, 156, 0.18);
  color: var(--muted);
}

.row.warn {
  color: var(--warn);
}

.row.err {
  color: var(--danger);
}

.msg {
  color: var(--text);
  word-break: break-word;
}

.sid {
  color: var(--accent);
  font-size: 11px;
}

.empty {
  padding: 20px 12px;
  color: var(--muted);
  text-align: center;
}

@media (max-width: 960px) {
  .row {
    grid-template-columns: 1fr;
    gap: 4px;
  }
}
</style>
