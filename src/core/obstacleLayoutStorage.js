const STORAGE_KEYS = {
  workspace: "robot-script-studio.obstacle-layout.workspace",
  savedLayouts: "robot-script-studio.obstacle-layout.saved-layouts"
};

const DEFAULT_LAYOUT_NAME = "默认布局";

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

// 规范化障碍布局名称。
export function normalizeObstacleLayoutName(name, fallback = DEFAULT_LAYOUT_NAME) {
  const trimmed = String(name ?? "").trim().replace(/\.json$/i, "");
  return trimmed || fallback;
}

// 规范化障碍物条目并补齐唯一编号。
export function normalizeObstacleEntries(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }

  let nextId = 1;
  const usedIds = new Set();

  // 为导入的障碍物分配不重复的编号。
  function allocateId(preferredId) {
    if (Number.isInteger(preferredId) && preferredId > 0 && !usedIds.has(preferredId)) {
      usedIds.add(preferredId);
      nextId = Math.max(nextId, preferredId + 1);
      return preferredId;
    }

    while (usedIds.has(nextId)) {
      nextId += 1;
    }

    const allocatedId = nextId;
    usedIds.add(allocatedId);
    nextId += 1;
    return allocatedId;
  }

  return entries
    .map((entry) => ({
      id: Number(entry?.id),
      x: Number(entry?.x),
      z: Number(entry?.z),
      width: Number(entry?.width),
      depth: Number(entry?.depth),
      height: Number(entry?.height)
    }))
    .filter((entry) =>
      [entry.x, entry.z, entry.width, entry.depth, entry.height].every((value) =>
        Number.isFinite(value)
      )
    )
    .map((entry) => ({
      id: allocateId(entry.id),
      x: entry.x,
      z: entry.z,
      width: entry.width,
      depth: entry.depth,
      height: entry.height
    }));
}

// 按更新时间倒序排列障碍布局。
function sortObstacleLayouts(layouts) {
  return [...layouts].sort((left, right) => {
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
}

// 统一单个障碍布局的数据结构。
function normalizeObstacleLayout(layout) {
  const now = new Date().toISOString();

  return {
    id: String(layout?.id ?? generateObstacleLayoutId()),
    name: normalizeObstacleLayoutName(layout?.name, DEFAULT_LAYOUT_NAME),
    axesVisible: Boolean(layout?.axesVisible),
    obstacles: normalizeObstacleEntries(layout?.obstacles),
    createdAt: layout?.createdAt || now,
    updatedAt: layout?.updatedAt || now
  };
}

// 生成障碍布局的唯一标识。
export function generateObstacleLayoutId() {
  return `obstacle-layout-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

// 读取浏览器中保存的全部障碍布局。
export function readObstacleLayouts() {
  const storage = getStorage();
  const parsed = safeParse(storage.getItem(STORAGE_KEYS.savedLayouts), []);

  if (!Array.isArray(parsed)) {
    return [];
  }

  return sortObstacleLayouts(parsed.map((item) => normalizeObstacleLayout(item)));
}

// 写入浏览器中的全部障碍布局。
export function writeObstacleLayouts(layouts) {
  const storage = getStorage();
  const normalized = sortObstacleLayouts(
    (layouts ?? []).map((item) => normalizeObstacleLayout(item))
  );
  storage.setItem(STORAGE_KEYS.savedLayouts, JSON.stringify(normalized));
  return normalized;
}

// 读取当前障碍布局工作区草稿。
export function readObstacleLayoutWorkspace() {
  const storage = getStorage();
  const parsed = safeParse(storage.getItem(STORAGE_KEYS.workspace), null);

  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  return {
    currentLayoutId: parsed.currentLayoutId ? String(parsed.currentLayoutId) : null,
    currentLayoutName: normalizeObstacleLayoutName(
      parsed.currentLayoutName,
      DEFAULT_LAYOUT_NAME
    ),
    axesVisible: Boolean(parsed.axesVisible),
    obstacles: normalizeObstacleEntries(parsed.obstacles),
    updatedAt: parsed.updatedAt || null
  };
}

// 写入当前障碍布局工作区草稿。
export function writeObstacleLayoutWorkspace(workspace) {
  const storage = getStorage();
  const normalized = {
    currentLayoutId: workspace?.currentLayoutId ? String(workspace.currentLayoutId) : null,
    currentLayoutName: normalizeObstacleLayoutName(
      workspace?.currentLayoutName,
      DEFAULT_LAYOUT_NAME
    ),
    axesVisible: Boolean(workspace?.axesVisible),
    obstacles: normalizeObstacleEntries(workspace?.obstacles),
    updatedAt: workspace?.updatedAt || new Date().toISOString()
  };

  storage.setItem(STORAGE_KEYS.workspace, JSON.stringify(normalized));
  return normalized;
}

// 在布局列表中新增或更新一条记录。
export function upsertObstacleLayout(layouts, nextLayout) {
  const normalized = normalizeObstacleLayout(nextLayout);
  const remaining = (layouts ?? []).filter((item) => item.id !== normalized.id);
  return sortObstacleLayouts([normalized, ...remaining]);
}
