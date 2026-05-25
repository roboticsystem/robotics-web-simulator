<script setup>
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import AICodeAssistantPanel from "./components/AICodeAssistantPanel.vue";
import BrowserStoragePanel from "./components/BrowserStoragePanel.vue";
import CCommandReference from "./components/CCommandReferenceClean.vue";
import CodeEditor from "./components/CodeEditor.vue";
import DebuggerPanel from "./components/DebuggerPanel.vue";
import SimulatorPanel from "./components/SimulatorPanel.vue";
import LogPanelZh from "./sensorFrontend/components/LogPanelZh.vue";
import RobotWorldLayout from "./robotWorld/components/layout/AppLayout.vue";
import {
  generateSavedFileId,
  normalizeFileName,
  readSavedFiles,
  readWorkspace,
  upsertSavedFile,
  writeSavedFiles,
  writeWorkspace
} from "./core/browserCodeStorage";
import { validateCSource } from "./core/cSyntaxDiagnostics";
import { generateRobotCode } from "./core/ollamaClient";
import { PicoCAdapter } from "./core/picocAdapter";
import { RobotBridge } from "./core/simulatorBridge";

const DEBUGGER_POPOVER_STORAGE_KEY = "robot-script-studio-debugger-popover-pos-v1";
const DEBUGGER_POPOVER_SIZE_STORAGE_KEY = "robot-script-studio-debugger-popover-size-v1";
const DEFAULT_C = `#include <stdio.h>

int main() {
    printf("PicoC robot demo start\\n");
    robot_reset();
    robot_move_forward(80, 40);
    robot_turn_right(90, 120);
    robot_move_forward(60, 36);
    printf("distance=%d\\n", robot_read_distance());
    printf("temperature=%.1f\\n", robot_read_temperature());
    robot_say("C demo finished");
    robot_stop();
    return 0;
}`;

const DEFAULT_BROWSER_FILE_NAME = "未命名程序.c";
const AUTOSAVE_DELAY_MS = 700;
const DEFAULT_AI_PROVIDER = "ollama";
const DEFAULT_OLLAMA_MODEL = "deepseek-coder:6.7b";
const DEFAULT_OPENAI_MODEL = "gpt-5.4";

// 根据当前运行环境返回默认的 Ollama 接口地址。
function getDefaultOllamaEndpoint() {
  if (typeof window !== "undefined" && window.location.port === "5173") {
    return "/api/ollama/chat";
  }

  return "http://127.0.0.1:11434/api/chat";
}

// 返回默认的 OpenAI 兼容接口地址。
function getDefaultOpenAiEndpoint() {
  return "http://new.xem8k5.top:3000/v1/chat/completions";
}

const activeView = ref("studio");
const cCode = ref(DEFAULT_C);
const currentFileId = ref(null);
const currentFileName = ref(DEFAULT_BROWSER_FILE_NAME);
const simulatorRef = ref(null);
const debuggerPopoverRef = ref(null);
const logEntries = ref([]);
const picocErrors = ref([]);
const staticSyntaxErrors = ref([]);
const picocStatus = ref("未加载");
const debugStatus = ref("未启用");
const autosaveStatus = ref("当前草稿会自动保存到浏览器");
const isRunningC = ref(false);
const isDebugSession = ref(false);
const isDebugPaused = ref(false);
const showDebuggerPopover = ref(false);
const debuggerPopoverPosition = ref({ top: 56, left: 240 });
const debuggerPopoverSize = ref({ width: 920, height: 620 });
const debuggerPopoverZIndex = ref(2000);
const currentTraceLine = ref(null);
const traceEntries = ref([]);
const watchedVariables = ref([]);
const breakpoints = ref([]);
const savedBrowserFiles = ref([]);
const aiPanelExpanded = ref(false);
const aiPrompt = ref("");
const aiGeneratedCode = ref("");
const aiStatus = ref("等待生成");
const aiError = ref("");
const aiWarning = ref("");
const isGeneratingAi = ref(false);
const aiProvider = ref(DEFAULT_AI_PROVIDER);
const aiModelName = ref(DEFAULT_OLLAMA_MODEL);
const aiEndpoint = ref(getDefaultOllamaEndpoint());
const aiApiKey = ref("");
const editorErrors = computed(() =>
  mergeEditorErrors(staticSyntaxErrors.value, picocErrors.value)
);
const simulatorLogs = computed(() => simulatorRef.value?.logs ?? []);

let pendingTraceSnapshot = null;
let traceStepCounter = 0;
let pendingDebugControl = null;
let debugResumeMode = "continue";
let autosaveTimer = 0;
let syntaxValidationTimer = 0;
let storageReady = false;
let debuggerDragState = null;
let debuggerResizeState = null;

const DEBUG_ABORT_CODE = 130;
const EXECUTION_ABORT_MESSAGES = new Set([
  "仿真已重置，当前运行已停止。",
  "机器人检测到障碍物，已在碰撞前停止。",
  "当前运行已停止。"
]);

const bridge = new RobotBridge({
  getController: () => simulatorRef.value,
  onLog: (message) => addLog(message)
});

const picoc = shallowRef(
  new PicoCAdapter({
    onStdout: (text) => {
      addLog(`[PicoC] ${text}`);
      addPicocErrorFromText(text);
    },
    onStderr: (text) => {
      addLog(`[PicoC 错误] ${text}`);
      addPicocErrorFromText(text);
    }
  })
);

// 读取指定行号的源码文本。
function getSourceLine(lineNumber) {
  const lines = cCode.value.split(/\r?\n/);
  return lines[lineNumber - 1]?.trim() ?? "";
}

// 规范化 PicoC 返回的错误消息文本。
function normalizePicocErrorMessage(message) {
  return message.replace(/^error:\s*/i, "").trim();
}

// 从 PicoC 输出中提取可定位的语法错误。
function addPicocErrorFromText(text) {
  const lines = String(text).split(/\r?\n/);

  lines.forEach((lineText) => {
    const line = lineText.trim();
    if (!line) {
      return;
    }

    const match = line.match(/^web_input\.c:(\d+):(\d+)\s+(.*)$/);
    if (!match) {
      return;
    }

    const [, row, column, message] = match;
    const error = {
      line: Number(row),
      column: Number(column),
      endLine: Number(row),
      endColumn: Number(column) + 1,
      message: normalizePicocErrorMessage(message),
      suggestion: "请检查这一行附近的分号、括号、变量声明或函数调用写法。",
      type: "syntax",
      source: "picoc",
      severity: "error"
    };

    const exists = picocErrors.value.some(
      (item) =>
        item.line === error.line &&
        item.column === error.column &&
        item.message === error.message
    );

    if (!exists) {
      picocErrors.value = [...picocErrors.value, error];
    }
  });
}

