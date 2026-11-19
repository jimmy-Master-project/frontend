<template>
  <el-card class="agent-config" shadow="never">
    <template #header>
      <div class="card-header">
        <span>Prompt Population Generator</span>
        <span class="header-note">Every generation creates a new population; earlier ones and their runs are kept.</span>
      </div>
    </template>

    <div v-if="generationStatus === 'completed' && population" class="latest">
      <el-icon color="var(--el-color-success)"><CircleCheckFilled /></el-icon>
      Latest: <b>{{ population.name || 'Unnamed' }}</b> #{{ population.populationId }} · {{ promptCount }} prompts ·
      {{ population.personaBased ? 'with personas' : 'without personas' }} · {{ population.generationModel }}
    </div>

    <el-alert
      v-if="loadedFrom"
      type="info"
      show-icon
      :title="`Settings loaded from ${loadedFrom}. Change only the factor you are testing, then generate.`"
      class="generation-error"
      @close="loadedFrom = ''"
    />

    <el-form label-position="top">
      <el-form-item>
        <template #label><FieldLabel label="Simulated personas" :help="FIELD_HELP.personaSwitch" /></template>
        <el-radio-group v-model="personaEnabled" data-test="persona-switch">
          <el-radio-button :value="true">Use personas</el-radio-button>
          <el-radio-button :value="false">No personas</el-radio-button>
        </el-radio-group>
      </el-form-item>
      <el-form-item>
        <template #label><FieldLabel label="Condition name (optional)" :help="FIELD_HELP.conditionName" /></template>
        <el-input v-model="conditionName" maxlength="255" placeholder="e.g. G1 No persona" data-test="condition-name" />
      </el-form-item>
      <el-form-item>
        <template #label><FieldLabel label="Provider" :help="FIELD_HELP.promptAgentProvider" /></template>
        <el-select v-model="form.provider" style="width: 100%">
          <el-option v-for="opt in PROMPT_AGENT_PROVIDER_OPTIONS" :key="opt.value" :label="opt.label" :value="opt.value" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <template #label><FieldLabel label="Model" :help="FIELD_HELP.promptAgentModel" /></template>
        <el-input v-model="form.modelName" placeholder="Leave blank to use backend .env" />
      </el-form-item>
      <el-form-item>
        <template #label>
          <FieldLabel
            :label="personaEnabled ? 'Population Size' : 'Prompt Count'"
            :help="personaEnabled ? FIELD_HELP.populationSize : FIELD_HELP.promptCount"
          />
        </template>
        <el-input-number v-model="form.promptCount" :min="1" :max="1000" style="width: 100%" />
      </el-form-item>
      <el-form-item>
        <template #label><FieldLabel label="Temperature" :help="FIELD_HELP.promptTemperature" /></template>
        <el-slider v-model="form.temperature" :min="0" :max="2" :step="0.1" show-input />
      </el-form-item>
      <el-form-item>
        <template #label><FieldLabel label="Additional Instructions (optional)" :help="FIELD_HELP.additionalInstruction" /></template>
        <el-input
          v-model="form.additionalInstruction"
          type="textarea"
          :rows="3"
          placeholder="Generate realistic and diverse prompts. Include different wording styles and different levels of detail."
        />
      </el-form-item>
    </el-form>

    <PersonaPopulationSettings
      v-if="personaEnabled"
      :key="settingsKey"
      v-model:enabled="personaEnabled"
      v-model:population-size="form.promptCount"
      v-model:config="personaConfig"
      :objective-count="objectiveCount"
    />
    <template v-else>
      <el-checkbox v-model="templatePairs" class="template-pairs" data-test="template-pairs">
        Template gender pairs: send each prompt as “I'm a woman. …” and “I'm a man. …” (baseline without personas)
      </el-checkbox>
      <el-alert
        v-if="!templatePairs"
        type="warning"
        show-icon
        :closable="false"
        class="template-pairs"
        title="Without gender pairs this population has no counterfactual prompts, so gender fairness metrics cannot be computed or compared with a persona condition."
      />
    </template>

    <div v-if="generationStatusIsGenerating" class="generating">
      <el-icon class="is-loading" :size="24"><Loading /></el-icon>
      <div>
        <p class="title">
          {{ generationStatus === 'pending' ? 'Queued for generation...' : 'Generating Prompt Population...' }}
        </p>
        <p class="subtitle">
          {{ personaEnabled ? `Generating ${form.promptCount} persona-based prompts...` : 'The agent is generating prompts from your use case.' }}
        </p>
        <p v-if="personaEnabled && lastUsedSeed !== null" class="subtitle">Sampling seed: {{ lastUsedSeed }}</p>
      </div>
    </div>

    <el-alert
      v-if="connectionLost"
      type="warning"
      show-icon
      :closable="false"
      :title="CONNECTION_LOST_MESSAGE"
      class="generation-error"
    />

    <el-alert
      v-if="generationStatus === 'failed'"
      type="error"
      show-icon
      :closable="false"
      :title="error || 'Prompt generation failed.'"
      class="generation-error"
    />

    <div class="actions">
      <el-button
        type="primary"
        :disabled="generateDisabled"
        :loading="generationStatusIsGenerating"
        @click="handleGenerate"
      >
        {{ generationStatus === 'completed' ? 'Generate New Population' : generationStatus === 'failed' ? 'Try Again' : 'Generate Prompt Population' }}
      </el-button>
      <span v-if="generationStatus === 'failed' && personaEnabled && lastUsedSeed !== null" class="seed-note">
        Last attempt used seed {{ lastUsedSeed }}
      </span>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import FieldLabel from '@/components/common/FieldLabel.vue'
