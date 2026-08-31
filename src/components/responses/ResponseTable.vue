<template>
  <el-table :data="responses" style="width: 100%" @row-click="(row: ResponseItem) => $emit('select', row)">
    <el-table-column label="Prompt">
      <template #default="{ row }">{{ truncate(row.promptText) }}</template>
    </el-table-column>
    <el-table-column label="Response">
      <template #default="{ row }">{{ truncate(row.response) }}</template>
    </el-table-column>
    <el-table-column label="Generation" width="120" align="right">
      <template #default="{ row }">{{ row.generationIndex }}</template>
    </el-table-column>
  </el-table>
</template>

<script setup lang="ts">
import type { ResponseItem } from '@/types'

defineProps<{ responses: ResponseItem[] }>()
defineEmits<{ select: [item: ResponseItem] }>()

function truncate(text: string, length = 80) {
  if (text.length <= length) return text
  return `${text.slice(0, length)}...`
}
</script>

<style scoped>
:deep(.el-table__row) {
  cursor: pointer;
}
</style>