// 合并静态检查和运行期错误列表。
function mergeEditorErrors(...collections) {
  const merged = new Map();

  collections.flat().forEach((error) => {
    if (!error) {
      return;
    }

    const key = [
      error.line ?? 1,
      error.column ?? 1,
      error.endLine ?? error.line ?? 1,
      error.endColumn ?? (error.column ?? 1) + 1,
      error.message ?? "",
      error.type ?? "syntax",
      error.source ?? "editor"
    ].join(":");

    if (!merged.has(key)) {
      merged.set(key, {
        severity: "error",
        source: "editor",
        ...error
      });
    }
  });

  return [...merged.values()].sort((left, right) => {
    if (left.line !== right.line) {
      return left.line - right.line;
    }

    if (left.column !== right.column) {
      return left.column - right.column;
    }

    if (left.severity !== right.severity) {
      return left.severity === "error" ? -1 : 1;
    }

    return left.message.localeCompare(right.message);
  });
}

// 向调试日志区追加一条日志。
function addLog(message) {
  logEntries.value = [
    {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      message
    },
    ...logEntries.value
  ].slice(0, 120);
}

// 按名称查找浏览器目录中的已保存代码文件。
function findSavedBrowserFileByName(name, excludeId = null) {
  const normalizedTargetName = normalizeFileName(name, DEFAULT_BROWSER_FILE_NAME).toLocaleLowerCase();

  return (
    savedBrowserFiles.value.find((item) => {
      if (excludeId && item.id === excludeId) {
        return false;
      }

      return (
        normalizeFileName(item.name, DEFAULT_BROWSER_FILE_NAME).toLocaleLowerCase() ===
        normalizedTargetName
      );
    }) ?? null
  );
}

// 根据当前状态生成工作区快照，确保草稿和已保存文件引用一致。
function createWorkspacePayload({
  currentFileId: nextFileId = currentFileId.value,
  currentFileName: nextFileName = currentFileName.value,
  code: nextCode = cCode.value,
  breakpoints: nextBreakpoints = breakpoints.value,
  updatedAt = new Date().toISOString()
} = {}) {
  const normalizedFileId = nextFileId ? String(nextFileId) : null;
  const linkedFileExists = normalizedFileId
    ? savedBrowserFiles.value.some((item) => item.id === normalizedFileId)
    : false;

  return {
    currentFileId: linkedFileExists ? normalizedFileId : null,
    currentFileName: normalizeFileName(
      nextFileName,
      DEFAULT_BROWSER_FILE_NAME
    ),
    code: String(nextCode ?? ""),
    breakpoints: [...(nextBreakpoints ?? [])],
    updatedAt
  };
}

function areBreakpointListsEqual(left = [], right = []) {
  if (left === right) {
    return true;
  }

  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function applyWorkspacePayloadToState(workspacePayload) {
  if (currentFileId.value !== workspacePayload.currentFileId) {
    currentFileId.value = workspacePayload.currentFileId;
  }

  if (currentFileName.value !== workspacePayload.currentFileName) {
    currentFileName.value = workspacePayload.currentFileName;
  }

  if (cCode.value !== workspacePayload.code) {
    cCode.value = workspacePayload.code;
  }

  if (!areBreakpointListsEqual(breakpoints.value, workspacePayload.breakpoints)) {
    breakpoints.value = [...workspacePayload.breakpoints];
  }
}

// 立即把当前编辑器状态同步到工作区草稿。
function flushWorkspaceState({
  currentFileId: nextFileId,
  currentFileName: nextFileName,
  code: nextCode,
  breakpoints: nextBreakpoints,
  updatedAt
} = {}) {
  if (!storageReady) {
    return false;
  }

  const workspacePayload = createWorkspacePayload({
    currentFileId: nextFileId,
    currentFileName: nextFileName,
    code: nextCode,
    breakpoints: nextBreakpoints,
    updatedAt
  });

  applyWorkspacePayloadToState(workspacePayload);
  writeWorkspace(workspacePayload);
  return true;
}

// 把时间值格式化为短时间文本。
function formatShortTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString("zh-CN", {
    hour12: false
  });
}

// 清空当前运行日志列表。
function clearLogs() {
  logEntries.value = [];
}

function downloadTextFile(content, fileName, mimeType = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

function exportSimulatorLogs(kind = "txt") {
  const rows = simulatorLogs.value.slice().reverse();
  exportSimulatorLogRows({ kind, rows });
}

function exportSimulatorLogRows({ kind = "txt", rows = [] } = {}) {
  if (!rows.length) {
    addLog("当前没有可导出的仿真日志。");
    return;
  }

  if (kind === "csv") {
    const escapeCsv = (value) => `"${String(value ?? "").replace(/"/g, "\"\"")}"`;
    const content = [
      ["时间", "级别", "消息", "传感器 ID"].join(","),
      ...rows.map((item) =>
        [
          escapeCsv(new Date(item.timestamp).toLocaleString("zh-CN", { hour12: false })),
          escapeCsv(item.payload?.level ?? ""),
          escapeCsv(item.payload?.message ?? ""),
          escapeCsv(item.payload?.sensorId ?? "")
        ].join(",")
      )
    ].join("\n");
    downloadTextFile(content, "simulator-logs.csv", "text/csv;charset=utf-8");
    addLog("已导出仿真日志 CSV。");
    return;
  }

  const content = rows
    .map(
      (item) =>
        `${new Date(item.timestamp).toLocaleString("zh-CN", { hour12: false })}\t${
          item.payload?.level ?? ""
        }\t${item.payload?.message ?? ""}\t${item.payload?.sensorId ?? ""}`
    )
    .join("\n");

  downloadTextFile(content, "simulator-logs.txt");
  addLog("已导出仿真日志 TXT。");
}

// 判断异常是否属于主动中止执行。
function isExecutionAbortError(error) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return EXECUTION_ABORT_MESSAGES.has(message);
}

