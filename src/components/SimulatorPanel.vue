<script setup>
import * as echarts from "echarts";
import { storeToRefs } from "pinia";
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import SensorPanelZh from "../sensorFrontend/components/SensorPanelZh.vue";
import WorldCanvas from "../robotWorld/components/canvas/WorldCanvas.vue";
import ObstacleEditor from "../robotWorld/components/editor/ObstacleEditor.vue";
import MapGenControls from "../robotWorld/components/toolbar/MapGenControls.vue";
import EventBus, { EVENTS } from "../robotWorld/core/engine/EventBus";
import { useSceneEditor } from "../robotWorld/composables/useSceneEditor";
import { useSimulation } from "../robotWorld/composables/useSimulation";
import { useWorldEngine } from "../robotWorld/composables/useWorldEngine";
import { useSceneStore } from "../robotWorld/store/sceneStore";
import { useSimulationStore } from "../robotWorld/store/simulationStore";
import { useUiStore } from "../robotWorld/store/uiStore";

const emit = defineEmits(["scene-log"]);
const props = defineProps({
  mode: {
    type: String,
    default: "preview"
  }
});

const DEFAULT_SENSOR_AMBIENT = 0.35;
const DEFAULT_SENSORS = [
  {
    sensorId: "ultrasonic_01",
    name: "超声波-1",
    sensorType: "ultrasonic",
    mountX: 14,
    mountY: 0,
    mountAngle: 0,
    rangeCm: 300,
    minRangeCm: 2,
    beamDeg: 55,
    frequency: 10,
    noise: 0.02,
    sysError: 0.01,
    reflectivityGain: 1,
    resolution: 0.1,
    enabled: true
  },
  {
    sensorId: "infrared_01",
    name: "红外-1",
    sensorType: "infrared",
    mountX: 12,
    mountY: 5,
    mountAngle: 0,
    rangeCm: 80,
    frequency: 20,
    noise: 0.05,
    sensitivity: 1,
    ambientFactor: 1,
    outputMode: "analog",
    threshold: 0.45,
    reflectivityGain: 1,
    resolution: 0.01,
    enabled: true
  },
  {
    sensorId: "imu_01",
    name: "IMU-1",
    sensorType: "imu",
    mountX: 0,
    mountY: 0,
    mountAngle: 0,
    frequency: 50,
    noiseGyro: 0.02,
    noiseAccel: 0.12,
    driftCoeff: 0.003,
    biasGyro: 0,
    biasAccelX: 0,
    biasAccelY: 0,
    resolutionGyro: 0.001,
    resolutionAccel: 0.01,
    enabled: true
  }
];

const SENSOR_LABELS = {
  ultrasonic: "超声波",
  infrared: "红外",
  imu: "IMU"
};

const STORAGE_KEYS = {
  sensors: "integrated-sim-sensors-v1",
  logs: "integrated-sim-sensor-logs-v1",
  ambient: "integrated-sim-sensor-ambient-v1"
};
const SENSOR_BACKEND_WS_URL = import.meta.env.VITE_SENSOR_WS_URL || "ws://127.0.0.1:3001";
const SENSOR_BACKEND_PIXELS_PER_METER = 100;
const SENSOR_CONFIG_POPOVER_POSITION_KEY = "integrated-sim-sensor-config-popover-pos-v1";
const SENSOR_CONFIG_POPOVER_SIZE_KEY = "integrated-sim-sensor-config-popover-size-v1";

const { engine, saveScene, loadScene, setTool: setWorldTool } = useWorldEngine();
const { start, pause, reset } = useSimulation();
const { clearScene, updateWorldSize } = useSceneEditor();
const uiStore = useUiStore();
const sceneStore = useSceneStore();
const simulationStore = useSimulationStore();
const { currentTool, selectedEntityId, selectedEntityType } = storeToRefs(uiStore);
const { obstacleList, robotInfo, sceneWidth, sceneHeight } = storeToRefs(sceneStore);
const { isRunning, isPaused } = storeToRefs(simulationStore);

const ultrasonicChartMountRef = ref(null);
const infraredChartMountRef = ref(null);
const imuChartMountRef = ref(null);
const sensorAmbientLight = ref(DEFAULT_SENSOR_AMBIENT);
const logs = ref([]);
const sensors = ref(structuredClone(DEFAULT_SENSORS));
const sensorConfigButtonRef = ref(null);
const sensorConfigPopoverRef = ref(null);
const sensorConfigPopoverPosition = ref({ top: 86, left: 0 });
const sensorConfigPopoverSize = ref({ width: 900, height: 720 });
const sensorConfigPopoverZIndex = ref(2001);
const chartSeries = reactive({
  ultrasonic: {},
  infrared: {},
  imu: {}
});
const latestBySensor = reactive({});
const motionState = reactive({
  current: null
});
const sensorBackendConnected = ref(false);
const sensorBackendStatus = ref("未连接");

const charts = {
  ultrasonic: null,
  infrared: null,
  imu: null
};
let helperFrameId = 0;
let sensorConfigDragState = null;
let sensorConfigResizeState = null;
let sensorSocket = null;
let sensorReconnectTimer = 0;
let shouldReconnectSensorBackend = true;
let sceneSyncTimer = 0;
let lastSceneSyncPayload = "";
let hasLocalSensorState = false;
let hasLocalAmbientState = false;
let removeEntityDragSyncListener = null;
let chartRefreshFrameId = 0;
let chartsNeedResize = false;

const isObstacleSelected = computed(() =>
  ["circle", "rect", "polygon"].includes(selectedEntityType.value)
);
const isEditorMode = computed(() => props.mode === "editor");
const isSimulationActive = computed(() => isRunning.value && !isPaused.value);
const showSensorConfig = ref(false);

const robotPose = computed(() => {
  const rotationDeg = ((robotInfo.value.rotation || 0) * 180) / Math.PI;
  return `${Math.round(robotInfo.value.position.x)}, ${Math.round(robotInfo.value.position.y)} · ${rotationDeg.toFixed(0)}°`;
});

function setTool(tool) {
  uiStore.setTool(tool);
  setWorldTool(tool);
}

function toggleSensorConfig() {
  if (!showSensorConfig.value) {
    sensorConfigPopoverSize.value = clampSensorConfigPopoverSize(sensorConfigPopoverSize.value);
    sensorConfigPopoverPosition.value = clampSensorConfigPopoverPosition(sensorConfigPopoverPosition.value);
  }
  showSensorConfig.value = !showSensorConfig.value;
  if (showSensorConfig.value) {
    bringSensorConfigToFront();
  }
}

