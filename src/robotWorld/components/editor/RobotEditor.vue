<template>
  <div class="editor-section">
    <div class="section-title">机器人</div>

    <div class="field-row">
      <label>X</label>
      <input
        type="number"
        step="1"
        class="field-input"
        :value="Math.round(robot.position?.x ?? 0)"
        @change="patchRobot({ position: { x: +$event.target.value, y: robot.position?.y ?? 0 } })"
      />
    </div>

    <div class="field-row">
      <label>Y</label>
      <input
        type="number"
        step="1"
        class="field-input"
        :value="Math.round(robot.position?.y ?? 0)"
        @change="patchRobot({ position: { x: robot.position?.x ?? 0, y: +$event.target.value } })"
      />
    </div>

    <div class="field-row">
      <label>朝向</label>
      <input
        type="number"
        step="1"
        min="-180"
        max="180"
        class="field-input"
        :value="Math.round(((robot.rotation ?? 0) * 180) / Math.PI)"
        @change="patchRobot({ rotation: (+$event.target.value * Math.PI) / 180 })"
      />
      <span class="unit">deg</span>
    </div>

    <div class="field-row">
      <label>半径</label>
      <input
        type="number"
        step="1"
        min="5"
        max="80"
        class="field-input"
        :value="robot.radius ?? 18"
        @change="patchRobot({ radius: +$event.target.value })"
      />
      <span class="unit">px</span>
    </div>

    <div class="field-row">
      <label>颜色</label>
      <input
        type="color"
        class="field-color"
        :value="robot.color ?? '#00ff88'"
        @input="patchRobot({ color: $event.target.value })"
      />
    </div>

  </div>
</template>

<script setup>
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useSceneStore } from "@store/sceneStore";
import { useWorldEngine } from "@composables/useWorldEngine";

const sceneStore = useSceneStore();
const { robotInfo } = storeToRefs(sceneStore);
const { engine } = useWorldEngine();

const robot = computed(() => robotInfo.value || {});

function patchRobot(patch) {
  if (engine.value?.scene) {
    engine.value.scene.updateRobot(patch);
    sceneStore.syncFromEngine(engine.value.scene);
    engine.value.renderFrame?.();
  }
}
</script>

<style scoped>
.editor-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-title {
  font-size: 10px;
  font-weight: 700;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 1.2px;
  margin-top: 6px;
  margin-bottom: 3px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.section-title::after {
  content: "";
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, rgba(15, 116, 144, 0.14), transparent);
}

.field-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.field-row label:first-child {
  font-size: 12px;
  color: var(--muted);
  width: 72px;
  flex-shrink: 0;
}

.field-input {
  flex: 1;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 6px;
  color: var(--text);
  font-size: 12px;
  padding: 5px 8px;
  outline: none;
  min-width: 0;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.field-input:focus {
  border-color: rgba(15, 116, 144, 0.34);
  box-shadow: 0 0 0 2px rgba(15, 116, 144, 0.08);
}

.unit {
  font-size: 11px;
  color: var(--muted);
  flex-shrink: 0;
}

.field-color {
  width: 34px;
  height: 28px;
  padding: 2px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
}

</style>
