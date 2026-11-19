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
      @back-to-llm="router.push(`/evaluations/${evaluationId}/llm`)"
      @view-responses="router.push({ path: `/evaluations/${evaluationId}/responses`, query: runStore.runId ? { runId: runStore.runId } : {} })"
    />

    <el-dialog v-model="confirmVisible" title="Start this evaluation?" width="440px">
      <p>
        {{ selectedPromptCount }} prompts will each be sent
        {{ llmStore.generationsPerPrompt }} time(s) to {{ llmStore.modelName }}.
      </p>
      <p>Expected LLM outputs and classifier calls: {{ totalGenerations }}</p>
      <el-alert
        v-if="llmStore.systemPrompt"
        type="warning"
        show-icon
        :closable="false"
        title="Bias injection: every prompt is sent after the Target LLM system prompt."
        :description="llmStore.systemPrompt"
        style="margin-bottom: 12px"
      />
      <el-form label-position="top" @submit.prevent>
        <el-form-item v-if="populations.length > 1 || route.query.populationId" required>
          <template #label>
            <FieldLabel label="Prompt population (experiment condition)" :help="FIELD_HELP.runPopulation" />
          </template>
          <el-select v-model="populationId" placeholder="Choose the population to send" style="width: 100%" data-test="run-population">
            <el-option
              v-for="item in populations"
              :key="item.populationId!"
              :label="populationLabel(item)"
              :value="item.populationId!"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <template #label><FieldLabel label="Run name (shown in Run history)" :help="FIELD_HELP.runName" /></template>
          <el-input v-model="runLabel" :placeholder="llmStore.modelName" maxlength="200" />
        </el-form-item>
      </el-form>
      <p v-if="pastRunCount" class="hint">
        This evaluation already has {{ pastRunCount }} run(s). They are kept; compare them in
        <router-link :to="{ name: 'run-history', params: { evaluationId } }">Run history</router-link>.
      </p>
      <template #footer>
        <el-button @click="confirmVisible = false">Cancel</el-button>
        <el-button
          type="primary"
          :loading="runStore.starting"
          :disabled="runStore.starting || (populations.length > 1 && !populationId)"
          @click="handleStart"
        >
          Start
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import FieldLabel from '@/components/common/FieldLabel.vue'
import { FIELD_HELP } from '@/utils/fieldHelp'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useUnmountSignal } from '@/composables/usePolling'

import EvaluationStepper from '@/components/common/EvaluationStepper.vue'
import RunProgress from '@/components/run/RunProgress.vue'
import RunSummary from '@/components/run/RunSummary.vue'
import { useEvaluationStore } from '@/stores/evaluation'
import { useLlmConfigStore } from '@/stores/llmConfig'
import { usePromptPopulationStore } from '@/stores/promptPopulation'
import { useRunStore } from '@/stores/run'
import { runApi } from '@/services/runApi'
import { experimentApi } from '@/services/experimentApi'
import type { PromptPopulationSummary } from '@/types'

const route = useRoute()
const router = useRouter()
const evaluationId = computed(() => String(route.params.evaluationId))
const unmountSignal = useUnmountSignal()

const evaluationStore = useEvaluationStore()
const promptStore = usePromptPopulationStore()
const llmStore = useLlmConfigStore()
const runStore = useRunStore()

const confirmVisible = ref(false)
const runLabel = ref('')
const pastRunCount = ref(0)
// Completed populations of this evaluation (one per experiment condition).
// With several, the user must choose one explicitly every time: no default
// from the prompt page or from the previous run.
const populations = ref<PromptPopulationSummary[]>([])
const populationId = ref<number | null>(null)
const selectedPromptCount = computed(
  () => populations.value.find(item => item.populationId === populationId.value)?.generated ?? promptStore.promptCount,
)
function populationLabel(item: PromptPopulationSummary) {
  const date = item.createdAt ? new Date(item.createdAt).toLocaleString() : ''
  return `${item.name || 'Unnamed'} · #${item.populationId} · ${item.generated} prompts · ${date}`
}
// Default name: the target model, refreshed whenever the dialog opens.
watch(confirmVisible, open => {
  if (!open) return
  populationId.value = null
  runLabel.value = llmStore.modelName
  void runApi.listRuns(evaluationId.value).then(runs => (pastRunCount.value = runs.length), () => undefined)
  void experimentApi.listPopulations(evaluationId.value).then(list => {
    populations.value = list.filter(item => item.status === 'completed')
    // Chosen explicitly on the Target LLM page ("Run with current LLM").
    const requested = Number(route.query.populationId)
    if (requested && populations.value.some(item => item.populationId === requested)) populationId.value = requested
    else populationId.value = populations.value.length === 1 ? populations.value[0].populationId : null
  }, () => undefined)
})
const totalGenerations = computed(() => selectedPromptCount.value * llmStore.generationsPerPrompt)

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
  if (route.query.populationId && !unmountSignal.aborted && !runStore.starting) confirmVisible.value = true
})

onUnmounted(() => {
  runStore.stopPolling()
})

async function handleStart() {
  if (runStore.starting) return
  try {
    await runStore.startRun(
      evaluationId.value,
      unmountSignal,
      runLabel.value.trim() || undefined,
      populationId.value ?? undefined,
    )
  } catch {
    // The rejection reason is shown via runStore.startError.
  } finally {
    confirmVisible.value = false
  }
}

</script>

<style scoped>
.hint {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.start-error {
  margin-bottom: 16px;
}
</style>
