<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch
} from "vue";
import { queryCSuggestions, resolveCHoverInfo } from "../core/cEditorIntelligence.js";
import { loadMonaco } from "../core/monacoSetup.js";

const props = defineProps({
  modelValue: {
    type: String,
    required: true
  },
  breakpoints: {
    type: Array,
    default: () => []
  },
  errors: {
    type: Array,
    default: () => []
  },
  currentLine: {
    type: Number,
    default: null
  },
  title: {
    type: String,
    default: "代码编辑器"
  },
  language: {
    type: String,
    default: "c"
  }
});

const emit = defineEmits(["update:modelValue", "toggle-breakpoint"]);

const editorMountRef = ref(null);
const editorShellRef = ref(null);
const hoverWidgetRef = ref(null);
const suggestWidgetRef = ref(null);
const suggestListRef = ref(null);
const lineCount = ref(1);
const lines = computed(() => props.modelValue.split(/\r?\n/).length);

const ideaSuggest = reactive({
  visible: false,
  items: [],
  selectedIndex: 0,
  top: 48,
  left: 24,
  range: null,
  query: ""
});

const hoverCard = reactive({
  visible: false,
  top: 56,
  left: 24,
  sections: [],
  anchorPosition: null
});

const selectedSuggestion = computed(
  () => ideaSuggest.items[ideaSuggest.selectedIndex] ?? null
);

let monacoInstance;
let editorInstance;
let modelInstance;
let decorationIds = [];
let suppressModelEvent = false;
let suggestTriggerTimer = 0;

// 把错误级别转换为 Monaco 标记级别。
function getMarkerSeverity(error) {
  if (!monacoInstance) {
    return undefined;
  }

  return error?.severity === "warning"
    ? monacoInstance.MarkerSeverity.Warning
    : monacoInstance.MarkerSeverity.Error;
}

// 把当前错误列表同步到 Monaco 标记系统。
function updateMarkers() {
  if (!monacoInstance || !modelInstance) {
    return;
  }

  const markers = props.errors.map((error) => ({
    startLineNumber: Math.max(error.line ?? 1, 1),
    startColumn: Math.max(error.column ?? 1, 1),
    endLineNumber: Math.max(error.endLine ?? error.line ?? 1, error.line ?? 1),
    endColumn: Math.max(
      error.endColumn ?? (error.column ?? 1) + 1,
      (error.column ?? 1) + 1
    ),
    message: [error.message, error.suggestion].filter(Boolean).join("\n"),
    severity: getMarkerSeverity(error)
  }));

  monacoInstance.editor.setModelMarkers(modelInstance, "codex-diagnostics", markers);
}

// 更新断点、错误行和当前执行行装饰器。
function updateDecorations() {
  if (!monacoInstance || !editorInstance) {
    return;
  }

  const decorations = [];

  props.breakpoints.forEach((line) => {
    decorations.push({
      range: new monacoInstance.Range(line, 1, line, 1),
      options: {
        isWholeLine: true,
        glyphMarginClassName: "monaco-breakpoint-glyph",
        glyphMarginHoverMessage: { value: "点击左侧边栏切换断点" }
      }
    });
  });

  props.errors.forEach((error) => {
    decorations.push({
      range: new monacoInstance.Range(error.line, 1, error.line, 1),
      options: {
        isWholeLine: true,
        className:
          error.severity === "warning" ? "monaco-warning-line" : "monaco-error-line",
        glyphMarginClassName:
          error.severity === "warning" ? "monaco-warning-glyph" : "monaco-error-glyph",
        glyphMarginHoverMessage: {
          value: `${error.message}\n${error.suggestion ?? ""}`.trim()
        }
      }
    });
  });

  if (props.currentLine) {
    decorations.push({
      range: new monacoInstance.Range(props.currentLine, 1, props.currentLine, 1),
      options: {
        isWholeLine: true,
        className: "monaco-current-line"
      }
    });
  }

  decorationIds = editorInstance.deltaDecorations(decorationIds, decorations);
}