function closeSensorConfig() {
  showSensorConfig.value = false;
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

function bringSensorConfigToFront() {
  sensorConfigPopoverZIndex.value = nextPopoverZIndex(2000);
}

function clampSensorConfigPopoverSize(nextSize = sensorConfigPopoverSize.value) {
  const width = typeof window !== "undefined" ? window.innerWidth : 1440;
  const height = typeof window !== "undefined" ? window.innerHeight : 900;

  return {
    width: Math.min(Math.max(Number(nextSize.width) || 900, 560), Math.max(560, width - 24)),
    height: Math.min(Math.max(Number(nextSize.height) || 720, 420), Math.max(420, height - 24))
  };
}

function clampSensorConfigPopoverPosition(nextPosition = sensorConfigPopoverPosition.value) {
  const width = typeof window !== "undefined" ? window.innerWidth : 1440;
  const height = typeof window !== "undefined" ? window.innerHeight : 900;
  const panelSize = clampSensorConfigPopoverSize(sensorConfigPopoverSize.value);
  const minLeft = 12;
  const minTop = 12;
  const maxLeft = Math.max(minLeft, width - panelSize.width - 12);
  const maxTop = Math.max(minTop, height - panelSize.height - 12);

  return {
    left: Math.min(Math.max(nextPosition.left ?? minLeft, minLeft), maxLeft),
    top: Math.min(Math.max(nextPosition.top ?? minTop, minTop), maxTop)
  };
}

function persistSensorConfigPopoverSize() {
  if (typeof window === "undefined") {
    return;
  }

  const safeSize = clampSensorConfigPopoverSize(sensorConfigPopoverSize.value);
  sensorConfigPopoverSize.value = safeSize;
  window.localStorage.setItem(SENSOR_CONFIG_POPOVER_SIZE_KEY, JSON.stringify(safeSize));
}

function persistSensorConfigPopoverPosition() {
  if (typeof window === "undefined") {
    return;
  }

  const safePosition = clampSensorConfigPopoverPosition(sensorConfigPopoverPosition.value);
  sensorConfigPopoverPosition.value = safePosition;
  window.localStorage.setItem(SENSOR_CONFIG_POPOVER_POSITION_KEY, JSON.stringify(safePosition));
}

function restoreSensorConfigPopoverSize() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const raw = window.localStorage.getItem(SENSOR_CONFIG_POPOVER_SIZE_KEY);
    if (!raw) {
      sensorConfigPopoverSize.value = clampSensorConfigPopoverSize(sensorConfigPopoverSize.value);
      return;
    }

    const parsed = JSON.parse(raw);
    sensorConfigPopoverSize.value = clampSensorConfigPopoverSize({
      width: Number(parsed?.width),
      height: Number(parsed?.height)
    });
  } catch {
    sensorConfigPopoverSize.value = clampSensorConfigPopoverSize(sensorConfigPopoverSize.value);
  }
}

function restoreSensorConfigPopoverPosition() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const raw = window.localStorage.getItem(SENSOR_CONFIG_POPOVER_POSITION_KEY);
    if (!raw) {
      sensorConfigPopoverPosition.value = clampSensorConfigPopoverPosition(sensorConfigPopoverPosition.value);
      return;
    }

    const parsed = JSON.parse(raw);
    sensorConfigPopoverPosition.value = clampSensorConfigPopoverPosition({
      left: Number(parsed?.left),
      top: Number(parsed?.top)
    });
  } catch {
    sensorConfigPopoverPosition.value = clampSensorConfigPopoverPosition(sensorConfigPopoverPosition.value);
  }
}

function startSensorConfigDrag(event) {
  bringSensorConfigToFront();
  sensorConfigDragState = {
    offsetX: event.clientX - sensorConfigPopoverPosition.value.left,
    offsetY: event.clientY - sensorConfigPopoverPosition.value.top
  };
  window.addEventListener("pointermove", onSensorConfigDrag);
  window.addEventListener("pointerup", stopSensorConfigDrag);
}

function onSensorConfigDrag(event) {
  if (!sensorConfigDragState) {
    return;
  }

  sensorConfigPopoverPosition.value = clampSensorConfigPopoverPosition({
    left: event.clientX - sensorConfigDragState.offsetX,
    top: event.clientY - sensorConfigDragState.offsetY
  });
}

function stopSensorConfigDrag() {
  if (!sensorConfigDragState) {
    return;
  }

  sensorConfigDragState = null;
  window.removeEventListener("pointermove", onSensorConfigDrag);
  window.removeEventListener("pointerup", stopSensorConfigDrag);
  persistSensorConfigPopoverPosition();
}

function startSensorConfigResize(event) {
  bringSensorConfigToFront();
  const panel = sensorConfigPopoverRef.value;
  sensorConfigResizeState = {
    startX: event.clientX,
    startY: event.clientY,
    startWidth: panel?.offsetWidth ?? sensorConfigPopoverSize.value.width,
    startHeight: panel?.offsetHeight ?? sensorConfigPopoverSize.value.height
  };
  window.addEventListener("pointermove", onSensorConfigResize);
  window.addEventListener("pointerup", stopSensorConfigResize);
}

function onSensorConfigResize(event) {
  if (!sensorConfigResizeState) {
    return;
  }

  sensorConfigPopoverSize.value = clampSensorConfigPopoverSize({
    width: sensorConfigResizeState.startWidth + (event.clientX - sensorConfigResizeState.startX),
    height: sensorConfigResizeState.startHeight + (event.clientY - sensorConfigResizeState.startY)
  });
  sensorConfigPopoverPosition.value = clampSensorConfigPopoverPosition(sensorConfigPopoverPosition.value);
}

function stopSensorConfigResize() {
  if (!sensorConfigResizeState) {
    return;
  }

  sensorConfigResizeState = null;
  window.removeEventListener("pointermove", onSensorConfigResize);
  window.removeEventListener("pointerup", stopSensorConfigResize);
  persistSensorConfigPopoverSize();
  persistSensorConfigPopoverPosition();
}

function handleSensorConfigWindowResize() {
  sensorConfigPopoverSize.value = clampSensorConfigPopoverSize(sensorConfigPopoverSize.value);
  sensorConfigPopoverPosition.value = clampSensorConfigPopoverPosition(sensorConfigPopoverPosition.value);
  scheduleChartRefresh({ resize: true });
  if (showSensorConfig.value) {
    persistSensorConfigPopoverSize();
    persistSensorConfigPopoverPosition();
  }
}

function logMessage(message, level = "info", sensorId = null) {
  emit("scene-log", message);
  logs.value = [
    {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      timestamp: Date.now(),
      payload: { level, message, sensorId }
    },
    ...logs.value
  ].slice(0, 240);
}

function restoreLocalState() {
  try {
    const rawSensors = localStorage.getItem(STORAGE_KEYS.sensors);
    if (rawSensors) {
      const parsed = JSON.parse(rawSensors);
      if (Array.isArray(parsed) && parsed.length) {
        sensors.value = parsed;
        hasLocalSensorState = true;
      }
    }
  } catch {
    // ignore
  }

  try {
    const rawLogs = localStorage.getItem(STORAGE_KEYS.logs);
    if (rawLogs) {
      const parsed = JSON.parse(rawLogs);
      if (Array.isArray(parsed)) {
        logs.value = parsed.slice(0, 240);
      }
    }
  } catch {
    // ignore
  }

  try {
    const rawAmbient = localStorage.getItem(STORAGE_KEYS.ambient);
    if (rawAmbient) {
      const value = Number(rawAmbient);
      if (Number.isFinite(value)) {
        sensorAmbientLight.value = value;
        hasLocalAmbientState = true;
      }
    }
  } catch {
    // ignore
  }
}

function persistLocalState() {
  try {
    localStorage.setItem(STORAGE_KEYS.sensors, JSON.stringify(sensors.value));
    localStorage.setItem(STORAGE_KEYS.logs, JSON.stringify(logs.value.slice(0, 240)));
    localStorage.setItem(STORAGE_KEYS.ambient, String(sensorAmbientLight.value));
  } catch {
    // ignore
  }
}

function pixelsToBackendMeters(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue / SENSOR_BACKEND_PIXELS_PER_METER : 0;
}

function backendMetersToPixels(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue * SENSOR_BACKEND_PIXELS_PER_METER : 0;
}

function sensorFromBackend(sensor = {}) {
  const next = { ...sensor };
  if (next.mountX !== undefined) {
    next.mountX = backendMetersToPixels(next.mountX);
  }
  if (next.mountY !== undefined) {
    next.mountY = backendMetersToPixels(next.mountY);
  }
  return next;
}

function sensorsFromBackend(nextSensors) {
  return Array.isArray(nextSensors) ? nextSensors.map(sensorFromBackend) : [];
}

function sensorToBackend(sensor = {}) {
  const next = { ...sensor };
  if (next.mountX !== undefined) {
    next.mountX = pixelsToBackendMeters(next.mountX);
  }
  if (next.mountY !== undefined) {
    next.mountY = pixelsToBackendMeters(next.mountY);
  }
  return next;
}

