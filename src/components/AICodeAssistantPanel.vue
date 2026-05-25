<script setup>
import { computed } from "vue";

const props = defineProps({
  expanded: {
    type: Boolean,
    default: false
  },
  prompt: {
    type: String,
    default: ""
  },
  provider: {
    type: String,
    default: "ollama"
  },
  model: {
    type: String,
    default: "deepseek-coder"
  },
  endpoint: {
    type: String,
    default: "/api/ollama/chat"
  },
  apiKey: {
    type: String,
    default: ""
  },
  generatedCode: {
    type: String,
    default: ""
  },
  status: {
    type: String,
    default: "等待生成"
  },
  error: {
    type: String,
    default: ""
  },
  warning: {
    type: String,
    default: ""
  },
  loading: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits([
  "update:expanded",
  "update:prompt",
  "update:provider",
  "update:model",
  "update:endpoint",
  "update:apiKey",
  "generate",
  "apply-generated",
  "clear-generated"
]);

const providerLabel = computed(() =>
  props.provider === "openai" ? "GPT 接口" : "本地 Ollama"
);

const collapsedSummary = computed(() => {
  if (props.loading) {
    return `正在调用${providerLabel.value}生成机器人 C 代码。`;
  }

  if (props.generatedCode) {
    const lineCount = props.generatedCode.split(/\r?\n/).length;
    return `已生成 ${lineCount} 行候选代码，可展开后预览并应用。`;
  }

  return `使用${providerLabel.value}生成机器人 C 代码，会参考当前地图、编辑器内容和错误信息。`;
});

const generatedLineCount = computed(() => {
  if (!props.generatedCode) {
    return 0;
  }

  return props.generatedCode.split(/\r?\n/).length;
});
</script>

<template>
  <section class="panel storage-panel ai-panel">
    <header class="panel-header collapsible-panel-head">
      <div>
        <h2>AI 代码生成</h2>
        <p>{{ expanded ? `输入需求后调用${providerLabel}生成完整 C 程序。` : collapsedSummary }}</p>
      </div>
      <div class="collapsible-panel-actions">
        <span class="badge">{{ providerLabel }} / {{ model }}</span>
        <button
          class="secondary panel-toggle-button"
          type="button"
          @click="emit('update:expanded', !expanded)"
        >
          {{ expanded ? "收起面板" : "展开面板" }}
        </button>
      </div>
    </header>

    <div v-if="expanded" class="storage-panel-body collapsible-panel-body ai-panel-body">
      <label class="file-name-field">
        <span>需求描述</span>
        <textarea
          :value="prompt"
          class="text-input ai-prompt-input"
          :disabled="disabled || loading"
          placeholder="例如：生成一个避障巡线示例，遇到前方障碍就右转 90 度并继续前进，同时输出距离和电量。"
          @input="emit('update:prompt', $event.target.value)"
        />
      </label>

      <div class="ai-panel-config">
        <label class="file-name-field">
          <span>模型来源</span>
          <select
            :value="provider"
            class="text-input"
            :disabled="loading"
            @change="emit('update:provider', $event.target.value)"
          >
            <option value="ollama">本地 Ollama</option>
            <option value="openai">GPT 中转接口</option>
          </select>
        </label>

        <label class="file-name-field">
          <span>模型名称</span>
          <input
            :value="model"
            class="text-input"
            type="text"
            :disabled="loading"
            placeholder="deepseek-coder:6.7b"
            @input="emit('update:model', $event.target.value)"
          />
        </label>

        <label class="file-name-field">
          <span>接口地址</span>
          <input
            :value="endpoint"
            class="text-input"
            type="text"
            :disabled="loading"
            :placeholder="provider === 'openai' ? 'https://api.openai.com/v1/chat/completions' : '/api/ollama/chat'"
            @input="emit('update:endpoint', $event.target.value)"
          />
        </label>

        <label v-if="provider === 'openai'" class="file-name-field">
          <span>API Key</span>
          <input
            :value="apiKey"
            class="text-input"
            type="password"
            :disabled="loading"
            placeholder="sk-..."
            @input="emit('update:apiKey', $event.target.value)"
          />
        </label>
      </div>

      <div class="storage-actions">
        <button class="primary" :disabled="disabled || loading" @click="emit('generate')">
          {{ loading ? "AI 生成中..." : "开始生成" }}
        </button>
        <button
          class="secondary"
          :disabled="disabled || !generatedCode || loading"
          @click="emit('apply-generated')"
        >
          应用到编辑器
        </button>
        <button
          class="secondary"
          :disabled="loading || (!generatedCode && !error)"
          @click="emit('clear-generated')"
        >
          清空结果
        </button>
      </div>

      <div class="storage-status-row">
        <span class="chip">{{ status }}</span>
        <span class="muted">
          {{
            provider === "openai"
              ? "会调用 GPT 中转接口。API Key 仅保留在当前页面会话中。"
              : "先启动 Ollama 服务；"
          }}
        </span>
      </div>

      <div v-if="error" class="callout danger">
        <strong>AI 调用失败</strong>
        <p>{{ error }}</p>
      </div>

      <div v-else-if="warning" class="callout warning">
        <strong>需要人工复核</strong>
        <p>{{ warning }}</p>
      </div>

      <section v-if="generatedCode" class="ai-preview">
        <header class="mini-header">
          <h3>生成结果预览</h3>
          <span class="badge">{{ generatedLineCount }} 行</span>
        </header>
        <pre class="syntax-guide ai-generated-preview">{{ generatedCode }}</pre>
      </section>
    </div>
  </section>
</template>