import { FIELD_HELP } from '@/utils/fieldHelp'
import { CircleCheckFilled, Loading } from '@element-plus/icons-vue'
import { computed, reactive, ref } from 'vue'

import PersonaPopulationSettings from '@/components/prompts/PersonaPopulationSettings.vue'
import { CONNECTION_LOST_MESSAGE } from '@/composables/usePolling'
import { freshSeed } from '@/composables/usePersonaCatalog'
import {
  PROMPT_AGENT_PROVIDER_OPTIONS,
  type GenerationStatus,
  type PersonaConfig,
  type PromptGenerationConfig,
  type PromptPopulationSummary,
} from '@/types'

const props = defineProps<{
  config: PromptGenerationConfig
  generationStatus: GenerationStatus
  population: PromptPopulationSummary | null
  promptCount: number
  error?: string | null
  connectionLost?: boolean
  /** Task objectives of the evaluation (each repeats the whole population). */
  objectiveCount?: number
}>()

const emit = defineEmits<{
  generate: [config: PromptGenerationConfig]
}>()

const form = reactive({ ...props.config })
const personaEnabled = ref(true)
// Without personas, pair prompts with "I'm a woman." / "I'm a man." (experiment baseline).
// On by default: without pairs a no-persona population has no gender
// counterfactuals, so its fairness metrics cannot be compared with persona runs.
const templatePairs = ref(true)
const personaConfig = ref<PersonaConfig>({
  enabled: true,
  pool: '',
  selectedAttributes: ['gender_identity'],
  filters: {},
  stratify: null,
  // null = random: a fresh seed is drawn per generation (and reported back).
  seed: null,
  counterfactualEnabled: true,
})
// Nothing is carried over from earlier populations: every generation starts
// from these defaults (random sampling, fresh seed) unless the user changes them.
// The seed actually sent with the most recent generate/regenerate request.
const lastUsedSeed = ref<number | null>(null)

const conditionName = ref('')
// Re-mounts the persona panel so loaded settings (source, picked ids, list) apply.
const settingsKey = ref(0)
const loadedFrom = ref('')

const DEFAULT_PERSONA_CONFIG: PersonaConfig = { ...personaConfig.value }

