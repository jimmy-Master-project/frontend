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
        v-if="error"
        type="error"
        show-icon
        :closable="false"
        :title="error"
        class="section-gap"
      />

      <div class="top-grid">
        <el-form label-position="top" class="population-form">
          <el-form-item label="Population Size">
            <el-input-number
              v-model="populationSize"
              :min="sampleSizeMin"
              :max="sampleSizeMax"
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
              {{ labelFor(key) }}
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

      <div class="attribute-toolbar">
        <el-input v-model="search" clearable placeholder="Search attributes, e.g. gender_identity, age_bracket, risk_tolerance">
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <div class="catalog-meta">
          <el-tag type="info">{{ attributes.length }} attributes</el-tag>
          <el-tag v-if="filteredAttributeCount !== attributes.length" type="warning">
            {{ filteredAttributeCount }} matched
          </el-tag>
        </div>
      </div>

      <LoadingState v-if="catalogLoading" text="Loading persona attributes..." />
      <template v-else>
        <div class="attribute-picker">
          <aside class="category-sidebar">
            <button
              type="button"
              class="category-button"
              :class="{ active: activeCategory === 'all' }"
              @click="activeCategory = 'all'"
            >
              <span>All attributes</span>
              <small>{{ filteredAttributeCount }}</small>
            </button>
            <button
              v-for="group in filteredGroups"
              :key="group.category"
              type="button"
              class="category-button"
              :class="{ active: activeCategory === group.category }"
              @click="activeCategory = group.category"
            >
              <span>{{ group.category }}</span>
              <small>{{ group.attributes.length }}</small>
            </button>
          </aside>

          <section class="attribute-results">
            <div class="results-header">
              <div>
                <h3>{{ activeCategoryTitle }}</h3>
                <p>{{ visibleAttributes.length }} available dimensions</p>
              </div>
              <el-button v-if="visibleAttributes.length" size="small" @click="selectVisibleAttributes">
                Select visible
              </el-button>
            </div>

            <el-empty v-if="visibleAttributes.length === 0" description="No attributes match your search." :image-size="80" />
            <div v-else class="attribute-card-grid">
              <button
                v-for="attribute in visibleAttributes"
                :key="attribute.key"
                type="button"
                class="attribute-card"
                :class="{ selected: isSelected(attribute.key) }"
                @click="toggleAttribute(attribute.key)"
              >
                <div class="attribute-card-main">
                  <el-checkbox :model-value="isSelected(attribute.key)" @click.stop @change="toggleAttribute(attribute.key)" />
                  <div>
                    <strong>{{ labelFor(attribute.key) }}</strong>
                    <code>{{ attribute.key }}</code>
                  </div>
                </div>
                <p v-if="attribute.description" class="attribute-description">{{ attribute.description }}</p>
                <div class="attribute-card-footer">
                  <el-tag size="small" effect="plain">{{ attribute.category || 'Other' }}</el-tag>
                  <span v-if="valuesFor(attribute).length" class="value-count">
                    {{ valuesFor(attribute).length }} values
                  </span>
                </div>
              </button>
            </div>
          </section>
        </div>
      </template>

      <el-collapse class="advanced-options">
        <el-collapse-item name="advanced">
          <template #title>
            <div class="advanced-title">
              <span>Advanced sampling options</span>
              <el-tag v-if="activeFilterCount" size="small" type="success">{{ activeFilterCount }} filters</el-tag>
              <el-tag v-if="stratifyValue" size="small" type="primary">Balanced by {{ labelFor(stratifyValue) }}</el-tag>
            </div>
          </template>

          <div class="advanced-grid">
            <el-card shadow="never" class="option-card">
              <template #header>Filter personas</template>
              <div v-if="filterableAttributes.length" class="filter-list">
                <div v-for="attribute in filterableAttributes" :key="attribute.key" class="filter-block">
                  <div class="filter-label">
                    <span>{{ labelFor(attribute.key) }}</span>
                    <small>{{ filters[attribute.key]?.length || 0 }} selected</small>
                  </div>
                  <el-checkbox-group v-model="filters[attribute.key]" class="filter-values">
                    <el-checkbox v-for="value in valuesFor(attribute)" :key="value" :label="value">
                      {{ value }}
                    </el-checkbox>
                  </el-checkbox-group>
                </div>
              </div>
              <el-empty v-else description="Select categorical attributes to enable filters." :image-size="60" />
            </el-card>

            <el-card shadow="never" class="option-card">
              <template #header>Sampling controls</template>
              <el-form label-position="top">
                <el-form-item label="Stratified sampling">
                  <el-select v-model="stratifyValue" style="width: 100%" placeholder="None">
                    <el-option label="None" value="" />
                    <el-option
                      v-for="attribute in selectedAttributeObjects"
                      :key="attribute.key"
                      :label="labelFor(attribute.key)"
                      :value="attribute.key"
                    />
                  </el-select>
                </el-form-item>

                <el-form-item label="Counterfactual prompt pairs">
                  <el-switch
                    v-model="counterfactualEnabled"
                    disabled
                    active-text="Gender counterfactual pairs are automatic"
                  />
                  <p class="field-help">
                    Automatically enabled when gender_identity or gender is selected. Each sampled persona generates an original/counterfactual pair.
                  </p>
                </el-form-item>

                <el-form-item label="Sampling Seed">
                  <el-input-number v-model="seed" :min="0" style="width: 100%" />
                </el-form-item>

                <el-form-item v-if="pool" label="Persona Pool">
                  <el-input v-model="pool" />
                </el-form-item>
              </el-form>
            </el-card>
          </div>
        </el-collapse-item>
      </el-collapse>

      <div class="actions">
        <el-button :disabled="selectedAttributes.length === 0 || sampling" :loading="sampling" @click="previewPopulation">
          Preview Population
        </el-button>
      </div>

      <div v-if="sampling" class="inline-loading">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span>Sampling personas...</span>
      </div>

      <div v-if="previewPersonas.length" class="preview">
        <h3>Population Preview</h3>
        <div class="preview-grid">
          <el-card v-for="persona in previewPersonas" :key="persona.persona_id" shadow="never" class="preview-card">
            <h4>Persona {{ persona.persona_id }}</h4>
            <dl>
              <template v-for="key in selectedAttributes" :key="key">
                <dt>{{ labelFor(key) }}</dt>
                <dd>{{ displayPersonaValue(persona, key) }}</dd>
              </template>
            </dl>
            <div v-if="persona.missing_attributes?.length" class="missing">
              Missing: {{ persona.missing_attributes.map(labelFor).join(', ') }}
            </div>
          </el-card>
        </div>
      </div>
    </template>

    <p v-else class="disabled-note">Persona disabled. The existing Prompt Population Generation flow will be used.</p>
  </el-card>
