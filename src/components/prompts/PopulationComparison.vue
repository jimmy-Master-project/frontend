<template>
  <el-card shadow="never" class="population-comparison">
    <template #header>
      <div class="header">
        <div>
          <div class="title">Population history &amp; comparison</div>
          <div class="subtitle">
            Every population generated for this evaluation is kept. Name each one after its experiment condition
            (e.g. G1 Baseline … G4 Proposed), select several and compare how they were generated. The run page lets you
            choose which population to send to the Target LLM.
          </div>
        </div>
        <el-button size="small" :loading="loading" @click="loadPopulations">Refresh</el-button>
      </div>
    </template>

    <el-alert v-if="error" type="error" :title="error" show-icon :closable="false" class="block" />

    <el-table
      :data="populations"
      row-key="populationId"
      size="small"
      class="block"
      empty-text="No populations yet"
      data-test="population-table"
      @selection-change="(rows: PromptPopulationSummary[]) => (selectedIds = rows.map(row => row.populationId!))"
    >
      <el-table-column type="selection" width="40" :selectable="(row: PromptPopulationSummary) => row.status === 'completed'" />
      <el-table-column label="Condition name" min-width="190">
        <template #default="{ row }">
          <el-input
            v-model="names[row.populationId]"
            size="small"
            placeholder="e.g. G4 Proposed"
            maxlength="255"
            :data-test="`name-${row.populationId}`"
            @change="(value: string) => rename(row as PromptPopulationSummary, value)"
          />
        </template>
      </el-table-column>
      <el-table-column label="Population" min-width="250">
        <template #default="{ row }">
          #{{ row.populationId }} · {{ modeLabel(row.generationMode) }}
          <el-tag v-if="row.populationId === currentPopulationId" size="small" effect="plain">shown above</el-tag>
          <div class="muted">{{ row.generationModel }} · {{ formatDate(row.createdAt) }}</div>
        </template>
      </el-table-column>
      <el-table-column label="Prompts" prop="generated" width="80" align="right" />
      <el-table-column label="Status" width="100">
        <template #default="{ row }">
          <el-tag size="small" :type="row.status === 'completed' ? 'success' : row.status === 'failed' ? 'danger' : 'warning'">
            {{ row.status }}
          </el-tag>
        </template>
      </el-table-column>
    </el-table>

    <div class="actions">
      <el-button type="primary" :disabled="!selectedIds.length" :loading="computing" data-test="compare" @click="compare">
        Compare {{ selectedIds.length || '' }} selected
      </el-button>
      <el-button :disabled="!results.length" data-test="export-comparison" @click="exportComparison">Export comparison CSV</el-button>
      <el-button :disabled="!results.length" data-test="export-prompts" @click="exportPrompts">
        Export prompts CSV (with annotation columns)
      </el-button>
    </div>

    <template v-if="results.length">
      <el-table :data="results" size="small" border class="block" data-test="metrics-table">
        <el-table-column label="Condition" fixed min-width="140">
          <template #default="{ row }">
            <b>{{ conditionName(row.population) }}</b>
          </template>
        </el-table-column>
        <el-table-column v-for="column in PROMPT_SET_COLUMNS" :key="column.key" :min-width="105" align="right">
          <template #header>
            <el-tooltip :content="column.hint" placement="top"><span class="col-head">{{ column.label }}</span></el-tooltip>
          </template>
          <template #default="{ row }">{{ formatMetric(row.metrics, column.key) }}</template>
        </el-table-column>
      </el-table>
      <p class="muted">
        Reference-scenario coverage and prompt validity need human or LLM judgement: use the prompts CSV, which has
        empty annotation columns for them.
      </p>
    </template>
  </el-card>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'

import { formatApiError } from '@/services/api'
import { experimentApi } from '@/services/experimentApi'
import type { PromptPopulationSummary, TaskObjective } from '@/types'
import { downloadCsv, toCsv } from '@/utils/csv'
import {
  PROMPT_SET_COLUMNS,
  normalizePrompt,
  promptSetMetrics,
  type PromptSetMetrics,
  type RawPopulationPrompt,
} from '@/utils/experimentMetrics'

const props = withDefaults(
  defineProps<{
    evaluationId: string
    evaluationName?: string
    objectives?: TaskObjective[]
    /** Population shown in the table above (the latest completed one). */
    currentPopulationId?: number | null
    /** Changes when a generation finishes, so the list reloads. */
    refreshKey?: string | null
  }>(),
  { evaluationName: '', objectives: () => [], currentPopulationId: null, refreshKey: null },
)

const populations = ref<PromptPopulationSummary[]>([])
const names = ref<Record<number, string>>({})
const selectedIds = ref<number[]>([])
const loading = ref(false)
const computing = ref(false)
const error = ref('')
// Prompts are fetched fresh on every Compare and kept with that comparison
// (the export uses exactly the prompts the metrics were computed from).
const results = ref<{ population: PromptPopulationSummary; metrics: PromptSetMetrics; prompts: RawPopulationPrompt[] }[]>([])

