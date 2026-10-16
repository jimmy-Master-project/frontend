<template>
  <el-card class="persona-settings" shadow="never">
    <template #header>
      <div class="card-header">
        <div>
          <span class="header-title">Persona Population</span>
          <p class="header-subtitle">The prompt generator always sees each persona's full attribute set. The fairness labels below are limited to what LangFair supports (gender, race/ethnicity) and only decide which attribute(s) the results are analyzed on.</p>
        </div>
        <el-switch v-model="enabled" active-text="Use simulated personas" />
      </div>
    </template>

    <template v-if="enabled">
      <el-alert
        v-if="catalog.error.value"
        type="error"
        show-icon
        :closable="false"
        :title="catalog.error.value"
        class="section-gap"
      >
        <el-button size="small" :loading="catalog.loading.value" @click="retryCatalog">Retry</el-button>
      </el-alert>
      <el-alert
        v-if="sampleError"
        type="error"
        show-icon
        :closable="false"
        :title="sampleError"
        class="section-gap"
      />

      <div class="source-row">
        <span class="panel-label">Persona source</span>
        <el-radio-group v-model="mode">
          <el-radio-button value="pick">Pick personas</el-radio-button>
          <el-radio-button value="sample">Random sampling</el-radio-button>
        </el-radio-group>
        <span class="field-help">
          {{
            mode === 'pick'
              ? 'Only the personas you tick are used; they are reused in turn when there are more prompts than personas.'
              : 'Personas are sampled from the pool using the filters / seed below.'
          }}
        </span>
      </div>

      <div class="top-grid">
        <el-form label-position="top" class="population-form">
          <el-form-item label="Population Size">
            <el-input-number
              v-model="populationSize"
              :min="catalog.sampleSizeMin.value"
              :max="catalog.sampleSizeMax.value"
              style="width: 100%"
            />
            <p v-if="sampleSizeHelp" class="field-help">{{ sampleSizeHelp }}</p>
          </el-form-item>
        </el-form>

        <div class="selected-panel">
          <div class="selected-summary">
            <div>
              <span class="panel-label">Fairness labels</span>
              <strong>{{ selectedAttributes.length }}</strong>
            </div>
            <el-button v-if="selectedAttributes.length" text type="primary" @click="clearSelected">Clear all</el-button>
          </div>
          <div v-if="selectedAttributes.length" class="selected-tags compact-scroll">
            <el-tag v-for="key in selectedAttributes" :key="key" closable @close="removeAttribute(key)">
              {{ catalog.labelFor(key) }}
            </el-tag>
          </div>
          <p v-else class="field-help no-selection">Choose gender and/or race/ethnicity below.</p>
        </div>
      </div>

      <el-divider content-position="left">Fairness Labels (LangFair)</el-divider>

      <el-alert
        type="info"
        show-icon
        :closable="false"
        class="section-gap"
        title="LangFair supports two protected attributes: gender and race/ethnicity. Gender gets counterfactual prompt pairs (gendered words swapped); race/ethnicity is compared across LangFair's groups using each persona's own ethnicity, without counterfactual pairs."
      />

      <div v-loading="catalog.loading.value" class="protected-grid">
        <div
          v-for="attribute in catalog.protectedAttributes.value"
          :key="attribute.key"
          class="protected-option"
          :class="{ checked: selectedAttributes.includes(attribute.key) }"
        >
          <el-checkbox :model-value="selectedAttributes.includes(attribute.key)" @change="toggleAttribute(attribute.key)">
            <strong>{{ attribute.label }}</strong>
          </el-checkbox>
          <p class="field-help">
            LangFair groups: {{ attribute.groups.map(group => group.name).join(', ') }} ·
            {{ attribute.counterfactual ? 'counterfactual pairs' : 'group comparison only' }}
          </p>
          <p v-if="unsupportedValues(attribute.key).length" class="field-help">
            Not in any LangFair group (left out of this comparison): {{ unsupportedValues(attribute.key).join(', ') }}
          </p>
        </div>
        <p v-if="!catalog.loading.value && !catalog.protectedAttributes.value.length" class="field-help">
          Fairness labels are unavailable until the persona service responds.
        </p>
      </div>

      <template v-if="mode === 'pick'">
        <el-divider content-position="left">Choose Personas</el-divider>
        <PersonaPicker
          v-model:selected="pickedPersonaIds"
          :pool="personaConfig.pool"
          :diagnostic-attributes="selectedAttributes"
          @selection-info="info => (pickedInfo = info)"
        />
      </template>

      <template v-else>
      <PersonaFilterPanel
        v-model:config="personaConfig"
        :selected-attribute-objects="selectedAttributeObjects"
        :suggested-seed="previewSeed"
      />

      <div class="actions">
        <el-button :disabled="selectedAttributes.length === 0 || sampling" :loading="sampling" @click="previewPopulation">
          Preview Population
        </el-button>
      </div>

      <div v-if="sampling" class="inline-loading">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span>Sampling personas...</span>
      </div>

      <PersonaPreviewGrid :personas="previewPersonas" :selected-attributes="selectedAttributes" :seed="previewSeed" />
      </template>

      <PromptPlanSummary :input="planInput" />
    </template>

    <p v-else class="disabled-note">Persona disabled. The existing Prompt Population Generation flow will be used.</p>
  </el-card>