// 清除参数提示触发定时器。
function clearSuggestTriggerTimer() {
  if (!suggestTriggerTimer) {
    return;
  }

  window.clearTimeout(suggestTriggerTimer);
  suggestTriggerTimer = 0;
}

// 关闭自定义智能提示面板。
function hideIdeaSuggest() {
  ideaSuggest.visible = false;
  ideaSuggest.items = [];
  ideaSuggest.selectedIndex = 0;
  ideaSuggest.range = null;
  ideaSuggest.query = "";
}

// 关闭悬停说明卡片。
function hideHoverCard() {
  hoverCard.visible = false;
  hoverCard.sections = [];
  hoverCard.anchorPosition = null;
}

// 读取当前光标附近的上下文信息。
function getCursorContext(position = editorInstance?.getPosition()) {
  if (!monacoInstance || !modelInstance || !position) {
    return null;
  }

  const word = modelInstance.getWordUntilPosition(position);

  return {
    position,
    prefix: word.word ?? "",
    linePrefix: modelInstance.getValueInRange(
      new monacoInstance.Range(position.lineNumber, 1, position.lineNumber, position.column)
    ),
    lineSuffix: modelInstance.getValueInRange(
      new monacoInstance.Range(
        position.lineNumber,
        position.column,
        position.lineNumber,
        modelInstance.getLineMaxColumn(position.lineNumber)
      )
    ),
    range: new monacoInstance.Range(
      position.lineNumber,
      word.startColumn,
      position.lineNumber,
      word.endColumn
    )
  };
}

// 判断当前位置是否适合显示上下文补全。
function isContextSuggestionPosition(linePrefix = "") {
  return (
    /robot_read_sensor\s*\(\s*"[^"]*$/.test(linePrefix) ||
    /#include\s*[<"][^>"]*$/.test(linePrefix)
  );
}

// 判断当前提示面板是否应该保持打开。
function shouldKeepSuggestOpen(context) {
  if (!context) {
    return false;
  }

  return Boolean(context.prefix) || isContextSuggestionPosition(context.linePrefix);
}

// 把当前选中的提示项滚动到可见区域。
function scrollActiveSuggestionIntoView() {
  const activeItem = suggestListRef.value?.querySelector(".idea-suggest-item.active");
  activeItem?.scrollIntoView({ block: "nearest" });
}

// 计算自定义提示面板的位置。
function updateIdeaSuggestPosition(position) {
  if (!editorInstance) {
    return;
  }

  const cursorLayout = editorInstance.getScrolledVisiblePosition(position);
  if (!cursorLayout) {
    return;
  }

  const shellWidth = editorShellRef.value?.clientWidth ?? 0;
  const shellHeight = editorShellRef.value?.clientHeight ?? 0;
  const widgetWidth = suggestWidgetRef.value?.offsetWidth ?? Math.min(shellWidth, 720);
  const widgetHeight = suggestWidgetRef.value?.offsetHeight ?? 360;

  let top = cursorLayout.top + cursorLayout.height + 10;
  let left = Math.max(12, cursorLayout.left + 18);

  if (shellHeight && top + widgetHeight > shellHeight - 12 && cursorLayout.top > widgetHeight + 12) {
    top = cursorLayout.top - widgetHeight - 12;
  }

  if (shellHeight) {
    top = Math.max(12, Math.min(top, Math.max(12, shellHeight - widgetHeight - 12)));
  }

  if (shellWidth) {
    left = Math.max(12, Math.min(left, Math.max(12, shellWidth - widgetWidth - 12)));
  }

  ideaSuggest.top = top;
  ideaSuggest.left = left;
}

// 同步提示面板在视口中的显示位置。
function syncIdeaSuggestViewport(position = editorInstance?.getPosition()) {
  if (!ideaSuggest.visible || !position) {
    return;
  }

  updateIdeaSuggestPosition(position);
  nextTick(() => {
    updateIdeaSuggestPosition(position);
    scrollActiveSuggestionIntoView();
  });
}