// 重置断点调试的跟踪状态。
function resetDebugState() {
  currentTraceLine.value = null;
  traceEntries.value = [];
  watchedVariables.value = [];
  pendingTraceSnapshot = null;
  traceStepCounter = 0;
}

// 清空调试继续控制相关状态。
function clearDebugControlState() {
  isDebugSession.value = false;
  isDebugPaused.value = false;
  pendingDebugControl = null;
  debugResumeMode = "continue";
}

function resetEditorExecutionState() {
  picocErrors.value = [];
  resetDebugState();
  clearDebugControlState();
}

function resetEditorTransientState({ preserveAi = false } = {}) {
  resetEditorExecutionState();
  if (!preserveAi) {
    clearAiGeneratedCode();
  }
}

function loadWorkspaceIntoEditor(
  workspacePayload,
  { resetTransientState = true, preserveAi = false, syncWorkspace = true } = {}
) {
  if (resetTransientState) {
    resetEditorTransientState({ preserveAi });
  }

  applyWorkspacePayloadToState(workspacePayload);

  if (syncWorkspace) {
    flushWorkspaceState(workspacePayload);
  }
}

function setAiGenerationState({ generatedCode = "", error = "", warning = "", status = "等待生成" }) {
  aiGeneratedCode.value = generatedCode;
  aiError.value = error;
  aiWarning.value = warning;
  aiStatus.value = status;
}

// 切换指定行的断点状态。
function toggleBreakpoint(line) {
  if (!line || line < 1) {
    return;
  }

  if (breakpoints.value.includes(line)) {
    breakpoints.value = breakpoints.value.filter((item) => item !== line);
    return;
  }

  breakpoints.value = [...breakpoints.value, line].sort((left, right) => left - right);
}

// 清空全部断点。
function clearBreakpoints() {
  breakpoints.value = [];
}

// 清除代码工作区自动保存定时器。
function clearAutosaveTimer() {
  if (autosaveTimer) {
    window.clearTimeout(autosaveTimer);
    autosaveTimer = 0;
  }
}

// 清除语法检查延时定时器。
function clearSyntaxValidationTimer() {
  if (syntaxValidationTimer) {
    window.clearTimeout(syntaxValidationTimer);
    syntaxValidationTimer = 0;
  }
}

// 立即执行一次静态语法检查。
function runSyntaxValidation() {
  staticSyntaxErrors.value = validateCSource(cCode.value);
}

// 延时调度静态语法检查。
function scheduleSyntaxValidation() {
  clearSyntaxValidationTimer();
  syntaxValidationTimer = window.setTimeout(() => {
    runSyntaxValidation();
  }, 160);
}

// 立即把当前工作区写入浏览器存储。
function persistWorkspaceNow({ updateStatus = true, logError = true } = {}) {
  if (!storageReady) {
    return false;
  }

  try {
    const timestamp = new Date().toISOString();
    const normalizedName = normalizeFileName(currentFileName.value, DEFAULT_BROWSER_FILE_NAME);
    currentFileName.value = normalizedName;

    let syncedDirectory = false;
    let hasNameConflict = false;
    if (currentFileId.value) {
      const existing = savedBrowserFiles.value.find(
        (item) => item.id === currentFileId.value
      );
      const conflictingFile = findSavedBrowserFileByName(normalizedName, currentFileId.value);

      if (existing && !conflictingFile) {
        savedBrowserFiles.value = writeSavedFiles(
          upsertSavedFile(savedBrowserFiles.value, {
            ...existing,
            id: currentFileId.value,
            name: normalizedName,
            code: cCode.value,
            breakpoints: breakpoints.value,
            createdAt: existing.createdAt,
            updatedAt: timestamp
          })
        );
        syncedDirectory = true;
      }

      if (existing && conflictingFile && updateStatus) {
        hasNameConflict = true;
        autosaveStatus.value = `草稿已自动保存，但文件名与浏览器目录中的 ${conflictingFile.name} 重名，请改名或手动确认覆盖。`;
      }
    }

    flushWorkspaceState({ updatedAt: timestamp });

    if (updateStatus && !hasNameConflict) {
      autosaveStatus.value = syncedDirectory
        ? `已自动保存到浏览器 ${formatShortTime(timestamp)}`
        : `草稿已自动保存 ${formatShortTime(timestamp)}`;
    }

    return true;
  } catch (error) {
    if (updateStatus) {
      autosaveStatus.value = `保存失败：${error.message}`;
    }

    if (logError) {
      addLog(error.message);
    }

    return false;
  }
}

// 调度一次延时自动保存。
function scheduleAutosave() {
  if (!storageReady) {
    return;
  }

  clearAutosaveTimer();
  autosaveStatus.value = currentFileId.value
    ? "正在自动保存到浏览器..."
    : "正在自动保存草稿...";
  autosaveTimer = window.setTimeout(() => {
    persistWorkspaceNow();
  }, AUTOSAVE_DELAY_MS);
}

// 从浏览器存储恢复上次的工作区状态。
function restoreBrowserWorkspace() {
  try {
    savedBrowserFiles.value = readSavedFiles();
    const workspace = readWorkspace();

    if (!workspace) {
      autosaveStatus.value = "当前草稿会自动保存到浏览器";
      return true;
    }
    const restoredWorkspace = createWorkspacePayload(workspace);
    applyWorkspacePayloadToState({
      ...restoredWorkspace,
      code: restoredWorkspace.code || DEFAULT_C
    });
    writeWorkspace({
      ...restoredWorkspace,
      code: restoredWorkspace.code || DEFAULT_C
    });

    autosaveStatus.value = workspace.updatedAt
      ? `已恢复草稿 ${formatShortTime(workspace.updatedAt)}`
      : "已恢复草稿";
    addLog("已从浏览器恢复上次编辑的代码。");
    return true;
  } catch (error) {
    autosaveStatus.value = `浏览器存储不可用：${error.message}`;
    addLog(error.message);
    return false;
  }
}

// 创建一个新的临时代码草稿。
function createNewDraft() {
  clearAutosaveTimer();
  const timestamp = new Date().toISOString();
  loadWorkspaceIntoEditor(
    {
      currentFileId: null,
      currentFileName: DEFAULT_BROWSER_FILE_NAME,
      code: DEFAULT_C,
      breakpoints: [],
      updatedAt: timestamp
    },
    { preserveAi: false, syncWorkspace: true }
  );
  autosaveStatus.value = "新的临时草稿已创建";
  addLog("已创建新的临时草稿。");
}

