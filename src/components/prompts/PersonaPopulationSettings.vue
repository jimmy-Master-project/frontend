<template>
  <el-card class="persona-settings" shadow="never">
    <template #header>
      <div class="card-header">
        <div>
          <span class="header-title">Persona Population</span>
          <p class="header-subtitle">The prompt generator always sees each persona's full attribute set. Selecting attributes here only marks them as the diagnostic attribute(s) to analyze (e.g. gender_identity for counterfactual pairing) and filters out personas missing them.</p>
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
              <span class="panel-label">Selected attributes</span>
              <strong>{{ selectedAttributes.length }}</strong>
            </div>
            <el-button v-if="selectedAttributes.length" text type="primary" @click="clearSelected">Clear all</el-button>
          </div>
          <div v-if="selectedAttributes.length" class="selected-tags compact-scroll">
            <el-tag v-for="key in selectedAttributes" :key="key" closable @close="removeAttribute(key)">
              {{ catalog.labelFor(key) }}
            </el-tag>
          </div>
          <p v-else class="field-help no-selection">Choose one or more dimensions to diagnose (e.g. gender_identity for the counterfactual pipeline).</p>
        </div>
      </div>

      <el-divider content-position="left">Persona Attributes</el-divider>

      <el-alert
        type="info"
        show-icon
        :closable="false"
        class="section-gap"
        title="Select the attribute(s) you want to diagnose for fairness. Every persona attribute is still passed to the prompt generator regardless of what you select here -- this only marks which attribute(s) are being analyzed and requires personas to have them."
      />

      <PersonaAttributePicker
        v-model:selected="selectedAttributes"
        :attributes="catalog.attributes.value"
        :loading="catalog.loading.value"
      />

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

    <p v-else class="disabled-note">Persona disabled. The existing Prompt Population Generation flow will be used.</p>
  </el-card>
</template>

<script setup lang="ts">
import { Loading } from '@element-plus/icons-vue'
import { computed, onMounted, ref, watch } from 'vue'

import PersonaAttributePicker from '@/components/prompts/PersonaAttributePicker.vue'
import PersonaFilterPanel from '@/components/prompts/PersonaFilterPanel.vue'
import PersonaPreviewGrid from '@/components/prompts/PersonaPreviewGrid.vue'
import { freshSeed, isGenderAttribute, usePersonaCatalog } from '@/composables/usePersonaCatalog'
import { formatApiError } from '@/services/api'
import { personaApi } from '@/services/personaApi'
import type { PersonaAttribute, PersonaConfig, PersonaPreview } from '@/types'

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

onMounted(loadCatalog)

defineExpose({ previewPopulation })

function update(partial: Partial<PersonaConfig>) {
  personaConfig.value = { ...personaConfig.value, ...partial }
}

function setSelectedAttributes(selected: string[]) {
  // Drop filters / stratification that no longer refer to a selected attribute.
  const filters = Object.fromEntries(
    Object.entries(personaConfig.value.filters).filter(([key]) => selected.includes(key)),
  )
  const stratify = personaConfig.value.stratify && selected.includes(personaConfig.value.stratify)
    ? personaConfig.value.stratify
    : null
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