// 计算悬停说明卡片的位置。
function updateHoverCardPosition(position) {
  if (!editorInstance || !position) {
    return;
  }

  const anchorLayout = editorInstance.getScrolledVisiblePosition(position);
  if (!anchorLayout) {
    hideHoverCard();
    return;
  }

  const shellWidth = editorShellRef.value?.clientWidth ?? 0;
  const shellHeight = editorShellRef.value?.clientHeight ?? 0;
  const widgetWidth = hoverWidgetRef.value?.offsetWidth ?? Math.min(shellWidth, 420);
  const widgetHeight = hoverWidgetRef.value?.offsetHeight ?? 180;

  let top = anchorLayout.top + anchorLayout.height + 10;
  let left = Math.max(12, anchorLayout.left + 10);

  if (shellHeight && top + widgetHeight > shellHeight - 12 && anchorLayout.top > widgetHeight + 12) {
    top = anchorLayout.top - widgetHeight - 12;
  }

  if (shellHeight) {
    top = Math.max(12, Math.min(top, Math.max(12, shellHeight - widgetHeight - 12)));
  }

  if (shellWidth) {
    left = Math.max(12, Math.min(left, Math.max(12, shellWidth - widgetWidth - 12)));
  }

  hoverCard.top = top;
  hoverCard.left = left;
}

// 显示当前符号的悬停说明卡片。
function showHoverCard(position, info) {
  hoverCard.sections = info.sections;
  hoverCard.anchorPosition = position;
  hoverCard.visible = true;
  nextTick(() => {
    updateHoverCardPosition(position);
  });
}

// 处理编辑器中的鼠标悬停说明逻辑。
function handleEditorMouseMove(event) {
  if (!editorInstance || !modelInstance || ideaSuggest.visible) {
    hideHoverCard();
    return;
  }

  const position = event.target.position;
  if (!position) {
    hideHoverCard();
    return;
  }

  const info = resolveCHoverInfo({
    source: modelInstance.getValue(),
    lineNumber: position.lineNumber,
    column: position.column
  });

  if (!info) {
    hideHoverCard();
    return;
  }

  showHoverCard(
    {
      lineNumber: info.range.startLineNumber,
      column: info.range.startColumn
    },
    info
  );
}

// 根据当前上下文刷新自定义提示项。
function updateIdeaSuggest({ force = false } = {}) {
  const context = getCursorContext();
  if (!context) {
    hideIdeaSuggest();
    return;
  }

  if (!force && !shouldKeepSuggestOpen(context)) {
    hideIdeaSuggest();
    return;
  }

  const items = queryCSuggestions({
    prefix: context.prefix,
    linePrefix: context.linePrefix,
    lineSuffix: context.lineSuffix,
    includeAll: force,
    source: modelInstance?.getValue() ?? "",
    cursorLineNumber: context.position.lineNumber
  }).slice(0, 14);

  if (!items.length) {
    hideIdeaSuggest();
    return;
  }

  const selectedItem = ideaSuggest.items[ideaSuggest.selectedIndex];
  const selectedIndex = items.findIndex(
    (item) => item.id === selectedItem?.id || item.label === selectedItem?.label
  );

  ideaSuggest.visible = true;
  ideaSuggest.items = items;
  ideaSuggest.selectedIndex = selectedIndex >= 0 ? selectedIndex : 0;
  ideaSuggest.range = context.range;
  ideaSuggest.query = context.prefix;
  syncIdeaSuggestViewport(context.position);
}

// 在提示列表中移动当前选中项。
function moveIdeaSuggestSelection(offset) {
  if (!ideaSuggest.visible || !ideaSuggest.items.length) {
    return;
  }

  const total = ideaSuggest.items.length;
  ideaSuggest.selectedIndex = (ideaSuggest.selectedIndex + offset + total) % total;
  nextTick(scrollActiveSuggestionIntoView);
}

