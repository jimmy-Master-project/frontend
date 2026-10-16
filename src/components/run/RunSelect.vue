<template>
  <div class="run-select">
    <span class="label">Run</span>
    <el-select
      :model-value="modelValue ?? ''"
      :loading="loading"
      placeholder="Latest run"
      class="select"
      @update:model-value="(value: string) => emit('update:modelValue', value || null)"
    >
      <el-option label="Latest run" value="" />
      <el-option v-for="run in runs" :key="run.id" :label="optionLabel(run)" :value="String(run.id)">
        <div class="option">
          <span>{{ optionLabel(run) }}</span>
          <el-tag size="small" :type="run.status === 'completed' ? 'success' : run.status === 'failed' ? 'danger' : 'warning'">
            {{ run.status }}
          </el-tag>
        </div>
      </el-option>
    </el-select>
    <el-button text @click="router.push({ name: 'run-history', params: { evaluationId } })">Compare runs</el-button>
  </div>
</template>

<script setup lang="ts">
/** Picks which run of an evaluation a results page shows (null = latest). */
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { runApi } from '@/services/runApi'
import type { RunStatus } from '@/types'

const props = defineProps<{ evaluationId: string; modelValue: string | null }>()
const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>()
const router = useRouter()

const runs = ref<RunStatus[]>([])
const loading = ref(false)

function optionLabel(run: RunStatus) {
  const model = run.llmSnapshot?.modelName || (run.external ? 'External bot' : 'unknown model')
  return `#${run.id} · ${run.label || model}${run.label ? ` (${model})` : ''}`
}

async function load() {
  loading.value = true
  try {
    runs.value = await runApi.listRuns(props.evaluationId)
  } catch {
    runs.value = []
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => props.evaluationId, load)
</script>

<style scoped>
.run-select { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; }
.label { color: var(--el-text-color-secondary); font-size: 13px; }
.select { width: min(420px, 100%); }
.option { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
</style>
