<template>
  <el-card class="agent-config" shadow="never">
    <template #header>
      <span>Prompt Population Generator</span>
    </template>

    <template v-if="generationStatus !== 'completed'">
      <el-form label-position="top">
        <el-form-item label="Provider">
          <el-select v-model="form.provider" style="width: 100%">
            <el-option v-for="opt in PROVIDER_OPTIONS" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="Model">
          <el-input v-model="form.model" placeholder="Leave blank to use backend .env" />
        </el-form-item>
        <el-form-item :label="personaEnabled ? 'Population Size' : 'Prompt Count'">
          <el-input-number v-model="form.promptCount" :min="1" :max="1000" style="width: 100%" />
        </el-form-item>
        <el-form-item label="Temperature">
          <el-slider v-model="form.temperature" :min="0" :max="2" :step="0.1" show-input />
        </el-form-item>
        <el-form-item label="Additional Instructions (optional)">
          <el-input
            v-model="form.additionalInstructions"
            type="textarea"
            :rows="3"
            placeholder="Generate realistic and diverse prompts. Include different wording styles and different levels of detail."
          />
        </el-form-item>
      </el-form>

      <PersonaPopulationSettings
        v-model:enabled="personaEnabled"
        v-model:population-size="form.promptCount"
        v-model:config="personaConfig"
      />

      <div v-if="generationStatus === 'generating'" class="generating">
        <el-icon class="is-loading" :size="24"><Loading /></el-icon>
        <div>
          <p class="title">Generating Prompt Population...</p>
          <p class="subtitle">
            {{ personaEnabled ? `Generating ${form.promptCount} persona-based prompts...` : 'The agent is generating prompts from your use case.' }}
          </p>
        </div>
      </div>

      <el-alert
        v-if="generationStatus === 'failed'"
        type="error"
        show-icon
        :closable="false"
        :title="error || 'Prompt generation failed.'"
        class="generation-error"
      />

      <el-button
        type="primary"
        :disabled="generateDisabled"
        :loading="generationStatus === 'generating'"
        @click="handleGenerate"
      >
        {{ generationStatus === 'failed' ? 'Try Again' : 'Generate Prompt Population' }}
      </el-button>
    </template>

    <template v-else>
      <div class="completed">
        <p class="title">
          <el-icon color="var(--el-color-success)"><CircleCheckFilled /></el-icon>
          Prompt Population Generated
        </p>
        <p class="subtitle">{{ promptCount }} prompts</p>
        <div class="stats">
          <div class="stat">
            <span class="label">Generation Model</span>
            <span class="value">{{ population?.generationModel }}</span>
          </div>
          <div class="stat">
            <span class="label">Temperature</span>
            <span class="value">{{ population?.temperature }}</span>
          </div>
          <div class="stat">
            <span class="label">Requested</span>
            <span class="value">{{ population?.requested }}</span>
          </div>
          <div class="stat">
            <span class="label">Generated</span>
            <span class="value">{{ population?.generated }}</span>
          </div>
          <div class="stat">
            <span class="label">Persona-based</span>
            <span class="value">{{ population?.personaBased ? 'Yes' : 'No' }}</span>
          </div>
          <div v-if="population?.personaBased" class="stat">
            <span class="label">Seed</span>
            <span class="value">{{ population?.seed ?? '—' }}</span>
          </div>
        </div>
        <el-collapse class="regeneration-settings">
          <el-collapse-item name="settings" title="Regeneration settings">
            <el-alert
              type="info"
              show-icon
              :closable="false"
              title="Adjust these settings before regenerating. Counterfactual prompt pairs are under Persona Population → Advanced sampling options."
              class="generation-error"
            />
            <el-form label-position="top">
              <el-form-item label="Provider">
                <el-select v-model="form.provider" style="width: 100%">
                  <el-option v-for="opt in PROVIDER_OPTIONS" :key="opt.value" :label="opt.label" :value="opt.value" />
                </el-select>
              </el-form-item>
              <el-form-item label="Model">
                <el-input v-model="form.model" placeholder="Leave blank to use backend .env" />
              </el-form-item>
              <el-form-item :label="personaEnabled ? 'Population Size' : 'Prompt Count'">
                <el-input-number v-model="form.promptCount" :min="1" :max="1000" style="width: 100%" />
              </el-form-item>
              <el-form-item label="Temperature">
                <el-slider v-model="form.temperature" :min="0" :max="2" :step="0.1" show-input />
              </el-form-item>
              <el-form-item label="Additional Instructions (optional)">
                <el-input
                  v-model="form.additionalInstructions"
                  type="textarea"
                  :rows="3"
                  placeholder="Generate realistic and diverse prompts. Include different wording styles and different levels of detail."
                />
              </el-form-item>
            </el-form>

            <PersonaPopulationSettings
              v-model:enabled="personaEnabled"
              v-model:population-size="form.promptCount"
              v-model:config="personaConfig"
            />
          </el-collapse-item>
        </el-collapse>

        <el-button :disabled="generateDisabled" @click="showRegenerateDialog = true">Regenerate</el-button>
      </div>
    </template>

    <el-dialog v-model="showRegenerateDialog" title="How would you like to regenerate?" width="480px">
      <el-radio-group v-model="regenerateMode" class="regenerate-options">
        <el-radio label="replace" size="large" border class="regenerate-option">
          <div>
            <div class="option-title">Replace Population</div>
            <div class="option-desc">Delete current prompts and generate a new population.</div>
          </div>
        </el-radio>
        <el-radio label="additional" size="large" border class="regenerate-option">
          <div>
            <div class="option-title">Generate Additional Prompts</div>
            <div class="option-desc">Keep current prompts and generate additional prompts.</div>
          </div>
        </el-radio>
      </el-radio-group>
      <template #footer>
        <el-button @click="showRegenerateDialog = false">Cancel</el-button>
        <el-button type="primary" @click="handleRegenerateConfirm">Regenerate</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup lang="ts">
