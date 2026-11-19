<template>
  <el-card shadow="never" class="experiment-overview">
    <template #header>
      <div class="header">
        <span class="title">Experiments in this evaluation</span>
        <div>
          <el-button text :loading="loading" @click="load">Refresh</el-button>
          <el-button text type="primary" @click="router.push({ name: 'run-history', params: { evaluationId } })">
            Compare runs →
          </el-button>
        </div>
      </div>
    </template>

    <el-alert v-if="error" type="error" :title="error" :closable="false" show-icon class="gap" />

    <h4>Prompt populations</h4>
    <p class="muted">Each population is a fixed set of prompts. Run it against any Target LLM: set the model below, then start a run with this population.</p>
    <el-table v-loading="loading" :data="populations" size="small" empty-text="No completed population yet." class="gap">
      <el-table-column label="Population" min-width="170">
        <template #default="{ row }">
          <b>{{ (row as PromptPopulationSummary).name || 'Unnamed' }}</b>
          <small class="muted"> #{{ (row as PromptPopulationSummary).populationId }}</small>
        </template>
      </el-table-column>
      <el-table-column label="Prompts" prop="generated" width="80" />
      <el-table-column label="Personas" min-width="150">
        <template #default="{ row }">{{ personaText(row as PromptPopulationSummary) }}</template>
      </el-table-column>
      <el-table-column label="Directions" width="100">
        <template #default="{ row }">
          <el-tooltip
            v-if="(row as PromptPopulationSummary).taskObjectives?.length"
            :content="(row as PromptPopulationSummary).taskObjectives!.join(' · ')"
            placement="top"
          >
            <span>{{ (row as PromptPopulationSummary).taskObjectives!.length }}</span>
          </el-tooltip>
          <span v-else class="muted">—</span>
        </template>
      </el-table-column>
      <el-table-column label="Already run on" min-width="200">
        <template #default="{ row }">
          <el-tag v-for="model in modelsFor((row as PromptPopulationSummary).populationId)" :key="model" size="small" class="tag">
            {{ model }}
          </el-tag>
          <span v-if="!modelsFor((row as PromptPopulationSummary).populationId).length" class="muted">—</span>
        </template>
      </el-table-column>
      <el-table-column width="170" align="right">
        <template #default="{ row }">
          <el-button
            size="small"
            type="primary"
            plain
            :disabled="!canRun"
            @click="runWith((row as PromptPopulationSummary).populationId!)"
          >
            Run with current LLM
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <h4>Past runs</h4>
    <el-table :data="runs" size="small" empty-text="No runs yet." max-height="360">
      <el-table-column label="Run" min-width="150">
        <template #default="{ row }">
          <b>{{ (row as RunStatus).label || `Run #${(row as RunStatus).id}` }}</b>
          <small class="muted"> #{{ (row as RunStatus).id }}</small>
        </template>
      </el-table-column>
      <el-table-column label="Condition" min-width="220">
        <template #default="{ row }">
          {{ (row as RunStatus).condition ? conditionLabel(row as RunStatus) : populationName((row as RunStatus).promptPopulationId) }}
        </template>
      </el-table-column>
      <el-table-column label="Target LLM" min-width="180">
        <template #default="{ row }">
          {{ (row as RunStatus).llmSnapshot?.modelName || '—' }}
          <small class="muted">{{ snapshotParams(row as RunStatus) }}</small>
          <el-tooltip v-if="(row as RunStatus).llmSnapshot?.systemPrompt" :content="(row as RunStatus).llmSnapshot!.systemPrompt" placement="top">
            <el-tag size="small" type="danger" effect="plain">system prompt</el-tag>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column label="Status" width="110">
        <template #default="{ row }">
          <el-tag size="small" :type="statusType((row as RunStatus).status)">{{ (row as RunStatus).status }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="Responses" width="100">
        <template #default="{ row }">
          {{ (row as RunStatus).completedGenerations }}/{{ (row as RunStatus).totalGenerations }}
        </template>
      </el-table-column>
      <el-table-column label="Started" width="160">
        <template #default="{ row }">{{ formatDate((row as RunStatus).startedAt) }}</template>
      </el-table-column>
      <el-table-column width="200" align="right">
        <template #default="{ row }">
          <el-button size="small" text :disabled="!hasResponses(row as RunStatus)" @click="open('evaluation-responses', (row as RunStatus).id)">
            Responses
          </el-button>
          <el-button size="small" text :disabled="(row as RunStatus).status !== 'completed'" @click="open('fairness-metrics', (row as RunStatus).id)">
            Metrics
          </el-button>
          <el-button size="small" text @click="emit('use-settings', row as RunStatus)">Reuse LLM</el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-card>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { formatApiError } from '@/services/api'
import { experimentApi } from '@/services/experimentApi'
import { runApi } from '@/services/runApi'
import type { PromptPopulationSummary, RunStatus } from '@/types'
import { conditionLabel } from '@/utils/runCondition'

const props = defineProps<{
  evaluationId: string
  /** False while the current Target LLM form has no saved model. */
  canRun: boolean
}>()
const emit = defineEmits<{ (e: 'use-settings', run: RunStatus): void }>()

const router = useRouter()
const runs = ref<RunStatus[]>([])
const allPopulations = ref<PromptPopulationSummary[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

const populations = computed(() => allPopulations.value.filter(item => item.status === 'completed' && item.populationId))

const modelsByPopulation = computed(() => {
  const map = new Map<number, string[]>()
  for (const run of runs.value) {
    if (!run.promptPopulationId || run.status === 'failed') continue
    const model = run.llmSnapshot?.modelName || run.label || `Run #${run.id}`
    const list = map.get(run.promptPopulationId) ?? []
    if (!list.includes(model)) list.push(model)
    map.set(run.promptPopulationId, list)
  }
  return map
})

function modelsFor(populationId: number | null) {
  return populationId ? modelsByPopulation.value.get(populationId) ?? [] : []
}

function populationName(id?: number) {
  if (!id) return '—'
  const item = allPopulations.value.find(population => population.populationId === id)
  return `${item?.name || 'Unnamed'} #${id}`
}

function personaText(item: PromptPopulationSummary) {
  if (!item.personaBased) return item.generationMode === 'template_counterfactual' ? 'Template pairs' : 'No personas'
  const persona = item.persona
  if (persona?.personaSetName) return `List: ${persona.personaSetName}`
  if (persona?.personaIds?.length) return `${persona.personaIds.length} picked`
  return item.seed !== null && item.seed !== undefined ? `Random · seed ${item.seed}` : 'Random'
}

function snapshotParams(run: RunStatus) {
  const snap = run.llmSnapshot
  if (!snap) return ''
  const parts = [
    snap.temperature !== undefined ? `T=${snap.temperature}` : '',
    snap.generationsPerPrompt ? `k=${snap.generationsPerPrompt}` : '',
  ].filter(Boolean)
  return parts.length ? ` (${parts.join(', ')})` : ''
}

function statusType(status: string) {
  return status === 'completed' ? 'success' : status === 'failed' ? 'danger' : 'warning'
}

function hasResponses(run: RunStatus) {
  return run.completedGenerations > 0 || run.status === 'completed'
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : '—'
}

function open(name: 'evaluation-responses' | 'fairness-metrics', runId: number) {
  void router.push({ name, params: { evaluationId: props.evaluationId }, query: { runId: String(runId) } })
}

function runWith(populationId: number) {
  void router.push({ name: 'evaluation-run', params: { evaluationId: props.evaluationId }, query: { populationId: String(populationId) } })
}

async function load() {
  loading.value = true
  error.value = null
  try {
    const [runList, populationList] = await Promise.all([
      runApi.listRuns(props.evaluationId),
      experimentApi.listPopulations(props.evaluationId),
    ])
    runs.value = runList
    allPopulations.value = populationList
  } catch (e) {
    error.value = formatApiError(e, 'Failed to load runs and populations.')
  } finally {
    loading.value = false
  }
}

onMounted(load)
defineExpose({ load, runs })
</script>

<style scoped>
.experiment-overview {
  margin-bottom: 24px;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.title {
  font-weight: 700;
}
h4 {
  margin: 8px 0 4px;
}
.gap {
  margin-bottom: 16px;
}
.muted {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.tag {
  margin: 2px 4px 2px 0;
}
</style>
