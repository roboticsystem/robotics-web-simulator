<script setup>
import { computed, ref } from "vue";

const props = defineProps({
  errors: {
    type: Array,
    default: () => []
  },
  logs: {
    type: Array,
    default: () => []
  },
  picocStatus: {
    type: String,
    default: ""
  },
  debugStatus: {
    type: String,
    default: ""
  },
  currentTraceLine: {
    type: Number,
    default: null
  },
  traceEntries: {
    type: Array,
    default: () => []
  },
  watchedVariables: {
    type: Array,
    default: () => []
  },
  breakpoints: {
    type: Array,
    default: () => []
  }
});

const activeSection = ref("status");

const sections = computed(() => [
  {
    key: "status",
    title: "运行状态",
    hint: props.picocStatus ? `PicoC：${props.picocStatus}` : "PicoC 未加载"
  },
  {
    key: "watch",
    title: "变量监视",
    hint: props.watchedVariables.length ? `${props.watchedVariables.length} 个变量` : "暂无变量"
  },
  {
    key: "trace",
    title: "行级追踪",
    hint: props.traceEntries.length ? `${props.traceEntries.length} 条记录` : "暂无追踪"
  },
  {
    key: "breakpoints",
    title: "断点",
    hint: props.breakpoints.length ? `${props.breakpoints.length} 个断点` : "未设置断点"
  },
  {
    key: "errors",
    title: "编译与运行错误",
    hint: props.errors.length ? `${props.errors.length} 条问题` : "当前无错误"
  },
  {
    key: "logs",
    title: "调试输出",
    hint: props.logs.length ? `${props.logs.length} 条输出` : "暂无输出"
  }
]);

const activeSectionMeta = computed(
  () => sections.value.find((section) => section.key === activeSection.value) ?? sections.value[0]
);

// 把变量作用域标识转换为中文显示文本。
function formatScope(scope) {
  return scope === "global" ? "全局" : "局部";
}
</script>

<template>
  <section class="panel debugger-shell">
    <aside class="debugger-nav">
      <button
        v-for="section in sections"
        :key="section.key"
        type="button"
        class="debugger-nav-item"
        :class="{ active: section.key === activeSection }"
        :aria-pressed="section.key === activeSection"
        @click="activeSection = section.key"
      >
        <span>{{ section.title }}</span>
        <small>{{ section.hint }}</small>
      </button>
    </aside>

    <div class="debugger-detail">
      <header class="mini-header debugger-detail-header">
        <div>
          <h3>{{ activeSectionMeta.title }}</h3>
          <p>{{ activeSectionMeta.hint }}</p>
        </div>
      </header>

      <div v-if="activeSection === 'status'" class="kv-list">
        <div>
          <span>PicoC</span>
          <strong>{{ picocStatus || "未加载" }}</strong>
        </div>
        <div>
          <span>当前执行行</span>
          <strong>{{ currentTraceLine || "-" }}</strong>
        </div>
        <div>
          <span>调试状态</span>
          <strong>{{ debugStatus || "未启用" }}</strong>
        </div>
        <div>
          <span>错误数量</span>
          <strong>{{ errors.length }}</strong>
        </div>
      </div>

      <template v-else-if="activeSection === 'watch'">
        <div v-if="watchedVariables.length" class="watch-list">
          <div
            v-for="item in watchedVariables"
            :key="item.id"
            class="watch-item"
          >
            <div class="watch-head">
              <span class="watch-scope" :data-scope="item.scope">{{ formatScope(item.scope) }}</span>
              <small>{{ item.type }}</small>
            </div>
            <strong>{{ item.name }}</strong>
            <code>{{ item.value }}</code>
          </div>
        </div>
        <p v-else class="muted">运行代码后，这里会显示当前行可见的变量快照。</p>
      </template>

      <template v-else-if="activeSection === 'trace'">
        <div v-if="traceEntries.length" class="trace-list">
          <div
            v-for="entry in traceEntries"
            :key="entry.id"
            class="trace-item"
            :class="{ active: entry.line === props.currentTraceLine }"
          >
            <span>#{{ entry.step }}</span>
            <strong>第 {{ entry.line }} 行</strong>
            <code class="trace-code">{{ entry.code || "(空行)" }}</code>
          </div>
        </div>
        <p v-else class="muted">运行后会按语句执行顺序记录行级追踪。</p>
      </template>

      <template v-else-if="activeSection === 'breakpoints'">
        <div v-if="breakpoints.length" class="breakpoint-list">
          <div
            v-for="line in breakpoints"
            :key="line"
            class="trace-item"
          >
            <span>断点</span>
            <strong>第 {{ line }} 行</strong>
          </div>
        </div>
        <p v-else class="muted">点击编辑器左侧圆点即可添加或取消断点。</p>
      </template>

      <template v-else-if="activeSection === 'errors'">
        <div v-if="errors.length" class="message-list debugger-message-list">
          <div
            v-for="error in errors"
            :key="`${error.line}-${error.column}-${error.message}`"
            class="callout warning"
          >
            <strong>第 {{ error.line }} 行，第 {{ error.column }} 列</strong>
            <p>{{ error.message }}</p>
            <small>{{ error.suggestion }}</small>
          </div>
        </div>
        <p v-else class="muted">当前 PicoC / C 代码没有检测到错误。</p>
      </template>

      <template v-else>
        <div class="console-output">
          <p v-if="!logs.length" class="muted">PicoC 标准输出、错误输出和运行日志会显示在这里。</p>
          <p v-for="entry in logs" :key="entry.id">{{ entry.message }}</p>
        </div>
      </template>
    </div>
  </section>
</template>
