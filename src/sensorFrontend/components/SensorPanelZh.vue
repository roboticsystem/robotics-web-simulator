<script setup>
import { ref } from "vue";

defineProps({
  sensors: {
    type: Array,
    default: () => []
  },
  hidden: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(["update", "remove", "add", "resetDefaults"]);
const SENSOR_TYPE_OPTIONS = [
  { id: "ultrasonic", label: "超声波" },
  { id: "infrared", label: "红外" },
  { id: "imu", label: "IMU" }
];
const addType = ref("ultrasonic");

function patch(sensorId, partial) {
  emit("update", { sensorId, ...partial });
}

function addSensor() {
  emit("add", addType.value);
}

function sensorTypeLabel(type) {
  const item = SENSOR_TYPE_OPTIONS.find((entry) => entry.id === type);
  return item?.label || type;
}
</script>

<template>
  <section v-show="!hidden" class="sensor-panel panel">
    <div class="head">
      <div>
        <p class="panel-title">传感器配置</p>
        <p class="desc">修改后会直接作用于当前仿真和场景搭建中的传感器。</p>
      </div>
      <div class="add-row">
        <select v-model="addType" class="sel">
          <option v-for="item in SENSOR_TYPE_OPTIONS" :key="item.id" :value="item.id">
            {{ item.label }}
          </option>
        </select>
        <button type="button" class="primary add-btn" @click="addSensor">新增</button>
      </div>
    </div>

    <div class="sensor-list">
      <article v-for="sensor in sensors" :key="sensor.sensorId" class="card">
        <div class="card-h">
          <label class="name-inp">
            名称
            <input
              type="text"
              maxlength="40"
              :value="sensor.name || ''"
              @change="patch(sensor.sensorId, { name: $event.target.value })"
            />
          </label>
          <span class="badge">{{ sensorTypeLabel(sensor.sensorType) }}</span>
          <label class="en">
            <input
              type="checkbox"
              :checked="sensor.enabled"
              @change="patch(sensor.sensorId, { enabled: $event.target.checked })"
            />
            启用
          </label>
          <button
            type="button"
            class="secondary sm"
            @click="emit('resetDefaults', sensor.sensorId)"
          >
            恢复默认
          </button>
          <button
            type="button"
            class="secondary sm danger"
            @click="emit('remove', sensor.sensorId)"
          >
            删除
          </button>
        </div>

        <template v-if="sensor.sensorType === 'ultrasonic'">
          <div class="grid2">
            <label>量程 (cm)<input type="number" min="1" max="1000" :value="sensor.rangeCm" @change="patch(sensor.sensorId, { rangeCm: +$event.target.value })" /></label>
            <label>波束角 (度)<input type="number" min="1" max="180" :value="sensor.beamDeg" @change="patch(sensor.sensorId, { beamDeg: +$event.target.value })" /></label>
            <label>采样频率 (Hz)<input type="number" min="0.5" max="100" step="0.5" :value="sensor.frequency" @change="patch(sensor.sensorId, { frequency: +$event.target.value })" /></label>
            <label>噪声系数<input type="number" min="0" max="1" step="0.01" :value="sensor.noise" @change="patch(sensor.sensorId, { noise: +$event.target.value })" /></label>
            <label>安装角 (rad)<input type="number" min="-6.283" max="6.283" step="0.01" :value="sensor.mountAngle" @change="patch(sensor.sensorId, { mountAngle: +$event.target.value })" /></label>
            <label>系统误差<input type="number" min="-1" max="1" step="0.001" :value="sensor.sysError" @change="patch(sensor.sensorId, { sysError: +$event.target.value })" /></label>
          </div>
        </template>

        <template v-else-if="sensor.sensorType === 'infrared'">
          <div class="grid2">
            <label>量程 (cm)<input type="number" min="1" max="1000" :value="sensor.rangeCm" @change="patch(sensor.sensorId, { rangeCm: +$event.target.value })" /></label>
            <label>采样频率 (Hz)<input type="number" min="0.5" max="100" step="0.5" :value="sensor.frequency" @change="patch(sensor.sensorId, { frequency: +$event.target.value })" /></label>
            <label>噪声系数<input type="number" min="0" max="1" step="0.01" :value="sensor.noise" @change="patch(sensor.sensorId, { noise: +$event.target.value })" /></label>
            <label>灵敏度<input type="number" min="0" max="5" step="0.05" :value="sensor.sensitivity" @change="patch(sensor.sensorId, { sensitivity: +$event.target.value })" /></label>
            <label>
              输出模式
              <select :value="sensor.outputMode" @change="patch(sensor.sensorId, { outputMode: $event.target.value })">
                <option value="analog">模拟量</option>
                <option value="binary">二值量</option>
              </select>
            </label>
            <label>阈值<input type="number" min="0" max="1" step="0.05" :value="sensor.threshold" @change="patch(sensor.sensorId, { threshold: +$event.target.value })" /></label>
          </div>
        </template>

        <template v-else-if="sensor.sensorType === 'imu'">
          <div class="grid2">
            <label>采样频率 (Hz)<input type="number" min="0.5" max="100" step="0.5" :value="sensor.frequency" @change="patch(sensor.sensorId, { frequency: +$event.target.value })" /></label>
            <label>角速度噪声<input type="number" min="0" max="10" step="0.01" :value="sensor.noiseGyro" @change="patch(sensor.sensorId, { noiseGyro: +$event.target.value })" /></label>
            <label>加速度噪声<input type="number" min="0" max="20" step="0.01" :value="sensor.noiseAccel" @change="patch(sensor.sensorId, { noiseAccel: +$event.target.value })" /></label>
            <label>漂移系数<input type="number" min="0" max="1" step="0.001" :value="sensor.driftCoeff" @change="patch(sensor.sensorId, { driftCoeff: +$event.target.value })" /></label>
          </div>
        </template>
      </article>
    </div>
  </section>
</template>

<style scoped>
.sensor-panel {
  padding: 14px 16px;
  min-width: min(760px, calc(100vw - 48px));
  max-width: min(900px, calc(100vw - 48px));
  max-height: min(78vh, 760px);
  overflow: auto;
}

.panel-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: var(--text);
}

.head {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 12px;
}

.desc {
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 0.82rem;
}

.add-row {
  display: flex;
  gap: 8px;
}

.sel {
  flex: 1;
  min-height: 38px;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 10px;
  padding: 8px 10px;
  color: var(--text);
}

.add-btn {
  min-width: 84px;
}

.sensor-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.card {
  border: 1px solid var(--panel-border);
  border-radius: 14px;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.58);
}

.card-h {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.name-inp {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 10px;
  color: var(--muted);
  min-width: 160px;
  flex: 1;
}

.name-inp input {
  font-weight: 600;
  color: var(--text);
}

.badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(10, 143, 132, 0.12);
  color: var(--accent);
}

.en {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  color: var(--muted);
  margin-left: auto;
}

.sm {
  padding: 0.35rem 0.6rem;
  font-size: 0.8rem;
}

.danger {
  color: var(--danger);
}

.grid2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 12px;
}

label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  color: var(--muted);
}

input,
select {
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 10px;
  padding: 7px 9px;
  color: var(--text);
  font-size: 12px;
}
</style>
