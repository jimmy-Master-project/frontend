<template>
  <el-collapse class="advanced-options">
    <el-collapse-item name="advanced">
      <template #title>
        <div class="advanced-title">
          <span>Advanced sampling options</span>
          <el-tag v-if="activeFilterCount" size="small" type="success">{{ activeFilterCount }} filters</el-tag>
          <el-tag v-if="config.stratify" size="small" type="primary">Balanced by {{ labelFor(config.stratify) }}</el-tag>
        </div>
      </template>

      <div class="advanced-grid">
        <el-card shadow="never" class="option-card">
          <template #header>Filter personas</template>
          <div v-if="filterableAttributes.length" class="filter-list">
            <div v-for="attribute in filterableAttributes" :key="attribute.key" class="filter-block">
              <div class="filter-label">
                <span>{{ labelFor(attribute.key) }}</span>
                <small>{{ config.filters[attribute.key]?.length || 0 }} selected</small>
              </div>
              <el-checkbox-group
                :model-value="config.filters[attribute.key] ?? []"
                class="filter-values"
                @update:model-value="(values: Array<string | number>) => setFilterValues(attribute.key, values)"
              >
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
              <el-select
                :model-value="config.stratify ?? ''"
                style="width: 100%"
                placeholder="None"
                @update:model-value="setStratify"
              >
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
                :model-value="Boolean(config.counterfactualEnabled)"
                disabled
                active-text="Gender counterfactual pairs are automatic"
              />
              <p class="field-help">
                Automatically enabled when gender_identity or gender is selected. Each sampled persona generates an original/counterfactual pair.
              </p>
            </el-form-item>

            <el-form-item label="Sampling Seed">
              <div class="seed-row">
                <el-switch :model-value="randomSeed" active-text="Random" @update:model-value="toggleRandomSeed" />
                <el-input-number
                  v-if="!randomSeed"
                  :model-value="config.seed ?? undefined"
                  :min="0"
                  style="flex: 1"
                  @update:model-value="setSeed"
                />
              </div>
              <p class="field-help">
                {{
                  randomSeed
                    ? 'A new seed is drawn for every generation; the seed actually used is shown afterwards.'
                    : 'Fixed seed: the same settings always sample the same personas.'
                }}
              </p>
            </el-form-item>

            <el-form-item v-if="config.pool" label="Persona Pool">
              <el-input :model-value="config.pool" @update:model-value="setPool" />
            </el-form-item>
          </el-form>
        </el-card>
      </div>
    </el-collapse-item>
  </el-collapse>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { usePersonaCatalog } from '@/composables/usePersonaCatalog'
import type { PersonaAttribute, PersonaConfig } from '@/types'

const props = defineProps<{
  selectedAttributeObjects: PersonaAttribute[]
  /** Seed to fill in when switching from random to a fixed seed. */
  suggestedSeed?: number | null
}>()

const config = defineModel<PersonaConfig>('config', { required: true })

const { labelFor, valuesFor } = usePersonaCatalog()

const filterableAttributes = computed(() => props.selectedAttributeObjects.filter(attribute => valuesFor(attribute).length > 0))

const activeFilterCount = computed(() =>
  Object.values(config.value.filters).reduce((total, values) => total + values.length, 0),
)

const randomSeed = computed(() => config.value.seed === null)

function update(partial: Partial<PersonaConfig>) {
  config.value = { ...config.value, ...partial }
}

function setFilterValues(key: string, values: Array<string | number>) {
  const nextFilters = { ...config.value.filters }
  const cleaned = values.map(String).filter(Boolean)
  if (cleaned.length) nextFilters[key] = cleaned
  else delete nextFilters[key]
  update({ filters: nextFilters })
}

function setStratify(value: string) {
  update({ stratify: value || null })
}

function toggleRandomSeed(value: string | number | boolean) {
  update({ seed: value ? null : props.suggestedSeed ?? 42 })
}

function setSeed(value: number | undefined) {
  update({ seed: value ?? 0 })
}

function setPool(value: string) {
  update({ pool: value || undefined })
}
</script>

<style scoped>
.advanced-options {
  margin-top: 16px;
}
.advanced-title,
.filter-label {
  display: flex;
  align-items: center;
  gap: 12px;
}
.advanced-title {
  justify-content: flex-start;
}
.filter-label {
  justify-content: space-between;
}
.advanced-grid {
  display: grid;
  grid-template-columns: minmax(220px, 0.7fr) minmax(320px, 1.3fr);
  gap: 16px;
}
.option-card {
  padding: 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  background: var(--el-fill-color-extra-light);
}
.field-help,
.filter-label small {
  color: var(--el-text-color-secondary);
  font-size: 13px;
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
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 8px;
}
.seed-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}
@media (max-width: 900px) {
  .advanced-grid {
    grid-template-columns: 1fr;
  }
}
</style>
