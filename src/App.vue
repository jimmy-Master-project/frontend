<template>
  <div class="app-shell">
    <header class="app-header">
      <router-link to="/" class="brand">LLM Fairness Evaluation Platform</router-link>
    </header>
    <main class="app-main">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts"></script>

<style>
body {
  margin: 0;
  font-family:
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    Roboto,
    'Helvetica Neue',
    Arial,
    sans-serif;
  background: var(--el-bg-color-page, #f5f7fa);
}

.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  background: #ffffff;
  border-bottom: 1px solid var(--el-border-color-light);
  padding: 16px 32px;
}

.brand {
  font-size: 18px;
  font-weight: 600;
  color: var(--el-color-primary);
  text-decoration: none;
}

.app-main {
  flex: 1;
  width: 100%;
  max-width: 1080px;
  margin: 0 auto;
  padding: 32px;
  box-sizing: border-box;
}
</style>
