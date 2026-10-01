<template>
  <div class="evaluation-run-view">
    <EvaluationStepper :active="3" />
    <h2>Run Evaluation</h2>

    <el-alert
      v-if="runStore.startError"
      type="error"
      show-icon
      :title="runStore.startError"
      class="start-error"
      @close="runStore.startError = null"
    />

    <RunSummary
      v-if="runStore.status === 'idle'"
      :evaluation-name="evaluationStore.name"
      :prompt-count="promptStore.promptCount"
      :model-name="llmStore.modelName"
      :generations-per-prompt="llmStore.generationsPerPrompt"
      :starting="runStore.starting"
      @start="confirmVisible = true"
    />

    <RunProgress
      v-else
      :status="runStore.status"
      :total-prompts="runStore.totalPrompts"
      :completed-prompts="runStore.completedPrompts"
      :total-generations="runStore.totalGenerations"
      :completed-generations="runStore.completedGenerations"
      :progress="runStore.progress"
      :error="runStore.error"
      :heartbeat-at="runStore.heartbeatAt"
      :failed-generations="runStore.failedGenerations"
      :external="runStore.external"
      :starting="runStore.starting"
      :connection-lost="runStore.connectionLost"
      @retry="confirmVisible = true"
      @resume="handleResume"
      @back-to-llm="router.push(`/evaluations/${evaluationId}/llm`)"
      @view-responses="router.push(`/evaluations/${evaluationId}/responses`)"
    />

    <el-dialog v-model="confirmVisible" title="Start this evaluation?" width="440px">
      <p>
        {{ promptStore.promptCount }} prompts will each be sent
        {{ llmStore.generationsPerPrompt }} time(s) to {{ llmStore.modelName }}.
      </p>
      <p>Expected LLM outputs and classifier calls: {{ totalGenerations }}</p>
      <template #footer>
        <el-button @click="confirmVisible = false">Cancel</el-button>
        <el-button type="primary" :loading="runStore.starting" :disabled="runStore.starting" @click="handleStart">
          Start
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useUnmountSignal } from '@/composables/usePolling'

import EvaluationStepper from '@/components/common/EvaluationStepper.vue'
import RunProgress from '@/components/run/RunProgress.vue'
import RunSummary from '@/components/run/RunSummary.vue'
import { useEvaluationStore } from '@/stores/evaluation'
import { useLlmConfigStore } from '@/stores/llmConfig'
import { usePromptPopulationStore } from '@/stores/promptPopulation'
import { useRunStore } from '@/stores/run'

const route = useRoute()
const router = useRouter()
const evaluationId = computed(() => String(route.params.evaluationId))
const unmountSignal = useUnmountSignal()

const evaluationStore = useEvaluationStore()
const promptStore = usePromptPopulationStore()
const llmStore = useLlmConfigStore()
const runStore = useRunStore()

const confirmVisible = ref(false)
const totalGenerations = computed(() => promptStore.promptCount * llmStore.generationsPerPrompt)

onMounted(async () => {
  const id = evaluationId.value
  runStore.ensureEvaluation(id)
  try {
    if (String(evaluationStore.evaluationId ?? '') !== id) {
      await evaluationStore.fetchEvaluation(id)
    }
    await promptStore.fetchPrompts(id)
  } catch {
    // Summary values fall back to their defaults; run state is still restored below.
  }
  await llmStore.fetchConfig(id).catch(() => {})
  if (unmountSignal.aborted) return
  await runStore.restoreLatestRun(id, unmountSignal)
})

onUnmounted(() => {
  runStore.stopPolling()
})

async function handleStart() {
  if (runStore.starting) return
  try {
    await runStore.startRun(evaluationId.value, unmountSignal)
  } catch {
    // The rejection reason is shown via runStore.startError.
  } finally {
    confirmVisible.value = false
  }
}

async function handleResume() {
  if (runStore.starting) return
  try {
    await runStore.resumeRun(evaluationId.value, unmountSignal)
  } catch {
    // The rejection reason is shown via runStore.startError.
  }
}
</script>

<style scoped>
.start-error {
  margin-bottom: 16px;
}
</style>