function toRobotSensorVisual(sensor = {}) {
  return {
    sensorId: sensor.sensorId,
    sensorType: sensor.sensorType,
    mountX: Number(sensor.mountX ?? 0),
    mountY: Number(sensor.mountY ?? 0),
    mountAngle: Number(sensor.mountAngle ?? 0),
    enabled: sensor.enabled !== false
  };
}

function syncRobotSensorVisuals() {
  const robot = engine.value?.scene?.robot;
  if (!robot) {
    return;
  }

  robot.installedSensors = sensors.value.map(toRobotSensorVisual);
  robot.markDirty?.();
  try {
    engine.value?.renderFrame?.();
  } catch (error) {
    console.error("[SimulatorPanel] 渲染机器人传感器外观失败:", error);
  }
}

function serializeObstacleForSensorBackend(obstacle) {
  const aabb = obstacle.getAABB?.();
  const width = aabb ? aabb.maxX - aabb.minX : obstacle.width ?? obstacle.radius * 2 ?? 40;
  const height = aabb ? aabb.maxY - aabb.minY : obstacle.height ?? obstacle.radius * 2 ?? 40;
  const x = obstacle.position?.x ?? (aabb ? (aabb.minX + aabb.maxX) / 2 : 0);
  const y = obstacle.position?.y ?? (aabb ? (aabb.minY + aabb.maxY) / 2 : 0);
  const backendObstacle = {
    id: obstacle.id,
    type: obstacle.type || "rect",
    x: pixelsToBackendMeters(x),
    y: pixelsToBackendMeters(y),
    width: pixelsToBackendMeters(width),
    height: pixelsToBackendMeters(height),
    reflectivity: obstacle.reflectivity ?? 0.8
  };

  if (obstacle.radius !== undefined) {
    backendObstacle.radius = pixelsToBackendMeters(obstacle.radius);
  }

  const vertices = obstacle.getWorldVertices?.();
  if (obstacle.type !== "circle" && Array.isArray(vertices) && vertices.length >= 3) {
    backendObstacle.vertices = vertices
      .filter((vertex) => Number.isFinite(Number(vertex?.x)) && Number.isFinite(Number(vertex?.y)))
      .map((vertex) => ({
        x: pixelsToBackendMeters(vertex.x),
        y: pixelsToBackendMeters(vertex.y)
      }));
  }

  return backendObstacle;
}

function clearLatestSensorData() {
  Object.keys(latestBySensor).forEach((key) => {
    delete latestBySensor[key];
  });
}

function pushBackendPayload(payload, timestamp = Date.now()) {
  if (!payload?.sensorId) {
    return;
  }

  latestBySensor[payload.sensorId] = payload;
  const sensorName = sensors.value.find((item) => item.sensorId === payload.sensorId)?.name || payload.sensorId;

  if (payload.sensorType === "ultrasonic") {
    pushSeriesPoint(
      "ultrasonic",
      `${sensorName} 测距`,
      payload.status === "out_of_range" ? payload.theoretical ?? payload.value : payload.value
    );
  } else if (payload.sensorType === "infrared") {
    pushSeriesPoint("infrared", `${sensorName} 响应`, Number(payload.value));
  } else if (payload.sensorType === "imu") {
    pushSeriesPoint("imu", `${sensorName} gyroZ`, payload.gyroZ);
    pushSeriesPoint("imu", `${sensorName} accelX`, payload.accelX);
    pushSeriesPoint("imu", `${sensorName} accelY`, payload.accelY);
  }

  scheduleChartRefresh();
}

function applyBackendState(payload = {}) {
  const backendSensors = Array.isArray(payload.sensors) ? sensorsFromBackend(payload.sensors) : [];
  if (Array.isArray(payload.sensors)) {
    if (hasLocalSensorState && sensors.value.length) {
      syncLocalSensorsToBackend(backendSensors);
    } else {
      sensors.value = backendSensors;
    }
  }

  if (Array.isArray(payload.logs)) {
    logs.value = payload.logs.slice(-240);
  }

  syncLocalSimulationState(payload.running, payload.paused);

  if (payload.scene?.ambientLight !== undefined) {
    const ambient = Math.max(0, Math.min(1, Number(payload.scene.ambientLight) || 0));
    if (!hasLocalAmbientState) {
      sensorAmbientLight.value = ambient;
    }
  }

  persistLocalState();
}

function syncLocalSensorsToBackend(backendSensors = []) {
  if (!sensorBackendConnected.value) {
    return;
  }

  const backendMap = new Map(
    backendSensors
      .filter((sensor) => sensor?.sensorId)
      .map((sensor) => [sensor.sensorId, sensor])
  );
  const localIds = new Set();

  sensors.value.forEach((sensor) => {
    if (!sensor?.sensorId) {
      return;
    }

    localIds.add(sensor.sensorId);
    const payload = sensorToBackend(sensor);
    if (backendMap.has(sensor.sensorId)) {
      sendSensorBackendMessage("sensor_update", payload);
    } else {
      sendSensorBackendMessage("sensor_add", payload);
    }
  });

  backendMap.forEach((_, sensorId) => {
    if (!localIds.has(sensorId)) {
      sendSensorBackendMessage("sensor_remove", { sensorId });
    }
  });
}

function sendSensorBackendMessage(type, payload = {}) {
  if (!sensorSocket || sensorSocket.readyState !== WebSocket.OPEN) {
    return false;
  }
  sensorSocket.send(JSON.stringify({ type, payload }));
  return true;
}

function syncSceneToSensorBackend() {
  const sensorScene = buildSensorScene();
  if (!sensorScene) {
    return;
  }

  const payload = {
    sceneId: "integrated_scene",
    ambientLight: sensorAmbientLight.value,
    scale: 1,
    robot: sensorScene.robot,
    obstacles: sensorScene.obstacles
  };
  const serialized = JSON.stringify(payload);
  if (serialized === lastSceneSyncPayload) {
    return;
  }

  lastSceneSyncPayload = serialized;
  sendSensorBackendMessage("scene_update", payload);
}

function scheduleSceneSync(delay = 60) {
  window.clearTimeout(sceneSyncTimer);
  sceneSyncTimer = window.setTimeout(() => {
    syncSceneToSensorBackend();
  }, delay);
}

function syncLocalSimulationState(running, paused = false) {
  if (running === undefined && paused === undefined) {
    return;
  }

  const nextRunning = Boolean(running);
  const nextPaused = nextRunning ? Boolean(paused) : false;
  const nextEngine = engine.value;

  if (nextEngine) {
    if (nextRunning) {
      nextEngine.start();
      if (nextPaused) {
        nextEngine.pause();
      }
    } else {
      nextEngine.pause();
      if (motionState.current) {
        finishMotion(new Error("仿真已停止。"));
      }
    }
  }

  simulationStore.setRunning(nextRunning);
  simulationStore.setPaused(nextPaused);
}

function handleSensorBackendMessage(event) {
  let message = null;
  try {
    message = JSON.parse(event.data);
  } catch {
    return;
  }

  const { type, payload, timestamp } = message;
  if (type === "state_sync") {
    applyBackendState(payload);
    clearLatestSensorData();
    clearChartSeries();
    sensorBackendStatus.value = "已同步";
    scheduleChartRefresh({ resize: true });
    return;
  }

  if (type === "sensor_list") {
    sensors.value = sensorsFromBackend(payload?.sensors);
    persistLocalState();
    return;
  }

  if (type === "simulation_status") {
    syncLocalSimulationState(payload?.running, payload?.paused);
    sensorBackendStatus.value =
      payload?.running
        ? payload?.paused
          ? "已暂停"
          : "运行中"
        : "已连接";
    return;
  }

  if (type === "sensor_data") {
    pushBackendPayload(payload, timestamp);
    return;
  }

  if (type === "simulation_log") {
    logs.value = [...logs.value, { ...message, id: `${timestamp}-${Math.random().toString(16).slice(2)}` }].slice(-240);
    return;
  }

  if (type === "error") {
    logMessage(payload?.message || "后端传感器服务返回错误。", "error");
  }
}