</template>

<script setup lang="ts">
import { Loading, Search } from '@element-plus/icons-vue'
import { computed, onMounted, reactive, ref, watch } from 'vue'

import LoadingState from '@/components/common/LoadingState.vue'
import { personaApi } from '@/services/personaApi'
import type { PersonaAttribute, PersonaConfig, PersonaPreview } from '@/types'

const enabled = defineModel<boolean>('enabled', { default: true })
const populationSize = defineModel<number>('populationSize', { default: 20 })
const personaConfig = defineModel<PersonaConfig>('config', { required: true })

const attributes = ref<PersonaAttribute[]>([])
const catalogLoading = ref(false)
const sampling = ref(false)
const error = ref<string | null>(null)
const search = ref('')
const selectedAttributes = ref<string[]>(
  personaConfig.value.selected_attributes.length
    ? [...personaConfig.value.selected_attributes]
    : ['gender_identity'],
)
const filters = reactive<Record<string, string[]>>({ ...personaConfig.value.filters })
const stratifyValue = ref(personaConfig.value.stratify ?? '')
const seed = ref(personaConfig.value.seed ?? 42)
const pool = ref(personaConfig.value.pool ?? '')
const counterfactualEnabled = ref(
  personaConfig.value.counterfactual_enabled ?? personaConfig.value.selected_attributes.some(key => key === 'gender_identity' || key === 'gender'),
)
const sampleSizeMin = ref(1)
const sampleSizeMax = ref(1000)
const previewSizeMax = ref(50)
const previewPersonas = ref<PersonaPreview[]>([])
const activeCategory = ref('all')

