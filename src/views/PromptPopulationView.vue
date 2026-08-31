<template>
  <div class="prompt-population-view">
    <EvaluationStepper :active="1" />

    <LoadingState v-if="initialLoading" text="Loading evaluation..." />
    <ErrorState v-else-if="loadError" :message="loadError" @retry="loadAll" />

    <template v-else>
      <EvaluationSummary
        :name="evaluationStore.name"
        :use-case-description="evaluationStore.useCaseDescription"
        :task-type="evaluationStore.taskType"
        @edit="editDialogVisible = true"
      />

      <PromptAgentConfig
        :config="agentConfig"
        :generation-status="promptStore.generationStatus"
        :population="promptStore.population"
        :prompt-count="promptStore.promptCount"
        :error="promptStore.error"
        @generate="handleGenerate"
        @regenerate="handleRegenerate"
      />

      <PromptPopulationTable
        v-if="promptStore.promptCount > 0"
        :prompts="promptStore.prompts"
        :category-stats="promptStore.categoryStats"
        :population="promptStore.population"
        @add="addDialogVisible = true"
        @view="openDetail"
        @edit="openEdit"
      />

      <div class="page-nav">
        <el-button @click="router.push('/')">Back</el-button>
        <el-button
          type="primary"
          :disabled="promptStore.promptCount === 0"
          @click="router.push(`/evaluations/${evaluationId}/llm`)"
        >
          Configure Target LLM →
        </el-button>
      </div>
    </template>

    <el-dialog v-model="editDialogVisible" title="Edit Use Case" width="560px">
      <EvaluationForm
        :model-value="{
          name: evaluationStore.name,
           useCaseDescription: evaluationStore.useCaseDescription,
           taskType: evaluationStore.taskType,
           language: evaluationStore.language,
        }"
        :loading="evaluationStore.loading"
        submit-text="Save"
        @submit="handleEditUseCase"
      />
    </el-dialog>

    <PromptDetailDialog
      v-model="detailDialogVisible"
      :prompt="selectedPrompt"
      @edit="promptToEditFromDetail"
      @delete="promptToDeleteFromDetail"
    />

    <PromptEditDialog
      v-model="editPromptDialogVisible"
      :prompt="selectedPrompt"
      :saving="promptSaving"
      @save="handleSavePrompt"
    />

    <PromptAddDialog v-model="addDialogVisible" :saving="promptSaving" @save="handleAddPrompt" />

    <ConfirmDialog
      v-model="deletePromptDialogVisible"
      title="Delete this prompt?"
      message="This action cannot be undone."
      confirm-text="Delete"
      danger
      @confirm="handleDeletePrompt"
    />
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import ErrorState from '@/components/common/ErrorState.vue'
import EvaluationStepper from '@/components/common/EvaluationStepper.vue'
import LoadingState from '@/components/common/LoadingState.vue'
import EvaluationForm from '@/components/evaluation/EvaluationForm.vue'
import EvaluationSummary from '@/components/evaluation/EvaluationSummary.vue'
import PromptAddDialog from '@/components/prompts/PromptAddDialog.vue'
import PromptAgentConfig from '@/components/prompts/PromptAgentConfig.vue'
import PromptDetailDialog from '@/components/prompts/PromptDetailDialog.vue'
import PromptEditDialog from '@/components/prompts/PromptEditDialog.vue'
import PromptPopulationTable from '@/components/prompts/PromptPopulationTable.vue'
import { useEvaluationStore } from '@/stores/evaluation'
import { usePromptPopulationStore } from '@/stores/promptPopulation'
import type { EvaluationLanguage, Prompt, PromptGenerationConfig, RegenerateMode, TaskType } from '@/types'

const route = useRoute()
const router = useRouter()
const evaluationId = computed(() => route.params.evaluationId as string)

const evaluationStore = useEvaluationStore()
const promptStore = usePromptPopulationStore()

const initialLoading = ref(true)
const loadError = ref<string | null>(null)

const agentConfig = reactive<PromptGenerationConfig>({
  provider: 'openai_compatible',
  model: '',
  promptCount: 20,
  temperature: 0.8,
  additionalInstructions: '',
})

async function loadAll() {
  initialLoading.value = true
  loadError.value = null
  try {
    promptStore.reset()
    await evaluationStore.fetchEvaluation(evaluationId.value)
    await Promise.all([
      promptStore.fetchPopulation(evaluationId.value),
      promptStore.fetchPrompts(evaluationId.value),
    ])
  } catch {
    loadError.value = 'Failed to load evaluation.'
  } finally {
    initialLoading.value = false
  }
}

onMounted(loadAll)

async function handleGenerate(config: PromptGenerationConfig) {
  try {
    await promptStore.generatePopulation(evaluationId.value, config)
  } catch {
    ElMessage.error(promptStore.error || 'Prompt generation failed.')
  }
}

async function handleRegenerate(mode: RegenerateMode, config: PromptGenerationConfig) {
  try {
    await promptStore.regenerate(evaluationId.value, mode, config)
  } catch {
    ElMessage.error(promptStore.error || 'Prompt regeneration failed.')
  }
}

const editDialogVisible = ref(false)

async function handleEditUseCase(payload: { name: string; useCaseDescription: string; taskType: TaskType; language: EvaluationLanguage }) {
  await evaluationStore.updateEvaluation(payload)
  editDialogVisible.value = false
  ElMessage.success('Use case updated.')
}

const selectedPrompt = ref<Prompt | null>(null)
const detailDialogVisible = ref(false)
const editPromptDialogVisible = ref(false)
const addDialogVisible = ref(false)
const deletePromptDialogVisible = ref(false)
const promptSaving = ref(false)

function openDetail(prompt: Prompt) {
  selectedPrompt.value = prompt
  detailDialogVisible.value = true
}

function openEdit(prompt: Prompt) {
  selectedPrompt.value = prompt
  editPromptDialogVisible.value = true
}

function promptToEditFromDetail(prompt: Prompt) {
  detailDialogVisible.value = false
  openEdit(prompt)
}

function promptToDeleteFromDetail(prompt: Prompt) {
  detailDialogVisible.value = false
  selectedPrompt.value = prompt
  deletePromptDialogVisible.value = true
}

async function handleSavePrompt(payload: { prompt: string; category: string }) {
  if (!selectedPrompt.value) return
  promptSaving.value = true
  try {
    await promptStore.updatePrompt(evaluationId.value, selectedPrompt.value.id, payload)
    editPromptDialogVisible.value = false
    ElMessage.success('Prompt updated.')
  } catch {
    ElMessage.error('Failed to update prompt.')
  } finally {
    promptSaving.value = false
  }
}

async function handleAddPrompt(payload: { prompt: string; category: string }) {
  promptSaving.value = true
  try {
    await promptStore.addPrompt(evaluationId.value, payload)
    addDialogVisible.value = false
    ElMessage.success('Prompt added.')
  } catch {
    ElMessage.error('Failed to add prompt.')
  } finally {
    promptSaving.value = false
  }
}

async function handleDeletePrompt() {
  if (!selectedPrompt.value) return
  try {
    await promptStore.deletePrompt(evaluationId.value, selectedPrompt.value.id)
    deletePromptDialogVisible.value = false
    ElMessage.success('Prompt deleted.')
  } catch {
    ElMessage.error('Failed to delete prompt.')
  }
}
</script>

<style scoped>
.page-nav {
  display: flex;
  justify-content: space-between;
  margin-top: 24px;
}
</style>