</template>

<script setup lang="ts">
import { Loading } from '@element-plus/icons-vue'
import { computed, onMounted, ref, watch } from 'vue'

import PersonaFilterPanel from '@/components/prompts/PersonaFilterPanel.vue'
import PersonaPicker from '@/components/prompts/PersonaPicker.vue'
import PromptPlanSummary from '@/components/prompts/PromptPlanSummary.vue'
import PersonaPreviewGrid from '@/components/prompts/PersonaPreviewGrid.vue'
import { freshSeed, isGenderAttribute, usePersonaCatalog } from '@/composables/usePersonaCatalog'
import { formatApiError } from '@/services/api'
import { personaApi } from '@/services/personaApi'
import type { PersonaAttribute, PersonaConfig, PersonaPreview } from '@/types'
import type { PickedPersonaInfo, PromptPlanInput } from '@/utils/promptPlan'

const props = withDefaults(defineProps<{ objectiveCount?: number }>(), { objectiveCount: 1 })

const enabled = defineModel<boolean>('enabled', { default: true })
const populationSize = defineModel<number>('populationSize', { default: 20 })
// Single source of truth for every persona setting (attributes, filters,
// stratify, seed, pool). Child panels update it via v-model.
const personaConfig = defineModel<PersonaConfig>('config', { required: true })

const catalog = usePersonaCatalog()

const sampling = ref(false)
const sampleError = ref<string | null>(null)
const previewPersonas = ref<PersonaPreview[]>([])
const previewSeed = ref<number | null>(null)

const sampleSizeHelp = computed(
  () => `Allowed range: ${catalog.sampleSizeMin.value}–${catalog.sampleSizeMax.value}`,
)

const selectedAttributes = computed<string[]>({
  get: () => personaConfig.value.selectedAttributes,
  set: setSelectedAttributes,
})

const selectedAttributeObjects = computed(() =>
  selectedAttributes.value
    .map(key => catalog.attributeMap.value.get(key))
    .filter((attribute): attribute is PersonaAttribute => Boolean(attribute)),
)

watch(enabled, value => update({ enabled: value }))

// "pick" = hand-picked persona ids replace random sampling. The ids picked
// so far are kept while switching back and forth, but only sent in pick mode.
// Picking people is the default; random sampling is the alternative.
const mode = ref<'sample' | 'pick'>(personaConfig.value.personaSource === 'sample' ? 'sample' : 'pick')
const pickedPersonaIds = ref<string[]>([...(personaConfig.value.personaIds ?? [])])
const pickedInfo = ref<PickedPersonaInfo[]>([])
const planInput = computed<PromptPlanInput>(() => ({
  promptCount: populationSize.value,
  objectiveCount: props.objectiveCount,
  // Same rule as the backend: a gender attribute always means counterfactual pairs.
  counterfactual: !!personaConfig.value.counterfactualEnabled || selectedAttributes.value.some(isGenderAttribute),
  picked: mode.value === 'pick' ? pickedInfo.value : null,
}))
watch(
  [mode, pickedPersonaIds],
  () =>
    update({
      personaSource: mode.value,
      personaIds: mode.value === 'pick' ? [...pickedPersonaIds.value] : [],
    }),
  // Immediately, so "pick with nobody chosen" blocks Generate from the start.
  { immediate: true },
)
// A restored population config may arrive after mount.
watch(
  () => personaConfig.value.personaIds,
  ids => {
    if (ids?.length && ids.join() !== pickedPersonaIds.value.join()) {
      pickedPersonaIds.value = [...ids]
      mode.value = 'pick'
    }
  },
)

onMounted(loadCatalog)

defineExpose({ previewPopulation })

function update(partial: Partial<PersonaConfig>) {
  personaConfig.value = { ...personaConfig.value, ...partial }
}