import { CircleCheckFilled, Loading } from '@element-plus/icons-vue'
import { computed, reactive, ref } from 'vue'

import PersonaPopulationSettings from '@/components/prompts/PersonaPopulationSettings.vue'
import {
  PROVIDER_OPTIONS,
  type GenerationStatus,
  type PersonaConfig,
  type PromptGenerationConfig,
  type PromptPopulationSummary,
  type RegenerateMode,
} from '@/types'

const props = defineProps<{
  config: PromptGenerationConfig
  generationStatus: GenerationStatus
  population: PromptPopulationSummary | null
  promptCount: number
  error?: string | null
}>()

const emit = defineEmits<{
  generate: [config: PromptGenerationConfig]
  regenerate: [mode: RegenerateMode, config: PromptGenerationConfig]
}>()

const form = reactive({ ...props.config })
const personaEnabled = ref(true)
const personaConfig = ref<PersonaConfig>({
  enabled: true,
  pool: '',
  selected_attributes: ['gender_identity'],
  filters: {},
  stratify: null,
  seed: freshSeed(),
  counterfactual_enabled: true,
})

const showRegenerateDialog = ref(false)
const regenerateMode = ref<RegenerateMode>('replace')

const generateDisabled = computed(
  () => generationStatusIsGenerating.value || (personaEnabled.value && personaConfig.value.selected_attributes.length === 0),
)
const generationStatusIsGenerating = computed(() => props.generationStatus === 'generating')

function generationPayload(): PromptGenerationConfig {
  const seed = freshSeed()
  personaConfig.value = { ...personaConfig.value, seed }
  return {
    ...form,
    persona: personaEnabled.value
      ? { ...personaConfig.value, enabled: true, seed }
      : { enabled: false, selected_attributes: [], filters: {}, stratify: null, seed, counterfactual_enabled: false },
  }
}

function freshSeed() {
  return Date.now() % 2_147_483_647
}

function handleGenerate() {
  emit('generate', generationPayload())
}

function handleRegenerateConfirm() {
  showRegenerateDialog.value = false
  emit('regenerate', regenerateMode.value, generationPayload())
}
</script>

<style scoped>
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