// 把当前代码手动保存到浏览器目录。
function saveCurrentCodeToBrowser() {
  try {
    clearAutosaveTimer();
    const timestamp = new Date().toISOString();
    const normalizedName = normalizeFileName(
      currentFileName.value,
      DEFAULT_BROWSER_FILE_NAME
    );
    const linkedFile =
      savedBrowserFiles.value.find((item) => item.id === currentFileId.value) ?? null;
    const sameNameFile = findSavedBrowserFileByName(normalizedName, currentFileId.value);

    let targetFile = linkedFile;
    let overwroteByName = false;

    if (sameNameFile) {
      const shouldOverwrite = window.confirm(
        `浏览器目录中已存在名为 ${sameNameFile.name} 的代码文件。是否用当前内容覆盖它？`
      );
      if (!shouldOverwrite) {
        autosaveStatus.value = "已取消保存，请修改文件名后重试。";
        addLog("已取消覆盖同名代码文件。");
        return;
      }

      targetFile = sameNameFile;
      overwroteByName = true;
    }

    const nextId = targetFile?.id ?? currentFileId.value ?? generateSavedFileId();

    savedBrowserFiles.value = writeSavedFiles(
      upsertSavedFile(savedBrowserFiles.value, {
        id: nextId,
        name: normalizedName,
        code: cCode.value,
        breakpoints: breakpoints.value,
        createdAt: targetFile?.createdAt ?? linkedFile?.createdAt ?? timestamp,
        updatedAt: timestamp
      })
    );

    currentFileId.value = nextId;
    currentFileName.value = normalizedName;
    flushWorkspaceState({
      currentFileId: nextId,
      currentFileName: normalizedName,
      code: cCode.value,
      breakpoints: breakpoints.value,
      updatedAt: timestamp
    });
    autosaveStatus.value = `已保存到浏览器 ${formatShortTime(timestamp)}`;
    addLog(
      overwroteByName
        ? `已覆盖浏览器目录中的同名代码 ${normalizedName}。`
        : `已保存 ${normalizedName} 到浏览器目录。`
    );
  } catch (error) {
    autosaveStatus.value = `保存失败：${error.message}`;
    addLog(error.message);
  }
}

// 从本地文件导入代码到编辑器。
async function importLocalCode(file) {
  try {
    clearAutosaveTimer();
    const text = await file.text();
    const timestamp = new Date().toISOString();
    loadWorkspaceIntoEditor(
      {
        currentFileId: null,
        currentFileName: normalizeFileName(file.name, DEFAULT_BROWSER_FILE_NAME),
        code: text,
        breakpoints: [],
        updatedAt: timestamp
      },
      { preserveAi: false, syncWorkspace: true }
    );
    autosaveStatus.value = `已导入 ${file.name}`;
    addLog(`已从本地导入 ${file.name}。`);
  } catch (error) {
    autosaveStatus.value = `导入失败：${error.message}`;
    addLog(error.message);
  }
}

// 下载当前编辑器中的代码文件。
function downloadCurrentCode() {
  const fileName = normalizeFileName(currentFileName.value, DEFAULT_BROWSER_FILE_NAME);
  const blob = new Blob([cCode.value], { type: "text/plain;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
  addLog(`已下载当前代码为 ${fileName}。`);
}

// 打开浏览器目录中的指定代码文件。
function openBrowserFile(fileId) {
  clearAutosaveTimer();
  const target = savedBrowserFiles.value.find((item) => item.id === fileId);
  if (!target) {
    return;
  }
  loadWorkspaceIntoEditor(
    {
      currentFileId: target.id,
      currentFileName: target.name,
      code: target.code,
      breakpoints: target.breakpoints,
      updatedAt: target.updatedAt
    },
    { preserveAi: false, syncWorkspace: true }
  );
  autosaveStatus.value = `已打开 ${target.name}`;
  addLog(`已从浏览器目录打开 ${target.name}。`);
}

// 删除浏览器目录中的指定代码文件。
function deleteBrowserFile(fileId) {
  const target = savedBrowserFiles.value.find((item) => item.id === fileId);
  if (!target) {
    return;
  }

  const shouldDelete = window.confirm(`确定删除浏览器目录中的 ${target.name} 吗？`);
  if (!shouldDelete) {
    return;
  }

  try {
    clearAutosaveTimer();
    const timestamp = new Date().toISOString();
    savedBrowserFiles.value = writeSavedFiles(
      savedBrowserFiles.value.filter((item) => item.id !== fileId)
    );

    if (currentFileId.value === fileId) {
      currentFileId.value = null;
      flushWorkspaceState({
        currentFileId: null,
        currentFileName: currentFileName.value,
        code: cCode.value,
        breakpoints: breakpoints.value,
        updatedAt: timestamp
      });
      autosaveStatus.value = "已删除目录文件，当前编辑器内容已转为临时草稿";
    } else {
      autosaveStatus.value = `已删除 ${target.name}`;
    }

    addLog(`已从浏览器目录删除 ${target.name}。`);
  } catch (error) {
    autosaveStatus.value = `删除失败：${error.message}`;
    addLog(error.message);
  }
}

// 清空当前 AI 生成结果和提示状态。
function clearAiGeneratedCode() {
  setAiGenerationState({});
}

// 按提供商同步默认模型和接口地址。
function syncAiProviderDefaults(provider) {
  if (provider === "openai") {
    if (!aiModelName.value.trim() || aiModelName.value === DEFAULT_OLLAMA_MODEL) {
      aiModelName.value = DEFAULT_OPENAI_MODEL;
    }

    if (!aiEndpoint.value.trim() || aiEndpoint.value === getDefaultOllamaEndpoint()) {
      aiEndpoint.value = getDefaultOpenAiEndpoint();
    }
    return;
  }

  if (!aiModelName.value.trim() || aiModelName.value === DEFAULT_OPENAI_MODEL) {
    aiModelName.value = DEFAULT_OLLAMA_MODEL;
  }

  if (!aiEndpoint.value.trim() || aiEndpoint.value === getDefaultOpenAiEndpoint()) {
    aiEndpoint.value = getDefaultOllamaEndpoint();
  }
}

// 切换 AI 面板展开状态。
function toggleAiPanel() {
  aiPanelExpanded.value = !aiPanelExpanded.value;
}

function clampDebuggerPopoverSize(nextSize = debuggerPopoverSize.value) {
  const width = typeof window !== "undefined" ? window.innerWidth : 1440;
  const height = typeof window !== "undefined" ? window.innerHeight : 900;

  return {
    width: Math.min(Math.max(Number(nextSize.width) || 920, 520), Math.max(520, width - 24)),
    height: Math.min(Math.max(Number(nextSize.height) || 620, 360), Math.max(360, height - 24))
  };
}

function clampDebuggerPopoverPosition(nextPosition = debuggerPopoverPosition.value) {
  const width = typeof window !== "undefined" ? window.innerWidth : 1440;
  const height = typeof window !== "undefined" ? window.innerHeight : 900;
  const panelSize = clampDebuggerPopoverSize(debuggerPopoverSize.value);
  const panelWidth = panelSize.width;
  const panelHeight = panelSize.height;
  const minLeft = 12;
  const minTop = 12;
  const maxLeft = Math.max(minLeft, width - panelWidth - 12);
  const maxTop = Math.max(minTop, height - panelHeight - 12);

  return {
    left: Math.min(Math.max(nextPosition.left ?? minLeft, minLeft), maxLeft),
    top: Math.min(Math.max(nextPosition.top ?? minTop, minTop), maxTop)
  };
}

function persistDebuggerPopoverPosition() {
  if (typeof window === "undefined") {
    return;
  }

  const safePosition = clampDebuggerPopoverPosition(debuggerPopoverPosition.value);
  debuggerPopoverPosition.value = safePosition;
  window.localStorage.setItem(DEBUGGER_POPOVER_STORAGE_KEY, JSON.stringify(safePosition));
}

function persistDebuggerPopoverSize() {
  if (typeof window === "undefined") {
    return;
  }

  const safeSize = clampDebuggerPopoverSize(debuggerPopoverSize.value);
  debuggerPopoverSize.value = safeSize;
  window.localStorage.setItem(DEBUGGER_POPOVER_SIZE_STORAGE_KEY, JSON.stringify(safeSize));
}

function restoreDebuggerPopoverPosition() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const raw = window.localStorage.getItem(DEBUGGER_POPOVER_STORAGE_KEY);
    if (!raw) {
      debuggerPopoverPosition.value = clampDebuggerPopoverPosition(debuggerPopoverPosition.value);
      return;
    }

    const parsed = JSON.parse(raw);
    debuggerPopoverPosition.value = clampDebuggerPopoverPosition({
      left: Number(parsed?.left),
      top: Number(parsed?.top)
    });
  } catch {
    debuggerPopoverPosition.value = clampDebuggerPopoverPosition(debuggerPopoverPosition.value);
  }
}