// 根据源码偏移量重新定位编辑器光标。
function setEditorCursorByOffset(offset) {
  if (!modelInstance || !editorInstance) {
    return;
  }

  const position = modelInstance.getPositionAt(offset);
  editorInstance.setPosition(position);
  editorInstance.focus();
}

// 把当前选中的提示项应用到编辑器中。
function applyIdeaSuggestion(item = ideaSuggest.items[ideaSuggest.selectedIndex]) {
  if (!item || !editorInstance || !modelInstance || !ideaSuggest.range) {
    return;
  }

  const startOffset = modelInstance.getOffsetAt({
    lineNumber: ideaSuggest.range.startLineNumber,
    column: ideaSuggest.range.startColumn
  });

  editorInstance.executeEdits("codex", [
    {
      range: ideaSuggest.range,
      text: item.insertTextValue,
      forceMoveMarkers: true
    }
  ]);

  setEditorCursorByOffset(startOffset + item.cursorOffset);
  hideIdeaSuggest();
}

// 延时触发参数提示面板。
function scheduleParameterHints() {
  clearSuggestTriggerTimer();
  suggestTriggerTimer = window.setTimeout(() => {
    editorInstance?.trigger("codex", "editor.action.triggerParameterHints", {});
  }, 0);
}

// 生成带高亮信息的提示标签片段。
function getSuggestionLabelParts(item) {
  const label = item?.label ?? "";
  const query = ideaSuggest.query.trim();

  if (!label || !query) {
    return [{ text: label, highlight: false }];
  }

  const matchIndex = label.toLowerCase().indexOf(query.toLowerCase());
  if (matchIndex < 0) {
    return [{ text: label, highlight: false }];
  }

  return [
    { text: label.slice(0, matchIndex), highlight: false },
    { text: label.slice(matchIndex, matchIndex + query.length), highlight: true },
    { text: label.slice(matchIndex + query.length), highlight: false }
  ].filter((part) => part.text);
}

// 注册提示面板相关的快捷键行为。
function registerIdeaSuggestShortcuts() {
  editorInstance.addCommand(
    monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.Space,
    () => {
      updateIdeaSuggest({ force: true });
    }
  );

  editorInstance.onKeyDown((event) => {
    if (!ideaSuggest.visible) {
      return;
    }

    if (event.keyCode === monacoInstance.KeyCode.DownArrow) {
      event.preventDefault();
      event.stopPropagation();
      moveIdeaSuggestSelection(1);
      return;
    }

    if (event.keyCode === monacoInstance.KeyCode.UpArrow) {
      event.preventDefault();
      event.stopPropagation();
      moveIdeaSuggestSelection(-1);
      return;
    }

    if (
      event.keyCode === monacoInstance.KeyCode.Enter ||
      event.keyCode === monacoInstance.KeyCode.Tab
    ) {
      event.preventDefault();
      event.stopPropagation();
      applyIdeaSuggestion();
      return;
    }

    if (event.keyCode === monacoInstance.KeyCode.Escape) {
      event.preventDefault();
      event.stopPropagation();
      hideIdeaSuggest();
    }
  });
}

// 处理编辑器内容变化后的联动逻辑。
function handleEditorContentChange(event) {
  if (!editorInstance?.hasTextFocus()) {
    return;
  }

  const change = event.changes[event.changes.length - 1];
  const insertedText = change?.text ?? "";
  const lastChar = insertedText.slice(-1);
  const context = getCursorContext();

  if (!insertedText) {
    if (shouldKeepSuggestOpen(context)) {
      updateIdeaSuggest({ force: !context?.prefix });
    } else {
      hideIdeaSuggest();
    }
    return;
  }

  if (lastChar === "(" || lastChar === ",") {
    updateIdeaSuggest({ force: true });
    scheduleParameterHints();
    return;
  }

  if (/[A-Za-z0-9_#<"]/.test(lastChar) || isContextSuggestionPosition(context?.linePrefix)) {
    updateIdeaSuggest();
    return;
  }

  if (/[\s;)}\]]/.test(lastChar)) {
    hideIdeaSuggest();
  }
}

