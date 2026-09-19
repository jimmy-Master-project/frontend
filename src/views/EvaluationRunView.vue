<template>
  <div class="evaluation-run-view">
    <EvaluationStepper :active="3" />
    <h2>Run Evaluation</h2>

    <RunSummary
      v-if="runStore.status === 'idle'"
      :evaluation-name="evaluationStore.name"
      :prompt-count="promptStore.promptCount"
      :model-name="llmStore.modelName"
      :generations-per-prompt="llmStore.generationsPerPrompt"
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
       @retry="handleStart"
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
        <el-button type="primary" @click="handleStart">Start</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import EvaluationStepper from '@/components/common/EvaluationStepper.vue'
import RunProgress from '@/components/run/RunProgress.vue'
import RunSummary from '@/components/run/RunSummary.vue'
import { useEvaluationStore } from '@/stores/evaluation'
import { useLlmConfigStore } from '@/stores/llmConfig'
import { usePromptPopulationStore } from '@/stores/promptPopulation'
import { useRunStore } from '@/stores/run'

const route = useRoute()
const router = useRouter()
const evaluationId = computed(() => route.params.evaluationId as string)

const evaluationStore = useEvaluationStore()
const promptStore = usePromptPopulationStore()
const llmStore = useLlmConfigStore()
const runStore = useRunStore()

const confirmVisible = ref(false)
const totalGenerations = computed(() => promptStore.promptCount * llmStore.generationsPerPrompt)

onMounted(async () => {
  runStore.ensureEvaluation(evaluationId.value)
  if (!evaluationStore.evaluationId || evaluationStore.evaluationId !== evaluationId.value) {
    await evaluationStore.fetchEvaluation(evaluationId.value)
  }
  await promptStore.fetchPrompts(evaluationId.value)
  await llmStore.fetchConfig(evaluationId.value).catch(() => {})
  await runStore.restoreLatestRun(evaluationId.value)
})

onUnmounted(() => {
  runStore.stopPolling()
})

async function handleStart() {
  confirmVisible.value = false
  try {
    await runStore.startRun(evaluationId.value)
  } catch {
    // Failure state is already reflected via runStore.status/error.
  }
}

async function handleResume() {
	try {
		await runStore.resumeRun(evaluationId.value)
	} catch {
		// Failure state is already reflected via runStore.status/error.
	}
}
</script>