const sampleSizeHelp = computed(() => `Allowed range: ${sampleSizeMin.value}–${sampleSizeMax.value}`)

const attributeMap = computed(() => new Map(attributes.value.map(attribute => [attribute.key, attribute])))

const selectedAttributeObjects = computed(() =>
  selectedAttributes.value.map(key => attributeMap.value.get(key)).filter((attribute): attribute is PersonaAttribute => Boolean(attribute)),
)

const groupedAttributes = computed(() => {
  const groups = new Map<string, PersonaAttribute[]>()
  for (const attribute of attributes.value) {
    const category = attribute.category || 'Other'
    if (!groups.has(category)) groups.set(category, [])
    groups.get(category)?.push(attribute)
  }
  return Array.from(groups, ([category, groupAttributes]) => ({ category, attributes: groupAttributes }))
})

const filteredGroups = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  if (!keyword) return groupedAttributes.value
  return groupedAttributes.value
    .map(group => ({
      category: group.category,
      attributes: group.attributes.filter(attribute =>
        [attribute.key, attribute.label, attribute.description, attribute.category]
          .filter(Boolean)
          .some(value => String(value).toLowerCase().includes(keyword)),
      ),
    }))
    .filter(group => group.attributes.length > 0)
})

const filteredAttributeCount = computed(() => filteredGroups.value.reduce((total, group) => total + group.attributes.length, 0))

const visibleAttributes = computed(() => {
  if (activeCategory.value === 'all') return filteredGroups.value.flatMap(group => group.attributes)
  return filteredGroups.value.find(group => group.category === activeCategory.value)?.attributes || []
})

const activeCategoryTitle = computed(() => (activeCategory.value === 'all' ? 'All attributes' : activeCategory.value))

const filterableAttributes = computed(() => selectedAttributeObjects.value.filter(attribute => valuesFor(attribute).length > 0))

const hasSelectedGenderAttribute = computed(() => selectedAttributes.value.some(key => key === 'gender_identity' || key === 'gender'))

const activeFilterCount = computed(() => Object.values(activeFilters()).reduce((total, values) => total + values.length, 0))

watch(filteredGroups, groups => {
  if (activeCategory.value !== 'all' && !groups.some(group => group.category === activeCategory.value)) {
    activeCategory.value = 'all'
  }
})

watch(selectedAttributes, selected => {
  for (const key of Object.keys(filters)) {
    if (!selected.includes(key)) delete filters[key]
  }
  for (const key of selected) {
    if (!filters[key]) filters[key] = []
  }
  if (stratifyValue.value && !selected.includes(stratifyValue.value)) {
    stratifyValue.value = ''
  }
  counterfactualEnabled.value = hasSelectedGenderAttribute.value
  syncConfig()
})

watch([filters, stratifyValue, seed, pool, enabled, counterfactualEnabled], syncConfig, { deep: true })

onMounted(loadAttributes)

defineExpose({ previewPopulation })

async function loadAttributes() {
  if (attributes.value.length) return
  catalogLoading.value = true
  error.value = null
  try {
    const catalog = await personaApi.getPersonaAttributes()
    attributes.value = prioritizeAttributes(catalog.attributes)
    if (catalog.pool) pool.value = catalog.pool
    if (catalog.sampleSizeMin) sampleSizeMin.value = catalog.sampleSizeMin
    if (catalog.sampleSizeMax) sampleSizeMax.value = catalog.sampleSizeMax
    if (catalog.previewSizeMax) previewSizeMax.value = catalog.previewSizeMax
  } catch (e) {
    error.value = formatPersonaError(e)
  } finally {
    catalogLoading.value = false
  }
}

function syncConfig() {
  personaConfig.value = {
    enabled: enabled.value,
    pool: pool.value || undefined,
    selected_attributes: selectedAttributes.value,
    filters: activeFilters(),
    stratify: stratifyValue.value || null,
    seed: seed.value,
    counterfactual_enabled: counterfactualEnabled.value,
  }
}