// 初始化 Monaco 编辑器和相关事件绑定。
async function setupEditor() {
  monacoInstance = await loadMonaco();
  modelInstance = monacoInstance.editor.createModel(props.modelValue, props.language);

  editorInstance = monacoInstance.editor.create(editorMountRef.value, {
    model: modelInstance,
    theme: "vs",
    automaticLayout: true,
    glyphMargin: true,
    hover: {
      enabled: true,
      delay: 180,
      sticky: true
    },
    renderValidationDecorations: "on",
    minimap: { enabled: false },
    quickSuggestions: false,
    suggestOnTriggerCharacters: false,
    parameterHints: {
      enabled: true
    },
    snippetSuggestions: "top",
    tabCompletion: "on",
    fontSize: 14,
    lineHeight: 24,
    padding: { top: 16, bottom: 16 },
    roundedSelection: false,
    scrollBeyondLastLine: false,
    wordWrap: "off",
    tabSize: 2
  });

  lineCount.value = modelInstance.getLineCount();

  modelInstance.onDidChangeContent((event) => {
    lineCount.value = modelInstance.getLineCount();
    if (suppressModelEvent) {
      return;
    }

    emit("update:modelValue", modelInstance.getValue());
    handleEditorContentChange(event);
  });

  editorInstance.onMouseDown((event) => {
    if (event.target.type !== monacoInstance.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
      return;
    }

    const line = event.target.position?.lineNumber;
    if (line) {
      emit("toggle-breakpoint", line);
    }
  });

  editorInstance.onMouseMove((event) => {
    handleEditorMouseMove(event);
  });

  editorInstance.onMouseLeave(() => {
    hideHoverCard();
  });

  editorInstance.onDidChangeCursorPosition(() => {
    if (ideaSuggest.visible) {
      updateIdeaSuggest();
    }
  });

  editorInstance.onDidScrollChange(() => {
    syncIdeaSuggestViewport();
    hideHoverCard();
  });

  editorInstance.onDidLayoutChange(() => {
    syncIdeaSuggestViewport();
    hideHoverCard();
  });

  editorInstance.onDidBlurEditorText(() => {
    window.setTimeout(() => {
      if (!editorInstance?.hasTextFocus()) {
        hideIdeaSuggest();
        hideHoverCard();
      }
    }, 120);
  });

  registerIdeaSuggestShortcuts();
  updateDecorations();
  updateMarkers();
}

watch(
  () => props.modelValue,
  (nextValue) => {
    if (!modelInstance || nextValue === modelInstance.getValue()) {
      return;
    }

    suppressModelEvent = true;
    modelInstance.setValue(nextValue);
    suppressModelEvent = false;
    lineCount.value = modelInstance.getLineCount();
    updateDecorations();
    updateMarkers();
  }
);

watch(
  () => props.language,
  (nextLanguage) => {
    if (modelInstance && monacoInstance) {
      monacoInstance.editor.setModelLanguage(modelInstance, nextLanguage);
    }
  }
);

watch(
  () => [props.breakpoints, props.errors],
  () => {
    updateDecorations();
    updateMarkers();
  },
  { deep: true }
);

watch(
  () => props.currentLine,
  (nextLine, previousLine) => {
    updateDecorations();
    if (editorInstance && nextLine && nextLine !== previousLine) {
      editorInstance.revealLineInCenter(nextLine);
    }
  }
);

watch(
  () => ideaSuggest.selectedIndex,
  () => {
    nextTick(scrollActiveSuggestionIntoView);
  }
);

onMounted(() => {
  setupEditor();
});

onBeforeUnmount(() => {
  clearSuggestTriggerTimer();
  hideIdeaSuggest();
  hideHoverCard();

  if (editorInstance) {
    editorInstance.dispose();
  }
  if (modelInstance) {
    monacoInstance?.editor.setModelMarkers(modelInstance, "codex-diagnostics", []);
    modelInstance.dispose();
  }
});
</script>