/** Filters / stratification survive only for attributes still chosen as a fairness label. */
function prunedSampling(keys: string[]) {
  const keep = new Set(keys)
  return {
    filters: Object.fromEntries(Object.entries(personaConfig.value.filters).filter(([key]) => keep.has(key))),
    stratify: personaConfig.value.stratify && keep.has(personaConfig.value.stratify) ? personaConfig.value.stratify : null,
  }
}

function setSelectedAttributes(selected: string[]) {
  // Drop filters / stratification that no longer refer to a chosen attribute.
  const { filters } = prunedSampling(selected)
  // A newly picked label starts filtered to the values LangFair has a group
  // for (e.g. Man/Woman), so sampled slots are not spent on personas the
  // comparison leaves out. The filter stays visible and editable.
  for (const key of selected) {
    if (personaConfig.value.selectedAttributes.includes(key) || filters[key]?.length) continue
    const values = catalog.supportedValues(key)
    if (values.length) filters[key] = values
  }
  const { stratify } = prunedSampling(selected)
  update({
    selectedAttributes: selected,
    filters,
    stratify,
    counterfactualEnabled: selected.some(isGenderAttribute),
  })
}

async function loadCatalog() {
  await catalog.load()
  applyCatalogPool()
}

async function retryCatalog() {
  await catalog.retry()
  applyCatalogPool()
}

function applyCatalogPool() {
  if (catalog.pool.value && !personaConfig.value.pool) update({ pool: catalog.pool.value })
}

function toggleAttribute(key: string) {
  selectedAttributes.value = selectedAttributes.value.includes(key)
    ? selectedAttributes.value.filter(value => value !== key)
    : [...selectedAttributes.value, key]
}

function unsupportedValues(key: string) {
  const supported = new Set(catalog.supportedValues(key))
  return catalog.valuesFor(catalog.attributeMap.value.get(key) ?? { key, label: key }).filter(value => !supported.has(value))
}

// Labels saved before they were limited to LangFair attributes are dropped
// once the supported list is known (the backend would reject them).
watch(
  () => catalog.protectedAttributes.value,
  list => {
    if (!list.length) return
    const kept = selectedAttributes.value.filter(key => catalog.protectedFor(key))
    if (kept.length !== selectedAttributes.value.length) setSelectedAttributes(kept)
  },
  { immediate: true },
)

function clearSelected() {
  selectedAttributes.value = []
  previewPersonas.value = []
}

function removeAttribute(key: string) {
  selectedAttributes.value = selectedAttributes.value.filter(value => value !== key)
}

async function previewPopulation() {
  sampling.value = true
  sampleError.value = null
  const seed = personaConfig.value.seed ?? freshSeed()
  try {
    const result = await personaApi.samplePersonas({
      sampleSize: Math.min(populationSize.value, catalog.previewSizeMax.value),
      selectedAttributes: selectedAttributes.value,
      filters: personaConfig.value.filters,
      stratify: personaConfig.value.stratify || null,
      seed,
      pool: personaConfig.value.pool || undefined,
    })
    previewPersonas.value = result.personas
    previewSeed.value = seed
    if (result.personas.length === 0) {
      sampleError.value = 'No personas matched the selected filters.'
    } else if (result.partial) {
      sampleError.value = `Only ${result.personas.length} preview personas matched the selected settings. Generation will require enough unique personas for the requested population size.`
    }
  } catch (e) {
    sampleError.value = formatApiError(e, 'Network error while loading persona data.')
  } finally {
    sampling.value = false
  }
}
</script>

<style scoped>
.persona-settings {
  margin-bottom: 20px;
}
.card-header,
.selected-summary,
.actions,
.inline-loading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.header-title {
  font-weight: 700;
}
.header-subtitle {
  margin: 4px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.section-gap {
  margin-bottom: 16px;
}
.protected-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}
.protected-option {
  padding: 12px 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
}
.protected-option.checked {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.protected-option .field-help {
  margin: 6px 0 0;
}
.source-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.top-grid {
  display: grid;
  grid-template-columns: minmax(220px, 0.7fr) minmax(320px, 1.3fr);
  gap: 16px;
}
.population-form,
.selected-panel {
  padding: 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  background: var(--el-fill-color-extra-light);
}
.field-help,
.disabled-note {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.panel-label {
  display: block;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.no-selection {
  margin: 8px 0 0;
}
.selected-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.compact-scroll {
  max-height: 74px;
  overflow: auto;
}
.actions {
  justify-content: flex-end;
  margin-top: 16px;
}
.inline-loading {
  justify-content: flex-start;
  margin-top: 12px;
}
@media (max-width: 900px) {
  .top-grid {
    grid-template-columns: 1fr;
  }
}
</style>