function restoreDebuggerPopoverSize() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const raw = window.localStorage.getItem(DEBUGGER_POPOVER_SIZE_STORAGE_KEY);
    if (!raw) {
      debuggerPopoverSize.value = clampDebuggerPopoverSize(debuggerPopoverSize.value);
      return;
    }

    const parsed = JSON.parse(raw);
    debuggerPopoverSize.value = clampDebuggerPopoverSize({
      width: Number(parsed?.width),
      height: Number(parsed?.height)
    });
  } catch {
    debuggerPopoverSize.value = clampDebuggerPopoverSize(debuggerPopoverSize.value);
  }
}

function closeDebuggerPopover() {
  showDebuggerPopover.value = false;
}

function nextPopoverZIndex(base = 2000) {
  if (typeof window === "undefined") {
    return base;
  }

  const key = "__robotStudioPopoverZIndex";
  const current = Number(window[key]) || base;
  const next = current + 1;
  window[key] = next;
  return next;
}

function bringDebuggerPopoverToFront() {
  debuggerPopoverZIndex.value = nextPopoverZIndex(2000);
}

function toggleDebuggerPopover() {
  showDebuggerPopover.value = !showDebuggerPopover.value;
  if (showDebuggerPopover.value) {
    debuggerPopoverSize.value = clampDebuggerPopoverSize(debuggerPopoverSize.value);
    debuggerPopoverPosition.value = clampDebuggerPopoverPosition(debuggerPopoverPosition.value);
    bringDebuggerPopoverToFront();
  }
}

function startDebuggerPopoverDrag(event) {
  if (!showDebuggerPopover.value) {
    return;
  }

  bringDebuggerPopoverToFront();
  debuggerDragState = {
    offsetX: event.clientX - debuggerPopoverPosition.value.left,
    offsetY: event.clientY - debuggerPopoverPosition.value.top
  };
  window.addEventListener("pointermove", onDebuggerPopoverDrag);
  window.addEventListener("pointerup", stopDebuggerPopoverDrag);
}

function onDebuggerPopoverDrag(event) {
  if (!debuggerDragState) {
    return;
  }

  debuggerPopoverPosition.value = clampDebuggerPopoverPosition({
    left: event.clientX - debuggerDragState.offsetX,
    top: event.clientY - debuggerDragState.offsetY
  });
}

function stopDebuggerPopoverDrag() {
  if (!debuggerDragState) {
    return;
  }

  debuggerDragState = null;
  window.removeEventListener("pointermove", onDebuggerPopoverDrag);
  window.removeEventListener("pointerup", stopDebuggerPopoverDrag);
  persistDebuggerPopoverPosition();
}

function startDebuggerPopoverResize(event) {
  if (!showDebuggerPopover.value) {
    return;
  }

  bringDebuggerPopoverToFront();
  const panel = debuggerPopoverRef.value;
  debuggerResizeState = {
    startX: event.clientX,
    startY: event.clientY,
    startWidth: panel?.offsetWidth ?? debuggerPopoverSize.value.width,
    startHeight: panel?.offsetHeight ?? debuggerPopoverSize.value.height
  };
  window.addEventListener("pointermove", onDebuggerPopoverResize);
  window.addEventListener("pointerup", stopDebuggerPopoverResize);
}

function onDebuggerPopoverResize(event) {
  if (!debuggerResizeState) {
    return;
  }

  debuggerPopoverSize.value = clampDebuggerPopoverSize({
    width: debuggerResizeState.startWidth + (event.clientX - debuggerResizeState.startX),
    height: debuggerResizeState.startHeight + (event.clientY - debuggerResizeState.startY)
  });
  debuggerPopoverPosition.value = clampDebuggerPopoverPosition(debuggerPopoverPosition.value);
}