function connectSensorBackend() {
  if (typeof window === "undefined") {
    return;
  }

  window.clearTimeout(sensorReconnectTimer);
  if (sensorSocket && (sensorSocket.readyState === WebSocket.OPEN || sensorSocket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  sensorBackendStatus.value = "连接中";
  sensorSocket = new WebSocket(SENSOR_BACKEND_WS_URL);

  sensorSocket.addEventListener("open", () => {
    sensorBackendConnected.value = true;
    sensorBackendStatus.value = "已连接";
    sendSensorBackendMessage("get_state");
    scheduleSceneSync(0);
  });

  sensorSocket.addEventListener("message", handleSensorBackendMessage);

  sensorSocket.addEventListener("close", () => {
    sensorBackendConnected.value = false;
    sensorBackendStatus.value = "已断开";
    sensorSocket = null;
    if (shouldReconnectSensorBackend) {
      sensorReconnectTimer = window.setTimeout(connectSensorBackend, 1500);
    }
  });

  sensorSocket.addEventListener("error", () => {
    sensorBackendStatus.value = "连接错误";
  });
}

function buildChartOption(groupKey, title) {
  const groupSeries = chartSeries[groupKey] || {};
  const names = Object.keys(groupSeries).sort();
  return {
    backgroundColor: "transparent",
    animation: false,
    textStyle: { color: "#526074", fontFamily: "JetBrains Mono, monospace", fontSize: 11 },
    title: {
      text: title,
      left: 0,
      top: 0,
      textStyle: { color: "#233247", fontSize: 13, fontWeight: 700 }
    },
    legend: { type: "scroll", top: 24, textStyle: { color: "#526074" } },
    tooltip: { trigger: "axis", axisPointer: { type: "cross" } },
    grid: { left: 44, right: 20, top: 58, bottom: 24 },
    xAxis: {
      type: "time",
      axisLine: { lineStyle: { color: "#c2ccd6" } },
      splitLine: { show: false }
    },
    yAxis: {
      type: "value",
      axisLine: { lineStyle: { color: "#c2ccd6" } },
      splitLine: { lineStyle: { color: "#e2e8f0" } }
    },
    series: names.map((name) => ({
      name,
      type: "line",
      smooth: true,
      showSymbol: false,
      data: groupSeries[name].map((item) => [item.t, item.v])
    }))
  };
}

function scheduleChartRefresh({ resize = false } = {}) {
  chartsNeedResize = chartsNeedResize || resize;
  if (chartRefreshFrameId) {
    return;
  }

  chartRefreshFrameId = window.requestAnimationFrame(() => {
    chartRefreshFrameId = 0;
    updateChart(chartsNeedResize);
    chartsNeedResize = false;
  });
}

function updateChart(shouldResize = false) {
  const chartTitles = {
    ultrasonic: "超声曲线",
    infrared: "红外曲线",
    imu: "IMU 曲线"
  };

  Object.keys(charts).forEach((groupKey) => {
    const instance = charts[groupKey];
    if (!instance) {
      return;
    }

    if (shouldResize) {
      instance.resize();
    }
    instance.setOption(buildChartOption(groupKey, chartTitles[groupKey] || groupKey), { notMerge: true });
  });
}

function pushSeriesPoint(groupKey, name, value) {
  if (!Number.isFinite(value)) {
    return;
  }

  if (!chartSeries[groupKey]) {
    chartSeries[groupKey] = {};
  }
  if (!chartSeries[groupKey][name]) {
    chartSeries[groupKey][name] = [];
  }

  chartSeries[groupKey][name].push({ t: Date.now(), v: value });
  if (chartSeries[groupKey][name].length > 220) {
    chartSeries[groupKey][name].shift();
  }
}

function clearChartSeries() {
  chartSeries.ultrasonic = {};
  chartSeries.infrared = {};
  chartSeries.imu = {};
  scheduleChartRefresh();
}

function formatSensorValue(payload) {
  if (!payload) {
    return "--";
  }

  if (payload.sensorType === "imu") {
    return `gz ${payload.gyroZ} · ax ${payload.accelX} · ay ${payload.accelY}`;
  }

  if (typeof payload.value === "number") {
    return `${payload.value}${payload.unit ? ` ${payload.unit}` : ""}`;
  }

  return "--";
}

function buildSensorScene() {
  const worldScene = engine.value?.scene;
  if (!worldScene) {
    return null;
  }

  return {
    ambientLight: sensorAmbientLight.value,
    robot: {
      x: pixelsToBackendMeters(worldScene.robot.position.x),
      y: pixelsToBackendMeters(worldScene.robot.position.y),
      theta: worldScene.robot.rotation,
      vx: pixelsToBackendMeters(worldScene.robot.velocity.x),
      vy: pixelsToBackendMeters(worldScene.robot.velocity.y)
    },
    obstacles: Array.isArray(worldScene.obstacles) ? worldScene.obstacles.map(serializeObstacleForSensorBackend) : []
  };
}

function getRobotController() {
  return engine.value?.scene?.robot ?? null;
}

function pointHitsObstacle(x, y) {
  const robot = getRobotController();
  const worldScene = engine.value?.scene;
  if (!robot || !worldScene) {
    return false;
  }

  const radius = robot.radius || 9;
  if (x - radius < 0 || y - radius < 0 || x + radius > worldScene.world.width || y + radius > worldScene.world.height) {
    return true;
  }

  return worldScene.obstacles.some((obstacle) => {
    const aabb = obstacle.getAABB?.();
    if (!aabb) {
      return false;
    }
    const closestX = Math.max(aabb.minX, Math.min(x, aabb.maxX));
    const closestY = Math.max(aabb.minY, Math.min(y, aabb.maxY));
    const dx = x - closestX;
    const dy = y - closestY;
    return dx * dx + dy * dy <= radius * radius;
  });
}

function computeSafeMoveTarget(targetX, targetY) {
  const robot = getRobotController();
  if (!robot) {
    return { x: targetX, y: targetY, hitObstacle: false };
  }

  const dx = targetX - robot.position.x;
  const dy = targetY - robot.position.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= 0) {
    return { x: robot.position.x, y: robot.position.y, hitObstacle: false };
  }

  const steps = Math.max(1, Math.ceil(distance / 4));
  let safeX = robot.position.x;
  let safeY = robot.position.y;

  for (let step = 1; step <= steps; step += 1) {
    const progress = step / steps;
    const nextX = robot.position.x + dx * progress;
    const nextY = robot.position.y + dy * progress;
    if (pointHitsObstacle(nextX, nextY)) {
      return { x: safeX, y: safeY, hitObstacle: true };
    }
    safeX = nextX;
    safeY = nextY;
  }

  return { x: safeX, y: safeY, hitObstacle: false };
}

function finishMotion(error = null) {
  const active = motionState.current;
  if (!active) {
    return;
  }

  const nextEngine = engine.value;
  const robot = getRobotController();
  if (robot) {
    robot.velocity = { x: 0, y: 0 };
    robot.targetVelocity = { x: 0, y: 0 };
    robot.angularVelocity = 0;
    robot.targetAngularVelocity = 0;
    robot.markDirty?.();
  }
  nextEngine?.renderFrame?.();

  motionState.current = null;
  if (error) {
    active.reject?.(error);
  } else {
    active.resolve?.();
  }
}

function createMotion(kind, payload) {
  if (motionState.current) {
    finishMotion(new Error("当前有动作尚未完成。"));
  }

  return new Promise((resolve, reject) => {
    motionState.current = {
      kind,
      ...payload,
      startAt: performance.now(),
      resolve,
      reject
    };
  });
}

function updateProgramMotion(now) {
  const motion = motionState.current;
  const robot = getRobotController();
  const nextEngine = engine.value;
  if (!motion || !robot) {
    return;
  }

  const progress =
    motion.durationMs <= 0 ? 1 : Math.min(1, (now - motion.startAt) / motion.durationMs);

  if (motion.kind === "move") {
    robot.position.x = motion.from.x + (motion.to.x - motion.from.x) * progress;
    robot.position.y = motion.from.y + (motion.to.y - motion.from.y) * progress;
  } else if (motion.kind === "turn") {
    robot.rotation = motion.fromRotation + (motion.toRotation - motion.fromRotation) * progress;
  }

  robot.markDirty?.();
  if (nextEngine?.scene) {
    sceneStore.syncFromEngine(nextEngine.scene);
  }
  nextEngine?.renderFrame?.();

  if (progress >= 1) {
    if (motion.kind === "move") {
      robot.position.x = motion.to.x;
      robot.position.y = motion.to.y;
    } else if (motion.kind === "turn") {
      robot.rotation = motion.toRotation;
    }

    const error = motion.completionError || null;
    finishMotion(error);
    if (error) {
      logMessage(error.message, "warning");
    }
  }
}

async function animateMove(direction, distance, speed = 40) {
  const robot = getRobotController();
  if (!robot) {
    return;
  }

  const sign = direction === "BACKWARD" ? -1 : 1;
  const targetX = robot.position.x + Math.cos(robot.rotation) * distance * sign;
  const targetY = robot.position.y + Math.sin(robot.rotation) * distance * sign;
  const safeTarget = computeSafeMoveTarget(targetX, targetY);
  const actualDistance = Math.hypot(safeTarget.x - robot.position.x, safeTarget.y - robot.position.y);
  const durationMs = actualDistance <= 0 ? 0 : Math.max(220, (distance / Math.max(speed, 1)) * 1000);

  return createMotion("move", {
    from: { x: robot.position.x, y: robot.position.y },
    to: { x: safeTarget.x, y: safeTarget.y },
    durationMs,
    completionError: safeTarget.hitObstacle ? new Error("机器人检测到障碍物，已在碰撞前停止。") : null
  });
}

async function animateTurn(direction, angle, speed = 120) {
  const robot = getRobotController();
  if (!robot) {
    return;
  }

  const sign = direction === "LEFT" ? -1 : 1;
  const deltaRad = (angle * Math.PI) / 180 * sign;
  const durationMs = Math.max(180, (angle / Math.max(speed, 1)) * 1000);

  return createMotion("turn", {
    fromRotation: robot.rotation,
    toRotation: robot.rotation + deltaRad,
    durationMs
  });
}

async function wait(seconds) {
  const robot = getRobotController();
  if (!robot) {
    return;
  }

  return createMotion("turn", {
    fromRotation: robot.rotation,
    toRotation: robot.rotation,
    durationMs: Math.max(0, seconds * 1000)
  });
}

async function stopMotion(reason = null) {
  if (!motionState.current) {
    return;
  }

  finishMotion(reason ? new Error(reason) : new Error("当前运行已停止。"));
}

function readSensor(sensorName) {
  const name = String(sensorName ?? "").trim().toUpperCase();
  const ultrasonicEntry =
    latestBySensor.ultrasonic_01 ||
    Object.values(latestBySensor).find((item) => item.sensorType === "ultrasonic");
  const infraredEntry =
    latestBySensor.infrared_01 ||
    Object.values(latestBySensor).find((item) => item.sensorType === "infrared");
  const infraredConfig =
    sensors.value.find((item) => item.sensorId === infraredEntry?.sensorId) ||
    sensors.value.find((item) => item.sensorType === "infrared") ||
    null;
  const imuEntry =
    latestBySensor.imu_01 ||
    Object.values(latestBySensor).find((item) => item.sensorType === "imu");

  if (name === "DISTANCE" || name === "ULTRASONIC" || name === "ULTRASONIC_DISTANCE") {
    if (!ultrasonicEntry || ultrasonicEntry.status === "out_of_range" || ultrasonicEntry.status === "invalid") {
      return -1;
    }
    return Number.isFinite(ultrasonicEntry.value) ? ultrasonicEntry.value : -1;
  }

  if (name === "LIGHT" || name === "INFRARED" || name === "INFRARED_ANALOG") {
    return Number.isFinite(infraredEntry?.value) ? Math.round(infraredEntry.value * 1000) : 0;
  }

  if (name === "INFRARED_DIGITAL") {
    if (!infraredEntry) {
      return 0;
    }
    if (infraredEntry.unit === "bool") {
      return infraredEntry.value ? 1 : 0;
    }
    const threshold = Number(infraredConfig?.threshold);
    const safeThreshold = Number.isFinite(threshold) ? threshold : 0.45;
    return Number(Number(infraredEntry.value) >= safeThreshold ? 1 : 0);
  }

  if (name === "TEMPERATURE") {
    return Number((24 + sensorAmbientLight.value * 10).toFixed(1));
  }

  if (name === "BATTERY") {
    return 92;
  }

  if (name === "IMU_GYRO_Z") {
    return Number.isFinite(imuEntry?.gyroZ) ? imuEntry.gyroZ : 0;
  }

  if (name === "IMU_ACCEL_X") {
    return Number.isFinite(imuEntry?.accelX) ? imuEntry.accelX : 0;
  }

  if (name === "IMU_ACCEL_Y") {
    return Number.isFinite(imuEntry?.accelY) ? imuEntry.accelY : 0;
  }

  if (name === "IMU_ROLL") {
    return Number.isFinite(imuEntry?.roll) ? imuEntry.roll : 0;
  }

  if (name === "IMU_PITCH") {
    return Number.isFinite(imuEntry?.pitch) ? imuEntry.pitch : 0;
  }

  const sensor = sensors.value.find(
    (item) =>
      item.name.toUpperCase() === name ||
      item.sensorId.toUpperCase() === name ||
      item.sensorType.toUpperCase() === name
  );
  const latest = sensor ? latestBySensor[sensor.sensorId] : null;
  if (!latest) {
    return 0;
  }

  if (Number.isFinite(latest.value)) {
    return latest.value;
  }
  if (Number.isFinite(latest.gyroZ)) {
    return latest.gyroZ;
  }
  if (Number.isFinite(latest.accelX)) {
    return latest.accelX;
  }
  if (Number.isFinite(latest.accelY)) {
    return latest.accelY;
  }

  return 0;
}

async function resetRobot() {
  await stopMotion("仿真已重置，当前运行已停止。");
  const robot = getRobotController();
  const nextEngine = engine.value;
  if (!robot) {
    return;
  }

  const resetStart = nextEngine?.scene?.gridParams?.start
    ? {
        x: Number(nextEngine.scene.gridParams.start.x ?? 100),
        y: Number(nextEngine.scene.gridParams.start.y ?? 100)
      }
    : { x: 100, y: 100 };
  robot.position = resetStart;
  robot.rotation = 0;
  robot.velocity = { x: 0, y: 0 };
  robot.targetVelocity = { x: 0, y: 0 };
  robot.angularVelocity = 0;
  robot.targetAngularVelocity = 0;
  robot.driveMode = "manual";
  robot.visible = true;
  robot.markDirty?.();
  if (nextEngine?.scene) {
    sceneStore.syncFromEngine(nextEngine.scene);
  }
  nextEngine?.renderFrame?.();

  clearChartSeries();
  clearLatestSensorData();
  scheduleSceneSync(0);
  logMessage("机器人位姿已重置。");
}

function applySensorData(nextValues = {}) {
  if ("ambientLight" in nextValues) {
    const value = Number(nextValues.ambientLight);
    if (Number.isFinite(value)) {
      sensorAmbientLight.value = Math.max(0, Math.min(1, value));
      scheduleSceneSync(0);
    }
  }
}

function getAiSceneContext() {
  const worldScene = engine.value?.scene;
  if (!worldScene) {
    return null;
  }

  const normalizePoint = (point) =>
    point
      ? {
          x: Number(point.x ?? 0),
          y: Number(point.y ?? 0)
        }
      : null;

  const normalizeGridCell = (cell) =>
    cell
      ? {
          col: Number(cell.col ?? 0),
          row: Number(cell.row ?? 0)
        }
      : null;

  const normalizeObstacle = (obstacle) => {
    const aabb = obstacle.getAABB?.() ?? null;
    const worldVertices = obstacle.getWorldVertices?.() ?? null;
    const width =
      obstacle.width ??
      (aabb ? Number(aabb.maxX) - Number(aabb.minX) : obstacle.radius != null ? obstacle.radius * 2 : null);
    const height =
      obstacle.height ??
      (aabb ? Number(aabb.maxY) - Number(aabb.minY) : obstacle.radius != null ? obstacle.radius * 2 : null);

      return {
        id: obstacle.id,
        type: obstacle.type,
        label: obstacle.label ?? null,
        center: normalizePoint(obstacle.position),
        rotation: Number(obstacle.rotation ?? 0),
        static: obstacle.isStatic !== false,
        radius: obstacle.radius ?? null,
        size: {
          width: width != null ? Number(width) : null,
          height: height != null ? Number(height) : null
        },
        aabb: aabb
          ? {
              minX: Number(aabb.minX),
              maxX: Number(aabb.maxX),
            minY: Number(aabb.minY),
            maxY: Number(aabb.maxY)
          }
        : null,
      vertices: Array.isArray(worldVertices)
        ? worldVertices.map((vertex) => ({
            x: Number(vertex.x),
            y: Number(vertex.y)
          }))
        : null
    };
  };

  const robot = worldScene.robot;
  const readableSensors = {
    ULTRASONIC: readSensor("ULTRASONIC"),
    INFRARED_ANALOG: readSensor("INFRARED_ANALOG"),
    INFRARED_DIGITAL: readSensor("INFRARED_DIGITAL"),
    IMU_GYRO_Z: readSensor("IMU_GYRO_Z"),
    IMU_ACCEL_X: readSensor("IMU_ACCEL_X"),
    IMU_ACCEL_Y: readSensor("IMU_ACCEL_Y"),
    IMU_ROLL: readSensor("IMU_ROLL"),
    IMU_PITCH: readSensor("IMU_PITCH")
  };

  const normalizedObstacles = worldScene.obstacles.map(normalizeObstacle);
  const gridGraph = worldScene.gridParams?.gridGraph ?? null;
  const occupancy =
    gridGraph && Number(worldScene.gridParams?.cols) > 0 && Number(worldScene.gridParams?.rows) > 0
      ? Array.from({ length: Number(worldScene.gridParams.rows) }, (_, rowIndex) =>
          Array.from({ length: Number(worldScene.gridParams.cols) }, (_, colIndex) => {
            const topBlocked = rowIndex === 0 || Boolean(gridGraph.hWalls?.[rowIndex - 1]?.[colIndex]);
            const bottomBlocked =
              rowIndex === Number(worldScene.gridParams.rows) - 1 || Boolean(gridGraph.hWalls?.[rowIndex]?.[colIndex]);
            const leftBlocked = colIndex === 0 || Boolean(gridGraph.vWalls?.[rowIndex]?.[colIndex - 1]);
            const rightBlocked =
              colIndex === Number(worldScene.gridParams.cols) - 1 || Boolean(gridGraph.vWalls?.[rowIndex]?.[colIndex]);

            return {
              col: colIndex,
              row: rowIndex,
              walls: {
                top: topBlocked,
                right: rightBlocked,
                bottom: bottomBlocked,
                left: leftBlocked
              }
            };
          })
        )
      : null;

  return {
    layoutName: "集成仿真场景",
    coordinateSystem: {
      type: "2d_canvas",
      origin: "top_left",
      positiveX: "right",
      positiveY: "down",
      rotationUnit: "radian",
      rotationZeroDirection: "positive_x",
      movementFormula: "x += cos(theta) * distance, y += sin(theta) * distance"
    },
    world: { ...worldScene.world },
    robot: {
      id: robot.id,
      position: {
        x: Number(robot.position.x),
        y: Number(robot.position.y)
      },
      rotationRad: Number(robot.rotation),
      rotationDeg: Number((robot.rotation * 180) / Math.PI),
      headingVector: {
        x: Number(Math.cos(robot.rotation)),
        y: Number(Math.sin(robot.rotation))
      },
      radius: Number(robot.radius ?? 0),
      visible: Boolean(robot.visible),
      velocity: {
        x: Number(robot.velocity?.x ?? 0),
        y: Number(robot.velocity?.y ?? 0)
      },
      targetVelocity: {
        x: Number(robot.targetVelocity?.x ?? 0),
        y: Number(robot.targetVelocity?.y ?? 0)
      },
      angularVelocity: Number(robot.angularVelocity ?? 0),
      targetAngularVelocity: Number(robot.targetAngularVelocity ?? 0),
      sensorData: {
        light: Number(robot.sensorData?.light ?? 0),
        sound: Number(robot.sensorData?.sound ?? 0),
        collision: { ...(robot.sensorData?.collision ?? {}) },
        proximity: { ...(robot.sensorData?.proximity ?? {}) },
        lineDetected: Boolean(robot.sensorData?.lineDetected),
        linePosition: robot.sensorData?.linePosition
          ? { ...robot.sensorData.linePosition }
          : null
      },
      aabb: robot.getAABB?.() ?? null
    },
    map: {
      kind: worldScene.lineTrack ? "lineTrack" : worldScene.gridParams ? "gridMap" : "obstacleLayout",
      units: {
        distance: "px",
        angle: "rad"
      },
      obstacleCount: normalizedObstacles.length,
      obstacles: normalizedObstacles,
      lineTrack: worldScene.lineTrack
        ? {
            type: "lineTrack",
            trackWidth: Number(worldScene.lineTrack.trackWidth ?? 0),
            closed: Boolean(worldScene.lineTrack.closed),
            start: Array.isArray(worldScene.lineTrack.controlPoints) && worldScene.lineTrack.controlPoints.length
              ? normalizePoint(worldScene.lineTrack.controlPoints[0])
              : null,
            controlPointCount: Array.isArray(worldScene.lineTrack.controlPoints)
              ? worldScene.lineTrack.controlPoints.length
              : 0,
            segmentCount: Array.isArray(worldScene.lineTrack.pathSegments)
              ? worldScene.lineTrack.pathSegments.length
              : 0
          }
        : null,
      grid: worldScene.gridParams
        ? {
            type: String(worldScene.gridParams.mapType ?? "gridMap"),
            cols: Number(worldScene.gridParams.cols ?? 0),
            rows: Number(worldScene.gridParams.rows ?? 0),
            cellW: Number(worldScene.gridParams.cellW ?? 0),
            cellH: Number(worldScene.gridParams.cellH ?? 0),
            start: normalizePoint(worldScene.gridParams.start),
            startCell: normalizeGridCell(worldScene.gridParams.startCell),
            seed: worldScene.gridParams.seed ?? null,
            occupancy
          }
        : null,
      mazeExit: worldScene.mazeExit
        ? {
            position: normalizePoint(worldScene.mazeExit.pos),
            cell: worldScene.mazeExit.cell ? { ...worldScene.mazeExit.cell } : null,
            cellW: Number(worldScene.mazeExit.cellW ?? 0),
            cellH: Number(worldScene.mazeExit.cellH ?? 0)
          }
        : null
    },
    readableSensors,
    installedSensors: sensors.value.map((sensor) => ({
      ...sensor,
      latest: latestBySensor[sensor.sensorId] ?? null
    }))
  };
}

function addSensor(sensorType) {
  sendSensorBackendMessage("sensor_add", {
    sensorType,
    name: `新建${SENSOR_LABELS[sensorType] || sensorType}`
  });
}

function updateSensor(patch) {
  sendSensorBackendMessage("sensor_update", sensorToBackend(patch));
}

function removeSensor(sensorId) {
  delete latestBySensor[sensorId];
  sendSensorBackendMessage("sensor_remove", { sensorId });
}

function resetSensorDefaults(sensorId) {
  sendSensorBackendMessage("sensor_reset_defaults", { sensorId });
}

function resetSensorLogs() {
  logs.value = [];
  persistLocalState();
}

function exportLogs() {
  const text = logs.value
    .slice()
    .reverse()
    .map(
      (item) =>
        `${new Date(item.timestamp).toLocaleString("zh-CN", { hour12: false })}\t${item.payload.level}\t${item.payload.message}\t${item.payload.sensorId || ""}`
    )
    .join("\n");
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "sensor-logs.txt";
  anchor.click();
  URL.revokeObjectURL(url);
}

function resetWorld() {
  if (sendSensorBackendMessage("simulation_stop", {})) {
    sensorBackendStatus.value = "已停止";
  }
  sendSensorBackendMessage("reset_scene", {});
  reset();
  clearScene();
  const nextEngine = engine.value;
  if (nextEngine) {
    nextEngine.scene.robot.visible = true;
    nextEngine.scene.robot.position = { x: 100, y: 100 };
    nextEngine.scene.robot.rotation = 0;
    nextEngine.scene.robot.driveMode = "manual";
  }
  clearLatestSensorData();
  clearChartSeries();
  lastSceneSyncPayload = "";
  scheduleSceneSync(0);
  logMessage("世界场景已清空并重置。");
}

function startSimulation() {
  doStartSimulation();
}

function pauseSimulation() {
  if (!sensorBackendConnected.value) {
    logMessage("后端传感器仿真服务未连接，无法暂停模拟。", "error");
    return;
  }
  if (!sendSensorBackendMessage("simulation_pause", {})) {
    logMessage("暂停模拟失败，后端传感器仿真服务暂不可用。", "error");
    return;
  }
  pause();
  logMessage("已暂停模拟，传感器读数保持当前值。");
}

function helperLoop(now) {
  updateProgramMotion(now);
  if (engine.value?.scene && motionState.current) {
    syncSceneToSensorBackend();
  }
  helperFrameId = window.requestAnimationFrame(helperLoop);
}

function doStartSimulation() {
  if (!sensorBackendConnected.value) {
    logMessage("后端传感器仿真服务未连接，无法开始模拟。", "error");
    return;
  }
  window.clearTimeout(sceneSyncTimer);
  try {
    syncSceneToSensorBackend();
  } catch (error) {
    console.error("[SimulatorPanel] 启动前同步场景失败:", error);
    logMessage("启动前同步场景失败，已尝试继续开始模拟。", "warning");
  }
  const messageType = isPaused.value ? "simulation_resume" : "simulation_start";
  const sent = sendSensorBackendMessage(
    messageType,
    messageType === "simulation_start"
      ? {
          sceneId: "integrated_scene",
          speed: 1
        }
      : {}
  );
  if (!sent) {
    logMessage("开始模拟失败，后端传感器仿真服务暂不可用。", "error");
    return;
  }
  start();
  logMessage(isPaused.value ? "已继续模拟，传感器读数恢复更新。" : "已开始模拟，传感器读数开始更新。");
}

function doConfigureEngine() {
  const nextEngine = engine.value;
  if (!nextEngine) {
    return;
  }

  nextEngine.scene.robot.visible = true;
  nextEngine.scene.robot.driveMode = "manual";
  nextEngine.scene.robot.color = "#0f766e";
  nextEngine.scene.robot.maxSpeed = 240;
  nextEngine.scene.robot.acceleration = 540;
  nextEngine.scene.robot.deceleration = 820;
  syncRobotSensorVisuals();
  nextEngine.renderFrame?.();
  scheduleSceneSync(0);
  logMessage("机器人世界已就绪，开始模拟后传感器读数才会变化。");
}

onMounted(() => {
  restoreLocalState();
  syncRobotSensorVisuals();
  restoreSensorConfigPopoverSize();
  restoreSensorConfigPopoverPosition();
  charts.ultrasonic = echarts.init(ultrasonicChartMountRef.value, null, { renderer: "canvas" });
  charts.infrared = echarts.init(infraredChartMountRef.value, null, { renderer: "canvas" });
  charts.imu = echarts.init(imuChartMountRef.value, null, { renderer: "canvas" });
  scheduleChartRefresh({ resize: true });
  window.setTimeout(() => {
    scheduleChartRefresh({ resize: true });
  }, 0);
  removeEntityDragSyncListener = EventBus.on(EVENTS.INPUT_ENTITY_DRAGGED, () => {
    if (engine.value?.scene) {
      syncSceneToSensorBackend();
    }
  });
  connectSensorBackend();
  helperFrameId = window.requestAnimationFrame(helperLoop);
  window.addEventListener("resize", handleSensorConfigWindowResize);
});

onBeforeUnmount(() => {
  stopSensorConfigDrag();
  stopSensorConfigResize();
  finishMotion();
  window.cancelAnimationFrame(helperFrameId);
  Object.keys(charts).forEach((key) => {
    charts[key]?.dispose?.();
    charts[key] = null;
  });
  if (chartRefreshFrameId) {
    window.cancelAnimationFrame(chartRefreshFrameId);
    chartRefreshFrameId = 0;
  }
  removeEntityDragSyncListener?.();
  removeEntityDragSyncListener = null;
  persistLocalState();
  pause();
  shouldReconnectSensorBackend = false;
  window.clearTimeout(sensorReconnectTimer);
  window.clearTimeout(sceneSyncTimer);
  sensorSocket?.close();
  window.removeEventListener("resize", handleSensorConfigWindowResize);
});

watch(
  engine,
  (value) => {
    if (value) {
      doConfigureEngine();
    }
  },
  { immediate: true }
);

watch(
  sensors,
  () => {
    persistLocalState();
    syncRobotSensorVisuals();
  },
  { deep: true }
);

watch(
  logs,
  () => {
    persistLocalState();
  },
  { deep: true }
);

watch(sensorAmbientLight, () => {
  persistLocalState();
  scheduleSceneSync(0);
});

watch(
  () => [
    engine.value?.scene?.robot.position.x,
    engine.value?.scene?.robot.position.y,
    engine.value?.scene?.robot.rotation,
    engine.value?.scene?.obstacles.length,
    sceneWidth.value,
    sceneHeight.value
  ],
  () => {
    scheduleSceneSync(0);
  }
);

defineExpose({
  animateMove,
  animateTurn,
  wait,
  stopMotion,
  readSensor,
  resetRobot,
  applySensorData,
  getAiSceneContext,
  exportLogs,
  resetSensorLogs,
  logs
});
</script>

<template>
  <section class="panel simulator-shell">
    <header class="panel-header simulator-header">
      <div>
        <h2>机器人世界与传感器工作区</h2>
        <p>脚本负责控制小车，机器人世界负责地图与障碍物，传感器模块负责读数与参数。</p>
      </div>
      <div class="header-badges">
        <button class="secondary mini-btn" :disabled="isSimulationActive" @click="doStartSimulation">开始模拟</button>
        <button
          ref="sensorConfigButtonRef"
          class="secondary mini-btn"
          :class="{ active: showSensorConfig }"
          @click.stop="toggleSensorConfig"
        >
          传感器配置
        </button>
        <button class="secondary mini-btn" :disabled="!isSimulationActive" @click="pauseSimulation">暂停模拟</button>
        <span class="chip">位姿 {{ robotPose }}</span>
        <span class="chip">障碍物 {{ obstacleList.length }}</span>
        <span class="chip">传感器 {{ sensors.length }}</span>
      </div>
    </header>

    <div class="simulator-grid" :class="{ 'editor-mode': isEditorMode }">
      <section class="world-pane">
        <div v-if="isEditorMode" class="world-toolbar">
          <div class="tool-row">
            <button class="secondary mini-btn" :class="{ active: currentTool === 'select' }" @click="setTool('select')">选择</button>
            <button class="secondary mini-btn" :class="{ active: currentTool === 'rect' }" @click="setTool('rect')">矩形障碍</button>
            <button class="secondary mini-btn" :class="{ active: currentTool === 'circle' }" @click="setTool('circle')">圆形障碍</button>
            <button class="secondary mini-btn" :class="{ active: currentTool === 'polygon' }" @click="setTool('polygon')">多边形障碍</button>
          </div>
          <div class="tool-row">
            <button class="secondary mini-btn" @click="saveScene('scene.json')">保存场景</button>
            <button class="secondary mini-btn" @click="loadScene()">加载场景</button>
            <button class="secondary mini-btn" @click="resetWorld()">清空世界</button>
          </div>
        </div>

        <section v-if="isEditorMode" class="panel mapgen-panel">
          <div class="sub-head">
            <div>
              <h3>地图生成</h3>
              <p>快速生成巡线、栅格和迷宫场景。</p>
            </div>
          </div>
          <MapGenControls />
        </section>

        <div class="world-stage">
          <WorldCanvas />
        </div>

        <div v-if="isEditorMode" class="world-meta">
          <label>
            场景宽度
            <input :value="sceneWidth" type="number" min="200" max="3000" step="10" @change="updateWorldSize(Number($event.target.value), sceneHeight)" />
          </label>
          <label>
            场景高度
            <input :value="sceneHeight" type="number" min="200" max="3000" step="10" @change="updateWorldSize(sceneWidth, Number($event.target.value))" />
          </label>
          <label>
            传感器环境光
            <input v-model.number="sensorAmbientLight" type="range" min="0" max="1" step="0.01" />
          </label>
        </div>

        <div v-if="isEditorMode && isObstacleSelected" class="world-editor panel">
          <div class="sub-head">
            <h3>障碍物属性</h3>
            <span class="chip">{{ selectedEntityId }}</span>
          </div>
          <ObstacleEditor :entity-id="selectedEntityId" />
        </div>
      </section>

    </div>

    <div class="bottom-grid" :class="{ 'editor-mode': isEditorMode }">
      <section class="panel chart-panel">
        <div class="sub-head">
          <div>
            <h3>实时曲线</h3>
            <p>传感器采样结果来自整合项目中的本地传感器模块。</p>
          </div>
          <button class="secondary mini-btn" @click="clearChartSeries()">清空曲线</button>
        </div>
        <div class="chart-grid">
          <div class="chart-card">
            <div ref="infraredChartMountRef" class="chart-view" />
          </div>
          <div class="chart-card">
            <div ref="ultrasonicChartMountRef" class="chart-view" />
          </div>
          <div class="chart-card">
            <div ref="imuChartMountRef" class="chart-view" />
          </div>
        </div>
      </section>
    </div>

    <Teleport to="body">
      <div v-if="showSensorConfig" class="sensor-config-layer" :style="{ zIndex: sensorConfigPopoverZIndex }">
        <div
          ref="sensorConfigPopoverRef"
          class="sensor-config-popover"
          @pointerdown="bringSensorConfigToFront"
          :style="{
            zIndex: sensorConfigPopoverZIndex,
            width: `${sensorConfigPopoverSize.width}px`,
            height: `${sensorConfigPopoverSize.height}px`,
            left: `${sensorConfigPopoverPosition.left}px`,
            top: `${sensorConfigPopoverPosition.top}px`
          }"
        >
          <div class="sensor-config-head" @pointerdown.stop.prevent="startSensorConfigDrag">
            <strong>传感器配置</strong>
            <button class="secondary mini-btn" @click="closeSensorConfig">关闭</button>
          </div>
          <SensorPanelZh
            :sensors="sensors"
            @add="addSensor"
            @update="updateSensor"
            @remove="removeSensor"
            @reset-defaults="resetSensorDefaults"
          />
          <button
            class="sensor-config-resize-handle"
            aria-label="调整传感器配置窗口大小"
            @pointerdown.stop.prevent="startSensorConfigResize"
          />
        </div>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
