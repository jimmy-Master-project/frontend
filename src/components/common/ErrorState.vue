<template>
  <div class="error-state">
    <el-icon :size="28" color="var(--el-color-danger)"><WarningFilled /></el-icon>
    <p>{{ message }}</p>
    <el-button v-if="retryable" type="primary" @click="$emit('retry')">Try Again</el-button>
  </div>
</template>

<script setup lang="ts">
import { WarningFilled } from '@element-plus/icons-vue'

withDefaults(defineProps<{ message: string; retryable?: boolean }>(), {
  retryable: true,
})
defineEmits<{ retry: [] }>()
</script>

<style scoped>
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px 0;
  color: var(--el-text-color-secondary);
}
</style>
