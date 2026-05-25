<template>
  <div class="app-layout">
    <header class="top-bar">
      <div class="top-bar-brand">
        <span class="brand-name">ROBOT <span class="brand-accent">WORLD</span></span>
        <span class="brand-ver">SCENE EDITOR</span>
      </div>
      <div class="top-bar-scan" />
    </header>

    <div class="app-body">
      <ToolSidebar class="layout-sidebar" />
      <WorldCanvas class="layout-canvas" />
      <PropertyPanel class="layout-panel" />
    </div>
  </div>
</template>

<script setup>
import ToolSidebar from '@components/layout/ToolSidebar.vue'
import WorldCanvas from '@components/canvas/WorldCanvas.vue'
import PropertyPanel from '@components/layout/PropertyPanel.vue'
</script>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: linear-gradient(180deg, #edf4fb 0%, #dfeaf7 100%);
}

.top-bar {
  flex-shrink: 0;
  height: 40px;
  background: var(--panel);
  border-bottom: 1px solid var(--panel-border);
  display: flex;
  align-items: center;
  padding: 0 20px 0 14px;
  position: relative;
  overflow: hidden;
  gap: 16px;
}

.top-bar::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(15, 116, 144, 0.12) 30%,
    rgba(37, 99, 235, 0.08) 60%,
    transparent 100%
  );
}

.top-bar-scan {
  position: absolute;
  top: 0;
  left: -100%;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.28) 50%,
    transparent 100%
  );
  width: 60%;
  animation: scan-anim 8s linear infinite;
  pointer-events: none;
}

@keyframes scan-anim {
  0% {
    transform: translateX(-50%);
  }

  100% {
    transform: translateX(350%);
  }
}

.top-bar-brand {
  display: flex;
  align-items: center;
  gap: 8px;
}

.brand-name {
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 3px;
  color: var(--text);
  text-transform: uppercase;
  font-family: 'Segoe UI', system-ui, sans-serif;
}

.brand-accent {
  color: var(--accent);
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.35);
}

.brand-ver {
  font-size: 10px;
  color: var(--muted);
  letter-spacing: 1.5px;
  font-family: monospace;
}

.app-body {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}

.layout-sidebar {
  flex-shrink: 0;
}

.layout-canvas {
  flex: 1;
  min-width: 0;
}

.layout-panel {
  flex-shrink: 0;
}
</style>