function activeFilters() {
  return Object.fromEntries(
    Object.entries(filters)
      .map(([key, values]) => [key, values.filter(Boolean)])
      .filter(([, values]) => values.length > 0),
  ) as Record<string, string[]>
}

function labelFor(key: string) {
  return attributeMap.value.get(key)?.label || humanizeKey(key)
}

function humanizeKey(key: string) {
  return key
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function prioritizeAttributes(list: PersonaAttribute[]) {
  const priority = new Map<string, number>([
    ['gender_identity', 0],
    ['age_bracket', 1],
    ['risk_tolerance', 2],
    ['region', 3],
    ['socioeconomic_band', 4],
  ])
  return [...list].sort((a, b) => {
    const priorityDiff = (priority.get(a.key) ?? 1000) - (priority.get(b.key) ?? 1000)
    if (priorityDiff !== 0) return priorityDiff
    return labelForRaw(a).localeCompare(labelForRaw(b))
  })
}

function labelForRaw(attribute: PersonaAttribute) {
  return attribute.label || humanizeKey(attribute.key)
}

function valuesFor(attribute: PersonaAttribute) {
  return attribute.values || attribute.allowedValues || []
}

function isSelected(key: string) {
  return selectedAttributes.value.includes(key)
}

function toggleAttribute(key: string) {
  selectedAttributes.value = isSelected(key)
    ? selectedAttributes.value.filter(value => value !== key)
    : [...selectedAttributes.value, key]
}

function selectVisibleAttributes() {
  const next = new Set(selectedAttributes.value)
  for (const attribute of visibleAttributes.value) next.add(attribute.key)
  selectedAttributes.value = Array.from(next)
}

function clearSelected() {
  selectedAttributes.value = []
  previewPersonas.value = []
}

function removeAttribute(key: string) {
  selectedAttributes.value = selectedAttributes.value.filter(value => value !== key)
}

function displayPersonaValue(persona: PersonaPreview, key: string) {
  if (persona.missing_attributes?.includes(key)) return 'Not available'
  return persona.attributes?.[key] ?? 'Not available'
}

async function previewPopulation() {
  sampling.value = true
  error.value = null
  try {
    const result = await personaApi.samplePersonas({
      sample_size: Math.min(populationSize.value, previewSizeMax.value),
      selected_attributes: selectedAttributes.value,
      filters: activeFilters(),
      stratify: stratifyValue.value || null,
      seed: seed.value,
      pool: pool.value || undefined,
    })
    previewPersonas.value = result.personas
    if (result.personas.length === 0) {
      error.value = 'No personas matched the selected filters.'
    } else if (result.partial) {
      error.value = `Only ${result.personas.length} preview personas matched the selected settings. Generation will require enough unique personas for the requested population size.`
    }
  } catch (e) {
    error.value = formatPersonaError(e)
  } finally {
    sampling.value = false
  }
}

function formatPersonaError(e: unknown) {
  const response = (e as { response?: { data?: unknown } }).response
  const data = response?.data as { error?: string; message?: string } | undefined
  const code = data?.error
  if (code === 'matraix_unavailable') return 'Persona service is currently unavailable.'
  if (code === 'no_personas_matched') return 'No personas matched the selected filters.'
  if (code === 'invalid_filters') return 'Invalid persona filters.'
  if (code === 'missing_attributes') return 'Selected persona attributes are unavailable.'
  // The backend puts the real, human-readable failure reason in `message` on
  // some error paths and `error` on others -- surface whichever is present.
  if (data?.message) return data.message
  if (typeof code === 'string' && code) return code
  return 'Network error while loading persona data.'
}
</script>

<style scoped>
.persona-settings {
  margin-bottom: 20px;
}
.card-header,
.selected-summary,
.attribute-toolbar,
.results-header,
.actions,
.inline-loading,
.advanced-title,
.filter-label {
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
.top-grid,
.advanced-grid {
  display: grid;
  grid-template-columns: minmax(220px, 0.7fr) minmax(320px, 1.3fr);
  gap: 16px;
}
.population-form,
.selected-panel,
.option-card {
  padding: 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  background: var(--el-fill-color-extra-light);
}
.field-help,
.disabled-note,
.attribute-description,
.missing,
.results-header p,
.value-count,
.filter-label small {
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
.selected-tags,
.filter-values,
.catalog-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.compact-scroll {
  max-height: 74px;
  overflow: auto;
}
.recommended-section {
  padding: 14px;
  border: 1px solid var(--el-color-primary-light-7);
  border-radius: 12px;
  background: var(--el-color-primary-light-9);
  margin-bottom: 16px;
}
.recommended-header {
  margin-bottom: 12px;
}
.recommended-header h3,
.recommended-header p {
  margin: 0;
}
.recommended-header p {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  margin-top: 4px;
}
.recommended-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 12px;
}
.recommended-card {
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
  padding: 12px;
  background: var(--el-bg-color);
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  text-align: left;
}
.recommended-card.selected {
  border-color: var(--el-color-success);
}
.recommended-card strong,
.recommended-card code {
  display: block;
}
.recommended-card code {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  margin-top: 3px;
}
.recommended-card p {
  margin: 8px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.4;
}
.attribute-toolbar {
  margin-bottom: 14px;
}
.catalog-meta {
  flex: 0 0 auto;
}
.attribute-picker {
  display: grid;
  grid-template-columns: 230px 1fr;
  min-height: 420px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 12px;
  overflow: hidden;
}
.category-sidebar {
  padding: 10px;
  background: var(--el-fill-color-light);
  border-right: 1px solid var(--el-border-color-light);
  max-height: 560px;
  overflow: auto;
}
.category-button {
  width: 100%;
  border: 0;
  border-radius: 8px;
  background: transparent;
  padding: 10px 12px;
  color: var(--el-text-color-regular);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  text-align: left;
  gap: 10px;
}
.category-button:hover {
  background: var(--el-fill-color);
}
.category-button.active {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  font-weight: 700;
}
.category-button small {
  color: var(--el-text-color-secondary);
}
.attribute-results {
  padding: 16px;
  max-height: 560px;
  overflow: auto;
}
.results-header {
  margin-bottom: 14px;
}
.results-header h3,
.results-header p {
  margin: 0;
}
.attribute-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(245px, 1fr));
  gap: 12px;
}
.attribute-card {
  border: 1px solid var(--el-border-color-light);
  border-radius: 12px;
  padding: 12px;
  background: var(--el-bg-color);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
}
.attribute-card:hover {
  border-color: var(--el-color-primary-light-5);
  box-shadow: var(--el-box-shadow-lighter);
}
.attribute-card.selected {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.attribute-card-main {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.attribute-card strong,
.attribute-card code {
  display: block;
}
.attribute-card code {
  margin-top: 3px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  word-break: break-all;
}
.attribute-description {
  margin: 10px 0 0;
}
.attribute-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 12px;
}
.advanced-options {
  margin-top: 16px;
}
.advanced-title {
  justify-content: flex-start;
}
.filter-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-height: 430px;
  overflow: auto;
}
.filter-block {
  padding-bottom: 14px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.filter-values {
  margin-top: 8px;
}
.actions {
  justify-content: flex-end;
  margin-top: 16px;
}
.inline-loading {
  justify-content: flex-start;
  margin-top: 12px;
}
.preview h3 {
  margin: 20px 0 12px;
}
.preview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}
.preview-card h4 {
  margin: 0 0 12px;
}
dl {
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: 6px 10px;
  margin: 0;
}
dt {
  color: var(--el-text-color-secondary);
}
dd {
  margin: 0;
  font-weight: 600;
}
@media (max-width: 900px) {
  .top-grid,
  .advanced-grid,
  .attribute-picker {
    grid-template-columns: 1fr;
  }
  .category-sidebar {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    border-right: 0;
    border-bottom: 1px solid var(--el-border-color-light);
  }
  .category-button {
    min-width: 180px;
  }
}
</style>
