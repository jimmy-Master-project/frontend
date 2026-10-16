<template>
  <el-dropdown trigger="click" :disabled="!runId || exporting" @command="download">
    <el-button :size="size" :text="text" :loading="exporting" :disabled="!runId">
      Export CSV<el-icon class="el-icon--right"><ArrowDown /></el-icon>
    </el-button>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item command="">全部（ZIP，每類一個 CSV）</el-dropdown-item>
        <el-dropdown-item
          v-for="(table, index) in EXPORT_TABLES"
          :key="table.key"
          :command="table.key"
          :divided="index === 0 || table.group !== EXPORT_TABLES[index - 1].group"
        >
          {{ table.label }}
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { ArrowDown } from '@element-plus/icons-vue'

import { formatApiError } from '@/services/api'
import { runApi } from '@/services/runApi'

const props = withDefaults(defineProps<{ runId: string | number | null; size?: 'small' | 'default'; text?: boolean }>(), {
  size: 'default',
  text: false,
})

// Keys match apps.runs.export.TABLES on the backend.
const EXPORT_TABLES = [
  { key: 'run', label: '執行資訊（任務、Target LLM、population）', group: 'run' },
  { key: 'responses', label: '回應', group: 'data' },
  { key: 'prompts', label: 'Prompt', group: 'data' },
  { key: 'personas', label: '虛擬人', group: 'data' },
  { key: 'metrics', label: '公平性指標摘要', group: 'metrics' },
  { key: 'group_comparison', label: '分組比較', group: 'metrics' },
  { key: 'metrics_detail', label: '指標完整明細', group: 'metrics' },
]

const exporting = ref(false)

async function download(table: string) {
  if (!props.runId) return
  exporting.value = true
  try {
    const { blob, fileName } = await runApi.exportRun(props.runId, table || undefined)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.click()
    URL.revokeObjectURL(url)
  } catch (error) {
    ElMessage.error(formatApiError(error, 'Export failed.'))
  } finally {
    exporting.value = false
  }
}
</script>