/**
 * Goes back to the generation step of an earlier population: fills every
 * setting from the request that produced it (including the persona seed or
 * list actually used), so a new population differs only in what is changed.
 */
function applySettings(request: Partial<PromptGenerationConfig>, label: string) {
  if (request.provider) form.provider = request.provider
  if (request.modelName !== undefined) form.modelName = request.modelName
  if (request.promptCount) form.promptCount = request.promptCount
  if (request.temperature !== undefined) form.temperature = request.temperature
  form.additionalInstruction = request.additionalInstruction ?? ''
  const persona = request.persona
  personaEnabled.value = Boolean(persona?.enabled)
  // Only a no-persona request decides the pairs; switching a loaded persona
  // condition to "No personas" keeps the default (pairs on).
  templatePairs.value = persona?.enabled ? true : Boolean(request.counterfactualTemplate)
  personaConfig.value = persona?.enabled
    ? {
        ...DEFAULT_PERSONA_CONFIG,
        ...persona,
        filters: { ...(persona.filters ?? {}) },
        personaSource: persona.personaSetId ? 'set' : persona.personaIds?.length ? 'pick' : 'sample',
      }
    : { ...DEFAULT_PERSONA_CONFIG }
  conditionName.value = ''
  settingsKey.value += 1
  loadedFrom.value = label
}

defineExpose({ applySettings })

const generateDisabled = computed(
  () =>
    generationStatusIsGenerating.value ||
    (personaEnabled.value &&
      (personaConfig.value.selectedAttributes.length === 0 ||
        // Pick mode with nothing ticked would silently fall back to sampling.
        ((personaConfig.value.personaSource === 'pick' || personaConfig.value.personaSource === 'set') &&
          !personaConfig.value.personaIds?.length))),
)
const generationStatusIsGenerating = computed(
  () => props.generationStatus === 'generating' || props.generationStatus === 'pending',
)

function generationPayload(): PromptGenerationConfig {
  // Keep a user-chosen seed as-is (reproducible); only draw a fresh one when
  // the seed is set to random. The user's setting itself is not overwritten.
  const seed = personaConfig.value.seed ?? freshSeed()
  lastUsedSeed.value = seed
  return {
    ...form,
    name: conditionName.value.trim(),
    persona: personaEnabled.value
      ? {
          ...personaConfig.value,
          enabled: true,
          seed,
          // The backend uses any non-empty personaIds instead of sampling, so only
          // send them when the user explicitly chose "Pick personas".
          personaIds:
            personaConfig.value.personaSource === 'pick' || personaConfig.value.personaSource === 'set'
              ? personaConfig.value.personaIds
              : [],
          personaSetId: personaConfig.value.personaSource === 'set' ? personaConfig.value.personaSetId ?? null : null,
        }
      : { enabled: false, selectedAttributes: [], filters: {}, stratify: null, seed, counterfactualEnabled: false },
    counterfactualTemplate: !personaEnabled.value && templatePairs.value,
  }
}

function handleGenerate() {
  emit('generate', generationPayload())
  conditionName.value = ''
  loadedFrom.value = ''
}

</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.header-note,
.latest {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.latest {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 16px;
}
.actions {
  margin-top: 16px;
}
.template-pairs {
  margin-top: 12px;
  white-space: normal;
  height: auto;
}
.generating {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 0;
}
.generating .title {
  margin: 0;
  font-weight: 600;
}
.generating .subtitle {
  margin: 4px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.generation-error {
  margin-bottom: 16px;
}
.seed-note {
  margin-left: 12px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.completed .title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 4px;
}
.completed .subtitle {
  color: var(--el-text-color-secondary);
  margin: 0 0 16px;
}
.stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}
.stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.stat .label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.stat .value {
  font-size: 14px;
  font-weight: 600;
}
.regenerate-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}
.regenerate-option {
  height: auto;
  width: 100%;
  padding: 12px 16px;
  white-space: normal;
}
.option-title {
  font-weight: 600;
}
.option-desc {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}
</style>