.simulator-shell {
  padding-bottom: 16px;
}

.simulator-header {
  align-items: flex-start;
}

.header-badges,
.tool-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.simulator-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  padding: 0 12px 16px;
}

.simulator-grid.editor-mode {
  grid-template-columns: minmax(0, 1fr);
}

.world-pane {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.world-toolbar,
.world-meta,
.bottom-grid {
  display: grid;
  gap: 10px;
}

.world-toolbar {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.world-stage {
  display: flex;
  align-items: stretch;
  height: clamp(480px, 58vh, 760px);
  width: 100%;
  overflow: hidden;
  border-radius: 18px;
  border: 1px solid var(--panel-border);
  background: #0d0d1a;
}

.world-stage :deep(.world-canvas-wrapper) {
  width: 100%;
  height: 100%;
}

.world-stage :deep(.main-canvas) {
  width: 100%;
  height: 100%;
}

.world-meta {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.world-editor,
.mapgen-panel,
.chart-panel {
  padding: 14px;
}

.sub-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 10px;
}

.sub-head h3 {
  margin: 0;
}

.sub-head p {
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 0.84rem;
}

.bottom-grid {
  grid-template-columns: minmax(0, 1fr);
  padding: 0 12px;
}

.bottom-grid.editor-mode {
  grid-template-columns: minmax(0, 1fr);
}

.chart-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.chart-card {
  min-width: 0;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.52);
  padding: 8px;
}

.chart-view {
  width: 100%;
  height: 260px;
}

@media (max-width: 1180px) {
  .chart-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .chart-view {
    height: 240px;
  }
}

.sensor-config-layer {
  position: fixed;
  inset: 0;
  z-index: 45;
  pointer-events: none;
}

.sensor-config-popover {
  position: absolute;
  pointer-events: auto;
}

.sensor-config-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--panel-border);
  border-bottom: 0;
  border-radius: 18px 18px 0 0;
  background: linear-gradient(140deg, rgba(248, 251, 255, 0.98), rgba(231, 240, 252, 0.94));
  box-shadow: var(--shadow);
  cursor: move;
  user-select: none;
  touch-action: none;
}

