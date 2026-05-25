<template>
  <AppLayout />
</template>

<script setup>
import AppLayout from '@components/layout/AppLayout.vue'
</script>

<style>
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body, #app {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #080818;
  color: #c8d8ff;
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  font-size: 14px;
}

/* 全局选区颜色 */
::selection {
  background: rgba(79, 195, 247, 0.3);
  color: #fff;
}

input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
  opacity: 0.4;
}

::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}
::-webkit-scrollbar-track {
  background: #0a0a1a;
}
::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, #4fc3f7, #7850ff);
  border-radius: 2px;
}
::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, #7ad8ff, #9970ff);
}
</style>
