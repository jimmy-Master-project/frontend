<template>
  <el-card class="test-plan-panel" shadow="never">
    <template #header>
      <div class="panel-header">
        <div>
          <div class="panel-title">Question Directions</div>
          <div class="panel-subtitle">
            Initial prompt agent: reads the target LLM description and your test directions, picks test-design
            techniques (GHL / ISO 29119), then expands each test direction into identity-neutral question
            directions (HELM fairness &amp; bias scenarios).
          </div>
        </div>
        <el-tag :type="planned ? 'success' : 'info'" effect="plain" data-test="objective-source">
          {{ objectiveSourceLabel }}
        </el-tag>
      </div>
    </template>

    <div class="seeds block" data-test="test-directions">
      <div class="seeds-title">Test directions ({{ testDirections.length }}) · defined with the evaluation</div>
      <ol v-if="testDirections.length" class="objective-list">
        <li v-for="(item, index) in testDirections" :key="index">{{ item }}</li>
      </ol>
      <el-alert
        v-else
        type="warning"
        show-icon
        :closable="false"
        data-test="no-test-directions"
        title="This evaluation has no test directions yet. Use “Edit” above to add them before planning."
      />
    </div>

    <el-collapse v-if="objectives.length" class="current-objectives">
      <el-collapse-item :title="`Current task objectives (${objectives.length})`" name="current">
        <ol class="objective-list">
          <li v-for="(item, index) in objectives" :key="index">
            <span>{{ item.objective }}</span>
            <el-tag v-if="item.test_direction_index" size="small" type="success" effect="plain">
              Test direction {{ item.test_direction_index }}
            </el-tag>
            <el-tag v-if="item.technique" size="small" effect="plain">{{ techniqueLabel(item.technique) }}</el-tag>
            <el-tag v-if="item.is_control" size="small" type="info">Control</el-tag>
          </li>
        </ol>
        <el-button
          size="small"
          text
          type="danger"
          :disabled="locked || saving"
          data-test="clear-objectives"
          @click="emit('clear')"
        >
          Clear objectives (use the test directions as-is)
        </el-button>
      </el-collapse-item>
    </el-collapse>

    <el-form label-position="top" class="plan-form" @submit.prevent>
      <div class="form-grid">
        <el-form-item>
          <template #label><FieldLabel label="Protected attributes" :help="FIELD_HELP.protectedAttributes" /></template>
          <el-checkbox-group v-model="form.protectedAttributes">
            <el-checkbox v-for="opt in PROTECTED_ATTRIBUTE_OPTIONS" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-form-item>
          <template #label><FieldLabel label="Known policies (thresholds help boundary-value cases)" :help="FIELD_HELP.knownPolicies" /></template>
          <el-input
            v-model="form.knownPolicies"
            type="textarea"
            :rows="2"
            placeholder="Refund within 24h of booking; compensation for delays over 3 hours."
          />
        </el-form-item>
        <el-form-item>
          <template #label><FieldLabel label="Risk priorities" :help="FIELD_HELP.riskPriorities" /></template>
          <el-input
            v-model="form.riskPriorities"
            type="textarea"
            :rows="2"
            placeholder="Decisions that affect money or access to service matter most."
          />
        </el-form-item>
      </div>

      <el-collapse class="more-info">
        <el-collapse-item title="More target information and agent settings" name="more">
          <div class="form-grid">
            <el-form-item>
              <template #label><FieldLabel label="Target system prompt / FAQ excerpt" :help="FIELD_HELP.systemPromptExcerpt" /></template>
              <el-input v-model="form.systemPromptExcerpt" type="textarea" :rows="3" />
            </el-form-item>
            <el-form-item>
              <template #label><FieldLabel label="User population" :help="FIELD_HELP.userPopulation" /></template>
              <el-input
                v-model="form.userPopulation"
                type="textarea"
                :rows="3"
                placeholder="International passengers of all ages"
              />
            </el-form-item>
            <el-form-item>
              <template #label><FieldLabel label="Interaction stages (HELM “when”)" :help="FIELD_HELP.whenStages" /></template>
              <el-select
                v-model="form.whenStages"
                multiple
                filterable
                allow-create
                default-first-option
                placeholder="e.g. before applying, after decision"
                style="width: 100%"
                data-test="when-stages"
              >
                <el-option v-for="item in stageOptions" :key="item" :label="whenLabel(item)" :value="item" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <template #label><FieldLabel label="Planning model" :help="FIELD_HELP.planningModel" /></template>
              <el-input v-model="form.modelName" placeholder="Leave blank to use backend .env" />
            </el-form-item>
            <div class="inline-fields">
              <el-form-item>
                <template #label><FieldLabel label="Directions" :help="FIELD_HELP.totalDirections" /></template>
                <el-input-number v-model="form.totalDirections" :min="1" :max="50" />
              </el-form-item>
              <el-form-item>
                <template #label><FieldLabel label="Temperature" :help="FIELD_HELP.planTemperature" /></template>
                <el-input-number v-model="form.temperature" :min="0" :max="2" :step="0.1" />
              </el-form-item>
            </div>
          </div>
        </el-collapse-item>
      </el-collapse>

      <div class="actions">
        <el-button
          type="primary"
          :loading="planning"
          :disabled="locked || !form.protectedAttributes.length || !testDirections.length"
          data-test="plan-button"
          @click="runPlan"
        >
          {{ plan ? 'Re-plan directions' : 'Plan question directions' }}
        </el-button>
        <span v-if="planning" class="hint">Runs one strategy call plus one call per technique; usually under a minute.</span>
      </div>
    </el-form>

    <el-alert v-if="error" type="error" :title="error" show-icon :closable="false" class="block" data-test="plan-error" />

    <template v-if="plan">
      <el-divider />
      <el-alert
        v-if="plan.strategySummary"
        type="info"
        :closable="false"
        :title="plan.strategySummary"
        class="block"
      />

      <div class="stats" data-test="plan-stats">
        <div class="stat"><span class="stat-value">{{ rows.length }}</span><span class="stat-label">directions</span></div>
        <div class="stat"><span class="stat-value">{{ controlCount }}</span><span class="stat-label">control cases</span></div>
        <div class="stat">
          <span class="stat-value">{{ Math.round(grid.coverage * 100) }}%</span>
          <span class="stat-label">test direction × when cells ({{ grid.filled }}/{{ grid.totalCells }})</span>
        </div>
        <div class="stat"><span class="stat-value">{{ plan.rejected.length }}</span><span class="stat-label">rejected</span></div>
      </div>

      <el-alert
        v-if="plan.gapFill?.targeted.length"
        type="info"
        show-icon
        :closable="false"
        class="block"
        data-test="gap-fill"
        :title="`Coverage gap fill: ${plan.gapFill.added.length} of ${plan.gapFill.targeted.length} unexpanded test directions added.`"
      />

      <el-alert
        v-if="grid.uncovered.length"
        type="warning"
        show-icon
        :closable="false"
        class="block"
        data-test="uncovered-seeds"
        :title="`Selected directions do not cover test direction ${grid.uncovered.join(', ')}.`"
      />

      <el-alert
        v-if="controlCount === 0"
        type="warning"
        show-icon
        :closable="false"
        class="block"
        title="No control case left: keep at least one so the target's baseline randomness can be estimated."
      />

      <el-collapse class="block">
        <el-collapse-item :title="`Selected techniques (${plan.techniques.length})`" name="techniques">
          <div v-for="item in plan.techniques" :key="item.technique" class="technique">
            <el-tag effect="plain">{{ techniqueLabel(item.technique) }} × {{ item.direction_count }}</el-tag>
            <span>
              <span v-if="item.test_directions?.length" class="muted">
                Test directions {{ item.test_directions.join(', ') }} —
              </span>
              {{ item.rationale }}
            </span>
          </div>
        </el-collapse-item>
        <el-collapse-item title="Coverage grid (test direction × HELM when)" name="grid">
          <table class="grid" data-test="coverage-grid">
            <thead>
              <tr>
                <th>test direction \ when</th>
                <th v-for="when in grid.whens" :key="when">{{ whenLabel(when) }}</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in grid.rows" :key="row.index">
                <th>{{ row.index }}. {{ row.testDirection }}</th>
                <td v-for="(count, i) in row.cells" :key="i" :class="{ empty: count === 0 }">{{ count || '' }}</td>
                <td :class="{ empty: row.total === 0 }">{{ row.total }}</td>
              </tr>
            </tbody>
          </table>
        </el-collapse-item>
        <el-collapse-item v-if="plan.rejected.length" :title="`Rejected by filters (${plan.rejected.length})`" name="rejected">
          <ul class="rejected">
            <li v-for="(item, index) in plan.rejected" :key="index">
              <span v-if="item.objective">{{ item.objective }}</span>
              <span class="reason">— {{ item.reason }}</span>
            </li>
          </ul>
        </el-collapse-item>
      </el-collapse>

      <el-table
        ref="tableRef"
        :data="rows"
        row-key="key"
        class="block"
        data-test="directions-table"
        @selection-change="onSelectionChange"
      >
        <el-table-column type="selection" width="44" />
        <el-table-column label="Test direction" width="120">
          <template #default="{ row }">
            <el-tooltip :content="row.test_direction" placement="top">
              <el-tag type="success" effect="plain">#{{ row.test_direction_index }}</el-tag>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="Objective" min-width="320">
          <template #default="{ row }">
            <el-input v-model="row.objective" type="textarea" autosize />
            <div v-if="row.why_identity_could_matter" class="why">{{ row.why_identity_could_matter }}</div>
          </template>
        </el-table-column>
        <el-table-column label="Technique" width="170">
          <template #default="{ row }">{{ techniqueLabel(row.technique) }}</template>
        </el-table-column>
        <el-table-column label="What / When" width="190">
          <template #default="{ row }">
            <div>{{ row.helm_scenario.what }}</div>
            <div class="muted">{{ whenLabel(row.helm_scenario.when) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="Bias risk" width="190">
          <template #default="{ row }">
            <el-tag :type="BIAS_RISK_TAG_TYPES[row.bias_risk as BiasRisk] ?? 'info'" size="small">
              {{ BIAS_RISK_LABELS[row.bias_risk as BiasRisk] ?? row.bias_risk }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>

      <el-alert
        v-if="hasPrompts"
        type="warning"
        show-icon
        :closable="false"
        class="block"
        title="The current prompt population was generated from the previous objectives. Regenerate prompts after applying."
      />

      <div class="actions">
        <el-button
          type="primary"
          :disabled="locked || !selectedObjectives.length"
          :loading="saving"
          data-test="apply-button"
          @click="emit('apply', selectedObjectives)"
        >
          Use {{ selectedObjectives.length }} selected as task objectives
        </el-button>
        <el-button :disabled="saving" @click="discard">Discard plan</el-button>
      </div>
    </template>
  </el-card>
</template>

<script setup lang="ts">
import FieldLabel from '@/components/common/FieldLabel.vue'
import { FIELD_HELP } from '@/utils/fieldHelp'
import { computed, nextTick, reactive, ref, watch } from 'vue'

import { formatApiError } from '@/services/api'
import { testPlanApi } from '@/services/testPlanApi'
import type { BiasRisk, TaskObjective, TestPlan, TestPlanDirection, TestTechnique } from '@/types'
import {
  AIRLINE_WHEN_STAGES,
  BIAS_RISK_LABELS,
  BIAS_RISK_TAG_TYPES,
  PROTECTED_ATTRIBUTE_OPTIONS,
  TECHNIQUE_LABELS,
  buildTestPlanRequest,
  coverageGrid,
  defaultTestPlanForm,
  directionsToObjectives,
  isPlannedObjectives,
  toStageKey,
  whenLabel,
} from '@/utils/testPlan'

const props = withDefaults(
  defineProps<{
    evaluationId: string
    /** User-defined test directions stored on the evaluation (the agent's seeds). */
    testDirections?: string[]
    objectives?: TaskObjective[]
    /** True while a prompt population is being generated. */
    locked?: boolean
    /** True while the objectives are being saved. */
    saving?: boolean
    hasPrompts?: boolean
  }>(),
  { testDirections: () => [], objectives: () => [], locked: false, saving: false, hasPrompts: false },
)

const emit = defineEmits<{
  apply: [objectives: TaskObjective[]]
  clear: []
}>()

const form = reactive(defaultTestPlanForm())
const planning = ref(false)
const error = ref<string | null>(null)
const plan = ref<TestPlan | null>(null)
type PlanRow = TestPlanDirection & { key: number }

const rows = ref<PlanRow[]>([])
const selectedKeys = ref<Set<number>>(new Set())
const selected = computed(() => rows.value.filter(row => selectedKeys.value.has(row.key)))
const tableRef = ref<{ toggleAllSelection: () => void } | null>(null)

const planned = computed(() => isPlannedObjectives(props.objectives))
const objectiveSourceLabel = computed(() => {
  if (!props.objectives.length) return 'Using test directions as-is'
  return `${props.objectives.length} objectives · ${planned.value ? 'planned' : 'manual'}`
})
const selectedObjectives = computed(() =>
  directionsToObjectives(selected.value.map(({ key: _key, ...direction }) => direction)),
)
const controlCount = computed(() => selected.value.filter(row => row.is_control).length)
const stageOptions = computed(() => [...new Set([...AIRLINE_WHEN_STAGES, ...form.whenStages.map(toStageKey)])])
// Use the stages the backend actually planned with, not later form edits.
const grid = computed(() =>
  coverageGrid(selected.value, plan.value?.testDirections ?? props.testDirections, plan.value?.coverage.when),
)

function techniqueLabel(technique: TestTechnique | string) {
  return TECHNIQUE_LABELS[technique as TestTechnique] ?? technique
}

function onSelectionChange(value: PlanRow[]) {
  selectedKeys.value = new Set(value.map(row => row.key))
}

async function runPlan() {
  planning.value = true
  error.value = null
  try {
    const result = await testPlanApi.generate(props.evaluationId, buildTestPlanRequest(form))
    plan.value = result
    rows.value = result.directions.map((direction, key) => ({
      ...direction,
      helm_scenario: { ...direction.helm_scenario },
      key,
    }))
    // Everything starts selected (the table starts empty, so toggling all selects all).
    selectedKeys.value = new Set(rows.value.map(row => row.key))
    await nextTick()
    tableRef.value?.toggleAllSelection()
  } catch (e) {
    error.value = formatApiError(e, 'Test planning failed.')
  } finally {
    planning.value = false
  }
}

function discard() {
  plan.value = null
  rows.value = []
  selectedKeys.value = new Set()
}

// A different evaluation must not show the previous one's plan.
watch(
  () => props.evaluationId,
  () => {
    discard()
    error.value = null
  },
)

defineExpose({ discard })
</script>

<style scoped>
.test-plan-panel {
  margin-bottom: 24px;
}
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}
.panel-title,
.seeds-title {
  font-weight: 600;
}
.seeds-title {
  font-size: 13px;
  margin-bottom: 6px;
}
.panel-subtitle,
.hint,
.muted,
.why,
.reason {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.why {
  margin-top: 4px;
}
.current-objectives,
.more-info,
.block {
  margin-bottom: 16px;
}
.objective-list {
  margin: 0 0 8px;
  padding-left: 20px;
}
.objective-list li {
  margin-bottom: 4px;
}
.objective-list .el-tag {
  margin-left: 6px;
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 0 16px;
}
.inline-fields {
  display: flex;
  gap: 16px;
}
.actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}
.stat {
  display: flex;
  flex-direction: column;
  padding: 8px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}
.stat-value {
  font-size: 20px;
  font-weight: 600;
}
.stat-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.technique {
  display: flex;
  gap: 8px;
  align-items: baseline;
  margin-bottom: 6px;
}
.grid {
  border-collapse: collapse;
  font-size: 12px;
  width: 100%;
}
.grid th,
.grid td {
  border: 1px solid var(--el-border-color-lighter);
  padding: 4px 8px;
  text-align: center;
}
.grid tbody th {
  text-align: left;
  font-weight: 500;
}
.grid td.empty {
  background: var(--el-fill-color-light);
}
.rejected {
  margin: 0;
  padding-left: 20px;
  font-size: 13px;
}
</style>