.sensor-config-head strong {
  color: var(--text);
  font-size: 0.95rem;
}

.sensor-config-popover :deep(.sensor-panel) {
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  min-width: 0;
  max-width: none;
  max-height: none;
  height: calc(100% - 56px);
  box-shadow: var(--shadow);
}

.sensor-config-resize-handle {
  position: absolute;
  right: 6px;
  bottom: 6px;
  width: 18px;
  height: 18px;
  border: 0;
  border-radius: 6px;
  background:
    linear-gradient(135deg, transparent 0 42%, rgba(90, 107, 130, 0.9) 42% 52%, transparent 52% 62%, rgba(90, 107, 130, 0.78) 62% 72%, transparent 72%);
  cursor: nwse-resize;
  opacity: 0.8;
}

.mini-btn.active {
  color: #fff;
  background: linear-gradient(135deg, var(--accent), #0ea5a3);
}

.danger-btn {
  color: var(--danger);
}

.empty-state {
  color: var(--muted);
}

label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: var(--muted);
  font-size: 0.84rem;
}

input {
  font: inherit;
}

input[type="text"],
input[type="number"] {
  border: 1px solid var(--panel-border);
  border-radius: 10px;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.82);
  color: var(--text);
}

@media (max-width: 1260px) {
  .simulator-grid,
  .bottom-grid,
  .world-toolbar,
  .world-meta {
    grid-template-columns: 1fr;
  }

  .world-stage {
    height: 520px;
  }
}

@media (max-width: 780px) {
  .sensor-config-popover {
    max-width: calc(100vw - 24px);
    max-height: calc(100vh - 24px);
  }
}
</style>