function stopDebuggerPopoverResize() {
  if (!debuggerResizeState) {
    return;
  }

  debuggerResizeState = null;
  window.removeEventListener("pointermove", onDebuggerPopoverResize);
  window.removeEventListener("pointerup", stopDebuggerPopoverResize);
  persistDebuggerPopoverSize();
  persistDebuggerPopoverPosition();
}

function handleWindowResize() {
  debuggerPopoverSize.value = clampDebuggerPopoverSize(debuggerPopoverSize.value);
  debuggerPopoverPosition.value = clampDebuggerPopoverPosition(debuggerPopoverPosition.value);
  if (showDebuggerPopover.value) {
    persistDebuggerPopoverSize();
    persistDebuggerPopoverPosition();
  }
}

// 调用 AI 生成新的候选代码。
async function generateAiCode() {
  if (isRunningC.value || isGeneratingAi.value) {
    return;
  }

  if (!aiPrompt.value.trim()) {
    aiError.value = "请先输入想让 AI 生成或修改的代码需求。";
    aiStatus.value = "需求为空";
    aiPanelExpanded.value = true;
    return;
  }

  isGeneratingAi.value = true;
  setAiGenerationState({
    status: aiProvider.value === "openai" ? "正在连接 GPT 接口..." : "正在连接本机 Ollama..."
  });
  aiPanelExpanded.value = true;

  try {
    const sceneContext = simulatorRef.value?.getAiSceneContext?.() ?? null;
    const result = await generateRobotCode({
      provider: aiProvider.value,
      endpoint: aiEndpoint.value.trim(),
      model:
        aiModelName.value.trim() ||
        (aiProvider.value === "openai" ? DEFAULT_OPENAI_MODEL : DEFAULT_OLLAMA_MODEL),
      apiKey: aiApiKey.value,
      requirement: aiPrompt.value,
      currentCode: cCode.value,
      errors: editorErrors.value,
      sceneContext
    });

    const reviewNotes = [];
    if (result.truncated) {
      reviewNotes.push("本次输出可能被截断");
    }
    if (result.issues?.length) {
      reviewNotes.push(...result.issues);
    }

    setAiGenerationState({
      generatedCode: result.code,
      error: "",
      warning: reviewNotes.join("；"),
      status: reviewNotes.length
        ? `生成完成，但建议人工复核（${reviewNotes.length} 项提示）`
        : `生成完成，已得到 ${result.code.split(/\r?\n/).length} 行代码`
    });
    addLog(
      `[AI] 已通过 ${
        aiProvider.value === "openai" ? "GPT 接口" : "本地 Ollama"
      } 从 ${aiModelName.value.trim() || (aiProvider.value === "openai" ? DEFAULT_OPENAI_MODEL : DEFAULT_OLLAMA_MODEL)} 生成候选代码。`
    );
  } catch (error) {
    setAiGenerationState({
      generatedCode: "",
      error: error.message,
      warning: "",
      status: "生成失败"
    });
    addLog(`[AI 错误] ${error.message}`);
  } finally {
    isGeneratingAi.value = false;
  }
}

// 将 AI 生成的代码覆盖到编辑器中。
function applyAiGeneratedCode() {
  if (!aiGeneratedCode.value.trim() || isRunningC.value) {
    return;
  }

  const shouldReplace = window.confirm("将用 AI 生成的代码覆盖当前编辑器内容，是否继续？");
  if (!shouldReplace) {
    return;
  }

  loadWorkspaceIntoEditor(
    createWorkspacePayload({
      code: aiGeneratedCode.value,
      breakpoints: [],
      updatedAt: new Date().toISOString()
    }),
    { preserveAi: true, syncWorkspace: true }
  );
  aiWarning.value = "";
  aiStatus.value = "已应用到编辑器";
  addLog("[AI] 已将生成结果应用到当前编辑器。");
}

// 解析当前挂起的调试控制请求。
function resolveDebugControl(action = 0) {
  if (!pendingDebugControl) {
    return false;
  }

  const resolve = pendingDebugControl;
  pendingDebugControl = null;
  isDebugPaused.value = false;
  resolve(action);
  return true;
}

// 主动中止当前暂停中的调试流程。
function abortPausedDebug() {
  resolveDebugControl(DEBUG_ABORT_CODE);
}

// 挂载供 PicoC 调试调用的全局调试桥接对象。
function attachDebugBridge(globalScope = window) {
  globalScope.robotDebugBridge = {
    beginSnapshot: (line) => {
      const normalizedLine = Number(line);
      traceStepCounter += 1;
      currentTraceLine.value = normalizedLine;
      pendingTraceSnapshot = {
        line: normalizedLine,
        variables: []
      };
      traceEntries.value = [
        {
          id: `${traceStepCounter}-${normalizedLine}-${Date.now()}`,
          step: traceStepCounter,
          line: normalizedLine,
          code: getSourceLine(normalizedLine)
        },
        ...traceEntries.value
      ].slice(0, 80);
    },
    pushVariable: (scope, name, type, value) => {
      if (!pendingTraceSnapshot) {
        return;
      }

      pendingTraceSnapshot.variables.push({
        id: `${scope}-${name}`,
        scope,
        name,
        type,
        value
      });
    },
    commitSnapshot: () => {
      if (!pendingTraceSnapshot) {
        return;
      }

      watchedVariables.value = [...pendingTraceSnapshot.variables].sort((left, right) => {
        if (left.scope !== right.scope) {
          return left.scope === "local" ? -1 : 1;
        }
        return left.name.localeCompare(right.name);
      });
      pendingTraceSnapshot = null;
    },
    waitForControl: async (line) => {
      if (!isDebugSession.value) {
        return 0;
      }

      const normalizedLine = Number(line);
      const hitBreakpoint = breakpoints.value.includes(normalizedLine);
      const shouldPause = debugResumeMode === "step" || hitBreakpoint;

      if (!shouldPause) {
        return 0;
      }

      isDebugPaused.value = true;
      debugStatus.value =
        debugResumeMode === "step"
          ? `单步暂停于第 ${normalizedLine} 行`
          : `命中断点，第 ${normalizedLine} 行`;

      return await new Promise((resolve) => {
        pendingDebugControl = resolve;
      });
    },
    reset: () => {
      abortPausedDebug();
      resetDebugState();
      clearDebugControlState();
    }
  };
}

