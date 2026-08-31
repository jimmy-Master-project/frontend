<template>
  <el-card class="evaluation-summary" shadow="never">
    <div class="summary-header">
      <div class="summary-fields">
        <div class="field">
          <span class="label">Project</span>
          <span class="value">{{ name }}</span>
        </div>
        <div class="field">
          <span class="label">Use Case</span>
          <span class="value">{{ useCaseDescription }}</span>
        </div>
        <div class="field">
          <span class="label">Task Type</span>
          <el-tag>{{ taskTypeLabel }}</el-tag>
        </div>
      </div>
      <el-button @click="$emit('edit')">Edit Use Case</el-button>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { TASK_TYPE_OPTIONS, type TaskType } from '@/types'

const props = defineProps<{
  name: string
  useCaseDescription: string
  taskType: TaskType
}>()

defineEmits<{ edit: [] }>()

const taskTypeLabel = computed(
  () => TASK_TYPE_OPTIONS.find(opt => opt.value === props.taskType)?.label ?? props.taskType,
)
</script>

<style scoped>
.evaluation-summary {
  margin-bottom: 24px;
}
.summary-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}
.summary-fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.value {
  font-size: 14px;
  color: var(--el-text-color-primary);
  white-space: pre-wrap;
}
</style>
