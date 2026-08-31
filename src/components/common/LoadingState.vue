<template>
  <div class="loading-state">
    <el-icon class="is-loading" :size="28"><Loading /></el-icon>
    <p v-if="text">{{ text }}</p>
  </div>
</template>

<script setup lang="ts">
import { Loading } from '@element-plus/icons-vue'

defineProps<{ text?: string }>()
</script>

<style scoped>
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px 0;
  color: var(--el-text-color-secondary);
}
</style>