// 统一执行普通运行和调试运行流程。
async function runProgram({ debug = false } = {}) {
  if (isRunningC.value) {
    return;
  }

  clearLogs();
  resetEditorExecutionState();
  picocStatus.value = debug ? "调试运行中" : "运行中";
  debugStatus.value = debug ? "等待首个可执行语句" : "未启用";
  isDebugSession.value = debug;
  debugResumeMode = debug ? "step" : "continue";
  isRunningC.value = true;
  const executionToken = bridge.beginExecution();

  try {
    bridge.attachHostBridge(window);
    const exitCode = await picoc.value.run(cCode.value, { debug });

    if (exitCode === DEBUG_ABORT_CODE) {
      picocStatus.value = "已中止";
      debugStatus.value = debug ? "已中止" : "未启用";
      return;
    }

    picocStatus.value = exitCode === 0 ? (debug ? "调试完成" : "运行完成") : "执行错误";
    debugStatus.value =
      debug ? (exitCode === 0 ? "已结束" : "调试出错") : "未启用";

    if (exitCode !== 0 && picocErrors.value.length === 0) {
      picocErrors.value = [
        {
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 2,
          message: `PicoC 运行失败，返回码 ${exitCode}`,
          suggestion: "请检查调试输出区中的 PicoC 报错信息。",
          type: "runtime",
          source: "picoc",
          severity: "error"
        }
      ];
    }
  } catch (error) {
    const aborted = isExecutionAbortError(error);

    picocStatus.value = aborted ? "已中止" : "未就绪";
    debugStatus.value = aborted ? "已中止" : debug ? "调试不可用" : "未启用";
    picocErrors.value = [
      {
        line: 1,
        column: 1,
        endLine: 1,
        endColumn: 2,
        message: error.message,
        suggestion: aborted
          ? "请调整路径、障碍物或重置仿真后重新运行。"
          : "请检查 PicoC WASM 是否已重新编译，或查看调试输出区获取更多信息。",
        type: "runtime",
        source: "picoc",
        severity: "error"
      }
    ];
    addLog(error.message);
  } finally {
    if (!debug) {
      currentTraceLine.value = null;
    }
    clearDebugControlState();
    bridge.completeExecution(executionToken);
    isRunningC.value = false;
  }
}

// 以普通模式运行当前 C 代码。
async function runC() {
  await runProgram({ debug: false });
}

// 以调试模式运行当前 C 代码。
async function debugC() {
  await runProgram({ debug: true });
}

// 从断点或暂停点继续执行。
function continueDebug() {
  if (!isDebugPaused.value) {
    return;
  }

  debugResumeMode = "continue";
  debugStatus.value = "继续运行中";
  resolveDebugControl(0);
}

// 以单步方式继续执行下一条语句。
function stepDebug() {
  if (!isDebugPaused.value) {
    return;
  }

  debugResumeMode = "step";
  debugStatus.value = "单步运行中";
  resolveDebugControl(0);
}

// 仅重置仿真场景和调试状态。
async function resetSimulatorOnly() {
  if (isRunningC.value) {
    abortPausedDebug();
    await bridge.cancelExecution("仿真已重置，当前运行已停止。");
  }
  await simulatorRef.value?.resetRobot?.();
  resetEditorExecutionState();
  debugStatus.value = "未启用";
  addLog("仿真场景已恢复初始状态。");
}

watch([cCode, breakpoints, currentFileId, currentFileName], () => {
  scheduleAutosave();
});

watch(
  cCode,
  (nextCode, previousCode) => {
    if (previousCode !== undefined && nextCode !== previousCode && picocErrors.value.length) {
      picocErrors.value = [];
    }

    scheduleSyntaxValidation();
  },
  { immediate: true }
);

watch(
  aiProvider,
  (provider) => {
    syncAiProviderDefaults(provider);
  },
  { immediate: true }
);

onMounted(() => {
  storageReady = restoreBrowserWorkspace();
  bridge.attachHostBridge(window);
  attachDebugBridge(window);
  restoreDebuggerPopoverSize();
  restoreDebuggerPopoverPosition();
  window.addEventListener("resize", handleWindowResize);
});

onBeforeUnmount(() => {
  stopDebuggerPopoverDrag();
  stopDebuggerPopoverResize();
  window.removeEventListener("resize", handleWindowResize);
  clearAutosaveTimer();
  clearSyntaxValidationTimer();
  persistWorkspaceNow({ updateStatus: false, logError: false });
});
</script>