const MODE_LABELS: Record<string, string> = {
  persona_counterfactual_word_swap: 'persona pairs',
  persona_conditioned_generation: 'persona, no pairs',
  template_counterfactual: 'template pairs',
  '': 'plain, no pairs',
}
const modeLabel = (mode?: string) => MODE_LABELS[mode ?? ''] ?? mode
const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleString() : '')
const conditionName = (population: PromptPopulationSummary) => population.name || `Population #${population.populationId}`

async function loadPopulations() {
  loading.value = true
  error.value = ''
  try {
    const list = await experimentApi.listPopulations(props.evaluationId)
    populations.value = list
    names.value = Object.fromEntries(list.map(item => [item.populationId, item.name ?? '']))
  } catch (e) {
    error.value = formatApiError(e, 'Unable to load prompt populations.')
  } finally {
    loading.value = false
  }
}

async function rename(population: PromptPopulationSummary, value: string) {
  const name = value.trim()
  try {
    await experimentApi.renamePopulation(population.populationId!, name)
    population.name = name
  } catch (e) {
    names.value[population.populationId!] = population.name ?? ''
    ElMessage.error(formatApiError(e, 'Unable to rename the population.'))
  }
}

async function compare() {
  computing.value = true
  error.value = ''
  try {
    const chosen = populations.value.filter(item => selectedIds.value.includes(item.populationId!))
    results.value = await Promise.all(
      chosen.map(async population => {
        const prompts = await experimentApi.fetchPopulationPrompts(population.populationId!)
        return { population, prompts, metrics: promptSetMetrics(prompts, population, props.objectives) }
      }),
    )
  } catch (e) {
    error.value = formatApiError(e, 'Unable to compare populations.')
  } finally {
    computing.value = false
  }
}

function formatMetric(metrics: PromptSetMetrics, key: keyof PromptSetMetrics) {
  const value = metrics[key]
  if (value === null || value === undefined) return '—'
  if (key === 'plannedCells' && metrics.totalCells) return `${value} / ${metrics.totalCells}`
  if (key === 'pairYield' || key === 'minimalEditRate') return `${Math.round(Number(value) * 1000) / 10}%`
  return String(value)
}

const stamp = () => new Date().toISOString().slice(0, 10)

function exportComparison() {
  const header = ['condition', 'evaluation_id', 'evaluation_name', 'population_id', 'generation_mode', 'generation_model',
    'created_at', ...PROMPT_SET_COLUMNS.map(column => column.key), 'totalCells']
  const rows = results.value.map(({ population, metrics }) => [
    population.name ?? '', props.evaluationId, props.evaluationName, population.populationId,
    population.generationMode ?? '', population.generationModel, population.createdAt ?? '',
    ...PROMPT_SET_COLUMNS.map(column => metrics[column.key]), metrics.totalCells,
  ])
  downloadCsv(`evaluation${props.evaluationId}_population_comparison_${stamp()}.csv`, toCsv(header, rows))
}

function exportPrompts() {
  const header = ['condition', 'population_id', 'prompt_id', 'objective', 'technique', 'what', 'when', 'is_control',
    'pair_id', 'role', 'group', 'pair_method', 'persona_id', 'text',
    // Empty columns for human / LLM annotation (reference scenario coverage, validity rubric).
    'reference_scenario', 'valid_in_scope', 'valid_single_turn', 'valid_realistic', 'valid_room_to_vary', 'notes']
  const objectives = new Map(props.objectives.map(item => [item.objective, item]))
  const rows: (string | number | boolean)[][] = []
  for (const { population, prompts } of results.value) {
    for (const raw of prompts) {
      const record = normalizePrompt(raw)
      const objective = objectives.get(record.objective)
      rows.push([
        population.name ?? '', population.populationId!, record.id, record.objective, objective?.technique ?? '',
        objective?.helm_scenario?.what ?? '', objective?.helm_scenario?.when ?? '', objective?.is_control ?? '',
        record.pairId, record.role, record.group, record.method, record.personaId, record.text, '', '', '', '', '', '',
      ])
    }
  }
  downloadCsv(`evaluation${props.evaluationId}_prompts_${stamp()}.csv`, toCsv(header, rows))
}

onMounted(loadPopulations)
watch(
  () => [props.evaluationId, props.refreshKey],
  () => {
    results.value = []
    selectedIds.value = []
    void loadPopulations()
  },
)
</script>

<style scoped>
.population-comparison {
  margin-top: 24px;
}
.header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}
.title {
  font-weight: 600;
}
.subtitle,
.muted {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.block {
  margin-bottom: 16px;
}
.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.col-head {
  border-bottom: 1px dotted var(--el-text-color-secondary);
  cursor: help;
}
</style>