<template>
  <section class="panel editor-panel">
    <header class="panel-header editor-panel-header">
      <div class="editor-header-copy">
        <h2>{{ title }}</h2>
        <p>带断点、错误下划线、智能提示和参数提示的编辑器</p>
      </div>
      <div class="editor-header-meta">
        <slot name="header-actions" />
        <span class="badge">{{ lineCount || lines }} 行</span>
      </div>
    </header>

    <div ref="editorShellRef" class="editor-shell monaco-host">
      <div ref="editorMountRef" class="monaco-editor-mount"></div>

      <div
        v-if="ideaSuggest.visible"
        ref="suggestWidgetRef"
        class="idea-suggest-widget"
        :style="{
          top: `${ideaSuggest.top}px`,
          left: `${ideaSuggest.left}px`
        }"
      >
        <div class="idea-suggest-pane">
          <div class="idea-suggest-header">
            <strong>智能提示</strong>
            <span>{{ ideaSuggest.items.length }} 项</span>
          </div>

          <div ref="suggestListRef" class="idea-suggest-list">
            <button
              v-for="(item, index) in ideaSuggest.items"
              :key="item.id"
              class="idea-suggest-item"
              :class="{ active: index === ideaSuggest.selectedIndex }"
              :data-active="index === ideaSuggest.selectedIndex ? 'true' : null"
              type="button"
              @mouseenter="ideaSuggest.selectedIndex = index"
              @mousedown.prevent="applyIdeaSuggestion(item)"
            >
              <span class="idea-suggest-badges">
                <span class="idea-suggest-kind">{{ item.kindLabel }}</span>
                <span v-if="item.origin" class="idea-suggest-origin">{{ item.origin }}</span>
              </span>

              <span class="idea-suggest-main">
                <strong class="idea-suggest-label">
                  <template
                    v-for="(part, partIndex) in getSuggestionLabelParts(item)"
                    :key="`${item.id}-${partIndex}`"
                  >
                    <mark v-if="part.highlight">{{ part.text }}</mark>
                    <span v-else>{{ part.text }}</span>
                  </template>
                </strong>
                <small>{{ item.detail }}</small>
              </span>
            </button>
          </div>
        </div>

        <div class="idea-suggest-doc">
          <div class="idea-suggest-doc-title">
            <strong>{{ selectedSuggestion?.label }}</strong>
            <span>{{ selectedSuggestion?.origin }}</span>
          </div>

          <code
            v-if="selectedSuggestion?.signature || selectedSuggestion?.detail"
            class="idea-suggest-signature"
          >
            {{ selectedSuggestion?.signature || selectedSuggestion?.detail }}
          </code>

          <p
            v-if="
              selectedSuggestion?.detail &&
              selectedSuggestion?.signature &&
              selectedSuggestion.signature !== selectedSuggestion.detail
            "
          >
            {{ selectedSuggestion.detail }}
          </p>

          <p v-if="selectedSuggestion?.documentation">
            {{ selectedSuggestion.documentation }}
          </p>

          <small class="idea-suggest-tip">
            Enter 或 Tab 应用，Esc 关闭。
          </small>
        </div>
      </div>

      <div
        v-if="hoverCard.visible"
        ref="hoverWidgetRef"
        class="editor-hover-card"
        :style="{
          top: `${hoverCard.top}px`,
          left: `${hoverCard.left}px`
        }"
      >
        <div
          v-for="(section, index) in hoverCard.sections"
          :key="`${index}-${section.signature ?? section.title ?? ''}`"
          class="editor-hover-section"
        >
          <small v-if="section.title" class="editor-hover-title">{{ section.title }}</small>
          <code v-if="section.signature" class="editor-hover-signature">{{ section.signature }}</code>
          <p v-if="section.documentation" class="editor-hover-doc">{{ section.documentation }}</p>
        </div>
      </div>
    </div>
  </section>
</template>