<template>
  <div class="app-shell">
    <header class="hero">
      <div>
        <p class="eyebrow">Robot Script Studio</p>
        <h1>机器人编程、地图编辑与传感器联动平台</h1>
        <p class="hero-copy">
          采用 Vue 3 构建前端，使用 PicoC + Emscripten 提供基于 Web 的 C 语言解释执行，并与 2D 地图、障碍物和本地传感器采样实时联动。
        </p>
      </div>
      <div class="hero-actions">
        <button
          class="primary"
          :class="{ secondary: activeView !== 'studio' }"
          @click="activeView = 'studio'"
        >
          编程工作台
        </button>
        <button
          class="secondary"
          :class="{ active: activeView === 'scene-editor' }"
          @click="activeView = 'scene-editor'"
        >
          场景搭建
        </button>
        <button
          class="secondary"
          :class="{ active: activeView === 'c-reference' }"
          @click="activeView = 'c-reference'"
        >
          C 命令说明
        </button>
      </div>
    </header>

    <main
      v-if="activeView === 'studio'"
      class="studio-main"
    >
      <div class="dashboard">
        <section class="workspace-column">
        <BrowserStoragePanel
          v-model:current-file-name="currentFileName"
          :autosave-status="autosaveStatus"
          :current-file-id="currentFileId"
          :saved-files="savedBrowserFiles"
          :disabled="isRunningC"
          @create-file="createNewDraft"
          @save-browser="saveCurrentCodeToBrowser"
          @download-file="downloadCurrentCode"
          @import-file="importLocalCode"
          @open-file="openBrowserFile"
          @delete-file="deleteBrowserFile"
        />

        <AICodeAssistantPanel
          v-model:expanded="aiPanelExpanded"
          v-model:prompt="aiPrompt"
          v-model:provider="aiProvider"
          v-model:model="aiModelName"
          v-model:endpoint="aiEndpoint"
          v-model:api-key="aiApiKey"
          :generated-code="aiGeneratedCode"
          :status="aiStatus"
          :error="aiError"
          :warning="aiWarning"
          :loading="isGeneratingAi"
          :disabled="isRunningC"
          @generate="generateAiCode"
          @apply-generated="applyAiGeneratedCode"
          @clear-generated="clearAiGeneratedCode"
        />

        <div class="editor-shell">
          <CodeEditor
            v-model="cCode"
            :title="`${currentFileName}`"
            language="c"
            :errors="editorErrors"
            :breakpoints="breakpoints"
            :current-line="currentTraceLine"
            @toggle-breakpoint="toggleBreakpoint"
          >
            <template #header-actions>
              <div class="editor-toolbar">
                <span class="tab active">C 编辑器</span>
                <button class="secondary" :disabled="isRunningC || isGeneratingAi" @click="toggleAiPanel">
                  AI 生成
                </button>
                <button class="secondary" :class="{ active: showDebuggerPopover }" @click="toggleDebuggerPopover">
                  运行面板
                </button>
                <button class="primary" :disabled="isRunningC" @click="runC">运行 C</button>
                <button class="secondary" :disabled="isRunningC" @click="debugC">调试运行</button>
                <button class="secondary" :disabled="!isDebugPaused" @click="continueDebug">继续</button>
                <button class="secondary" :disabled="!isDebugPaused" @click="stepDebug">单步</button>
                <button class="secondary" @click="clearBreakpoints">清空断点</button>
                <button class="secondary" @click="resetSimulatorOnly">重置仿真</button>
              </div>
            </template>
          </CodeEditor>

          <div
            v-if="showDebuggerPopover"
            ref="debuggerPopoverRef"
            class="debugger-popover"
            @pointerdown="bringDebuggerPopoverToFront"
            :style="{
              zIndex: debuggerPopoverZIndex,
              width: `${debuggerPopoverSize.width}px`,
              height: `${debuggerPopoverSize.height}px`,
              left: `${debuggerPopoverPosition.left}px`,
              top: `${debuggerPopoverPosition.top}px`
            }"
          >
            <div class="debugger-popover-header" @pointerdown.stop.prevent="startDebuggerPopoverDrag">
              <strong>运行面板</strong>
              <button class="secondary mini-close" @click.stop="closeDebuggerPopover">关闭</button>
            </div>
            <DebuggerPanel
              :errors="editorErrors"
              :logs="logEntries"
              :picoc-status="picocStatus"
              :debug-status="debugStatus"
              :current-trace-line="currentTraceLine"
              :trace-entries="traceEntries"
              :watched-variables="watchedVariables"
              :breakpoints="breakpoints"
            />
            <button
              class="popover-resize-handle"
              aria-label="调整运行面板大小"
              @pointerdown.stop.prevent="startDebuggerPopoverResize"
            />
          </div>
        </div>
      </section>

        <section class="preview-column">
          <SimulatorPanel
            ref="simulatorRef"
            mode="preview"
            @scene-log="addLog"
          />
        </section>
      </div>

      <LogPanelZh
        class="bottom-log-panel"
        :logs="simulatorLogs"
        @export="exportSimulatorLogs"
        @export-filtered="exportSimulatorLogRows"
        @clear-logs="simulatorRef?.resetSensorLogs?.()"
      />
    </main>

    <main v-else-if="activeView === 'scene-editor'" class="scene-editor-shell">
      <RobotWorldLayout />
    </main>

    <main v-else>
      <CCommandReference />
    </main>
  </div>
</template>

<style scoped>
.studio-main {
  display: grid;
  gap: 16px;
}

.studio-main .dashboard {
  min-height: calc(100vh - 320px);
  align-items: stretch;
}

.studio-main .workspace-column,
.studio-main .preview-column {
  height: 100%;
  min-height: 0;
}

.studio-main .preview-column {
  align-self: stretch;
}

.bottom-log-panel {
  width: 100%;
}

.editor-shell {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
}

.studio-main .workspace-column > .editor-shell {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
}

.studio-main .workspace-column > .editor-shell :deep(.editor-panel) {
  flex: 1 1 auto;
}

.studio-main .workspace-column > .editor-shell :deep(.editor-shell.monaco-host) {
  flex: 1 1 auto;
  min-height: 0;
}

.debugger-popover {
  position: fixed;
  z-index: 40;
  width: min(920px, calc(100vw - 80px));
  max-height: min(78vh, 720px);
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(92, 133, 184, 0.26);
  border-radius: 18px;
  overflow: hidden;
  background: linear-gradient(180deg, rgba(13, 23, 40, 0.98), rgba(10, 18, 32, 0.96));
  box-shadow:
    0 24px 80px rgba(0, 0, 0, 0.42),
    0 0 0 1px rgba(94, 234, 212, 0.08);
  backdrop-filter: blur(14px);
}

.debugger-popover-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(92, 133, 184, 0.18);
  background: linear-gradient(90deg, rgba(18, 33, 57, 0.98), rgba(12, 23, 41, 0.94));
  cursor: move;
  user-select: none;
  touch-action: none;
}

.debugger-popover-header strong {
  font-size: 13px;
  letter-spacing: 0.08em;
  color: #d9e7fb;
}

.mini-close {
  padding: 6px 10px;
  font-size: 12px;
}

.debugger-popover :deep(.debugger-shell) {
  margin: 0;
  border: 0;
  border-radius: 0;
  min-height: 0;
  height: calc(100% - 52px);
  max-height: none;
}

.popover-resize-handle {
  position: absolute;
  right: 6px;
  bottom: 6px;
  width: 18px;
  height: 18px;
  border: 0;
  border-radius: 6px;
  background:
    linear-gradient(135deg, transparent 0 42%, rgba(217, 231, 251, 0.9) 42% 52%, transparent 52% 62%, rgba(217, 231, 251, 0.8) 62% 72%, transparent 72%);
  cursor: nwse-resize;
  opacity: 0.8;
}

.editor-toolbar .active {
  border-color: rgba(94, 234, 212, 0.22);
  background: rgba(94, 234, 212, 0.12);
}

.editor-toolbar .tab.active {
  color: var(--text);
}

@media (max-width: 960px) {
  .debugger-popover {
    max-width: calc(100vw - 24px);
    max-height: calc(100vh - 24px);
  }

  .debugger-popover :deep(.debugger-shell) {
    height: calc(100% - 52px);
  }
}
</style>
