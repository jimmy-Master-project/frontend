<template>
  <div class="dashboard-view">
    <div class="page-header">
      <h2>LLM Evaluation Projects</h2>
       <div class="header-actions">
         <el-button @click="router.push('/benchmark-validation')">Dataset Validation</el-button>
         <el-button type="primary" @click="router.push('/evaluations/new')">+ New Evaluation</el-button>
       </div>
    </div>

    <LoadingState v-if="store.listLoading" text="Loading evaluations..." />
    <ErrorState v-else-if="store.error" :message="store.error" @retry="load" />
    <el-table v-else :data="store.evaluations" style="width: 100%" empty-text="No evaluations yet.">
      <el-table-column prop="name" label="Name" />
      <el-table-column label="Task Type">
        <template #default="{ row }">{{ taskTypeLabel(row.taskType) }}</template>
      </el-table-column>
      <el-table-column prop="promptCount" label="Prompt Count" align="right" width="140" />
      <el-table-column label="Status" width="170">
        <template #default="{ row }">
          <el-tag :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="Created" width="140">
        <template #default="{ row }">{{ row.createdAt }}</template>
      </el-table-column>
      <el-table-column label="" width="160">
        <template #default="{ row }">
          <el-button text type="primary" @click="openEvaluation(row)">Open</el-button>
          <el-button text type="danger" @click="confirmDelete(row)">Delete</el-button>
        </template>
      </el-table-column>
    </el-table>

    <ConfirmDialog
      v-model="deleteDialogVisible"
      title="Delete this evaluation?"
      message="This action cannot be undone."
      confirm-text="Delete"
      danger
      @confirm="handleDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import ErrorState from '@/components/common/ErrorState.vue'
import LoadingState from '@/components/common/LoadingState.vue'
import { evaluationPath } from '@/services/evaluationApi'
import { useEvaluationStore } from '@/stores/evaluation'
import { TASK_TYPE_OPTIONS, type Evaluation, type EvaluationStatus } from '@/types'

const store = useEvaluationStore()
const router = useRouter()

const deleteDialogVisible = ref(false)
const pendingDelete = ref<Evaluation | null>(null)

function load() {
  store.fetchEvaluations().catch(() => {})
}

onMounted(load)

function taskTypeLabel(taskType: string) {
  return TASK_TYPE_OPTIONS.find(opt => opt.value === taskType)?.label ?? taskType
}

const statusLabels: Record<EvaluationStatus, string> = {
  draft: 'Draft',
  generating_prompts: 'Generating Prompts',
  prompt_ready: 'Prompt Ready',
  ready: 'Ready',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
}

function statusLabel(status: EvaluationStatus) {
  return statusLabels[status] ?? status
}

function statusTagType(status: EvaluationStatus) {
  switch (status) {
    case 'completed':
      return 'success'
    case 'failed':
      return 'danger'
    case 'running':
      return 'warning'
    default:
      return 'info'
  }
}

function openEvaluation(evaluation: Evaluation) {
  router.push(evaluationPath(evaluation))
}

function confirmDelete(evaluation: Evaluation) {
  pendingDelete.value = evaluation
  deleteDialogVisible.value = true
}

async function handleDelete() {
  if (!pendingDelete.value) return
  await store.deleteEvaluation(pendingDelete.value.id)
  deleteDialogVisible.value = false
}
</script>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.header-actions { display: flex; gap: 8px; }
</style>
