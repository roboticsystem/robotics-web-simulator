const STORAGE_KEYS = {
  workspace: "robot-script-studio.workspace",
  savedFiles: "robot-script-studio.saved-files"
};

const DEFAULT_FILE_NAME = "untitled.c";

// 获取浏览器本地存储实例。
function getStorage() {
  if (typeof window === "undefined" || !window.localStorage) {
    throw new Error("当前环境不支持浏览器本地存储。");
  }

  return window.localStorage;
}

// 安全解析 JSON，并在失败时回退默认值。
function safeParse(json, fallback) {
  if (!json) {
    return fallback;
  }

  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

// 规范化代码文件名并补齐扩展名。
export function normalizeFileName(name, fallback = DEFAULT_FILE_NAME) {
  const trimmed = String(name ?? "").trim();
  const baseName = trimmed || fallback;

  if (/\.[a-z]+$/i.test(baseName)) {
    return baseName;
  }

  return `${baseName}.c`;
}

// 规范化断点列表并去重排序。
function normalizeBreakpoints(breakpoints) {
  if (!Array.isArray(breakpoints)) {
    return [];
  }

  return [...new Set(
    breakpoints
      .map((line) => Number(line))
      .filter((line) => Number.isInteger(line) && line > 0)
  )].sort((left, right) => left - right);
}

// 统一单个已保存代码文件的数据结构。
function normalizeSavedFile(file) {
  const now = new Date().toISOString();

  return {
    id: String(file?.id ?? generateSavedFileId()),
    name: normalizeFileName(file?.name, DEFAULT_FILE_NAME),
    code: String(file?.code ?? ""),
    breakpoints: normalizeBreakpoints(file?.breakpoints),
    createdAt: file?.createdAt || now,
    updatedAt: file?.updatedAt || now
  };
}

// 按更新时间倒序排列已保存文件。
function sortSavedFiles(files) {
  return [...files].sort((left, right) => {
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
}

// 生成浏览器代码文件的唯一标识。
export function generateSavedFileId() {
  return `browser-file-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

// 读取浏览器目录中的全部代码文件。
export function readSavedFiles() {
  const storage = getStorage();
  const parsed = safeParse(storage.getItem(STORAGE_KEYS.savedFiles), []);

  if (!Array.isArray(parsed)) {
    return [];
  }

  return sortSavedFiles(parsed.map((item) => normalizeSavedFile(item)));
}

// 写入浏览器目录中的全部代码文件。
export function writeSavedFiles(files) {
  const storage = getStorage();
  const normalized = sortSavedFiles((files ?? []).map((item) => normalizeSavedFile(item)));
  storage.setItem(STORAGE_KEYS.savedFiles, JSON.stringify(normalized));
  return normalized;
}

// 读取当前工作区草稿状态。
export function readWorkspace() {
  const storage = getStorage();
  const parsed = safeParse(storage.getItem(STORAGE_KEYS.workspace), null);

  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  return {
    currentFileId: parsed.currentFileId ? String(parsed.currentFileId) : null,
    currentFileName: normalizeFileName(parsed.currentFileName, DEFAULT_FILE_NAME),
    code: String(parsed.code ?? ""),
    breakpoints: normalizeBreakpoints(parsed.breakpoints),
    updatedAt: parsed.updatedAt || null
  };
}

// 写入当前工作区草稿状态。
export function writeWorkspace(workspace) {
  const storage = getStorage();
  const normalized = {
    currentFileId: workspace?.currentFileId ? String(workspace.currentFileId) : null,
    currentFileName: normalizeFileName(workspace?.currentFileName, DEFAULT_FILE_NAME),
    code: String(workspace?.code ?? ""),
    breakpoints: normalizeBreakpoints(workspace?.breakpoints),
    updatedAt: workspace?.updatedAt || new Date().toISOString()
  };

  storage.setItem(STORAGE_KEYS.workspace, JSON.stringify(normalized));
  return normalized;
}

// 在已保存文件列表中新增或更新一条记录。
export function upsertSavedFile(files, nextFile) {
  const normalized = normalizeSavedFile(nextFile);
  const remaining = (files ?? []).filter((item) => item.id !== normalized.id);
  return sortSavedFiles([normalized, ...remaining]);
}
