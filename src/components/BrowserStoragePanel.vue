<script setup>
import { computed, ref } from "vue";

const props = defineProps({
  currentFileId: {
    type: String,
    default: null
  },
  currentFileName: {
    type: String,
    required: true
  },
  autosaveStatus: {
    type: String,
    default: "未保存"
  },
  savedFiles: {
    type: Array,
    default: () => []
  },
  disabled: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits([
  "update:currentFileName",
  "create-file",
  "save-browser",
  "download-file",
  "import-file",
  "open-file",
  "delete-file"
]);

const fileInputRef = ref(null);
const isExpanded = ref(false);

const currentBindingLabel = computed(() => {
  return props.currentFileId ? "当前已关联浏览器目录文件" : "当前是临时草稿";
});
const collapsedSummary = computed(() => {
  return props.currentFileId
    ? `${props.currentFileName} · 已关联浏览器文件`
    : `${props.currentFileName} · 临时草稿`;
});

// 触发本地代码文件导入选择框。
function triggerImport() {
  if (props.disabled) {
    return;
  }

  fileInputRef.value?.click();
}

// 处理用户选择的本地代码文件。
function handleFileChange(event) {
  const file = event.target.files?.[0];

  if (file) {
    emit("import-file", file);
  }

  event.target.value = "";
}

// 格式化浏览器目录中的更新时间文本。
function formatUpdatedAt(value) {
  if (!value) {
    return "未知时间";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "未知时间";
  }

  return date.toLocaleString("zh-CN", {
    hour12: false
  });
}

// 统计并显示代码的总行数。
function formatLineCount(code) {
  const total = String(code ?? "").split(/\r?\n/).length;
  return `${total} 行`;
}
</script>

<template>
  <section class="panel storage-panel">
    <header class="panel-header collapsible-panel-head">
      <div>
        <h2>代码管理</h2>
        <p>
          {{
            isExpanded
              ? "在这里管理草稿、浏览器保存文件，以及导入导出代码。"
              : collapsedSummary
          }}
        </p>
      </div>
      <div class="collapsible-panel-actions">
        <span class="badge">{{ savedFiles.length }} 个浏览器文件</span>
        <button
          class="secondary panel-toggle-button"
          type="button"
          @click="isExpanded = !isExpanded"
        >
          {{ isExpanded ? "收起管理" : "展开管理" }}
        </button>
      </div>
    </header>

    <div v-if="isExpanded" class="storage-panel-body collapsible-panel-body">
      <label class="file-name-field">
        <span>当前文件名</span>
        <input
          :value="currentFileName"
          class="text-input"
          type="text"
          placeholder="输入文件名，例如 demo.c"
          :disabled="disabled"
          @input="emit('update:currentFileName', $event.target.value)"
        />
      </label>

      <div class="storage-actions">
        <button class="secondary" :disabled="disabled" @click="emit('create-file')">新建草稿</button>
        <button class="secondary" :disabled="disabled" @click="triggerImport">导入本地</button>
        <button class="secondary" :disabled="disabled" @click="emit('download-file')">下载代码</button>
        <button class="primary" :disabled="disabled" @click="emit('save-browser')">保存到浏览器</button>
      </div>

      <div class="storage-status-row">
        <span class="chip">{{ autosaveStatus }}</span>
        <span class="muted">{{ currentBindingLabel }}</span>
      </div>

      <div class="saved-file-directory">
        <div v-if="!savedFiles.length" class="saved-file-empty">
          浏览器目录里还没有代码文件，点击“保存到浏览器”后会出现在这里。
        </div>

        <template v-else>
          <article
            v-for="file in savedFiles"
            :key="file.id"
            class="saved-file-card"
            :class="{ active: file.id === currentFileId }"
          >
            <div class="saved-file-main">
              <div class="saved-file-meta">
                <strong>{{ file.name }}</strong>
                <span>{{ formatUpdatedAt(file.updatedAt) }}</span>
              </div>
              <p class="muted">
                {{ formatLineCount(file.code) }} · {{ file.code.length }} 字符
              </p>
            </div>

            <div class="saved-file-actions">
              <button class="secondary action-button" :disabled="disabled" @click="emit('open-file', file.id)">
                打开
              </button>
              <button class="secondary action-button danger-button" :disabled="disabled" @click="emit('delete-file', file.id)">
                删除
              </button>
            </div>
          </article>
        </template>
      </div>

      <input
        ref="fileInputRef"
        class="hidden-file-input"
        type="file"
        accept=".c,.h,.txt,text/plain"
        @change="handleFileChange"
      />
    </div>
  </section>
</template>
