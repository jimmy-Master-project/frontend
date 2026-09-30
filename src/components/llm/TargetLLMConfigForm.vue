<template>
  <el-form label-position="top">
    <el-form-item label="Bot Name">
      <el-input v-model="form.modelName" placeholder="Enter a bot name or model identifier" />
    </el-form-item>
    <el-form-item label="Provider">
      <el-select v-model="form.provider" style="width: 100%">
        <el-option v-for="opt in PROVIDER_OPTIONS" :key="opt.value" :label="opt.label" :value="opt.value" />
      </el-select>
    </el-form-item>

    <el-form-item :label="form.provider === 'custom' ? 'Robot POST URL' : 'Base URL'">
      <el-input
        v-model="form.baseUrl"
        :placeholder="form.provider === 'custom' ? 'https://robot.example.com/generate' : 'http://localhost:1234/v1'"
      />
    </el-form-item>
    <el-form-item label="API Key">
      <el-input v-model="form.apiKey" type="password" show-password placeholder="••••••••••" />
    </el-form-item>
    <el-form-item label="Temperature">
      <el-slider v-model="form.temperature" :min="0" :max="2" :step="0.1" show-input />
    </el-form-item>
    <el-form-item label="Top P">
      <el-slider v-model="form.topP" :min="0" :max="1" :step="0.05" show-input />
    </el-form-item>
    <el-form-item label="Max Tokens">
      <el-input-number v-model="form.maxTokens" :min="1" style="width: 100%" />
    </el-form-item>
    <el-divider />
    <el-form-item label="Outputs Per Prompt (k)">
      <div class="repeat-control">
        <el-input-number v-model="form.generationsPerPrompt" :min="1" :max="100" style="width: 100%" />
        <div class="preset-row">
          <el-button size="small" @click="form.generationsPerPrompt = 3">k = 3</el-button>
          <el-button size="small" @click="form.generationsPerPrompt = 5">k = 5</el-button>
          <el-button size="small" @click="form.generationsPerPrompt = 10">k = 10</el-button>
          <el-button size="small" @click="form.generationsPerPrompt = 25">k = 25</el-button>
        </div>
      </div>
    </el-form-item>
    <el-alert
      title="This controls how many times each prompt is sent to the target LLM. Use k = 3 or 5 for trial runs; k = 25 is closer to Expected Maximum Toxicity experiments."
      type="info"
      show-icon
      :closable="false"
      class="repeat-help"
    />

    <el-alert
      v-if="testResult"
      :type="testResult.success ? 'success' : 'error'"
      :title="testResult.success ? 'Connection successful' : 'Unable to connect to model endpoint.'"
      show-icon
      :closable="false"
      class="test-result"
    />

    <div class="actions">
      <el-button :loading="testing" @click="$emit('test')">Test Connection</el-button>
      <el-button type="primary" :loading="saving" @click="$emit('save', { ...form })">
        Save LLM Configuration
      </el-button>
    </div>
  </el-form>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue'

import { PROVIDER_OPTIONS, type LLMConfig } from '@/types'
import type { TestConnectionResult } from '@/services/llmConfigApi'

const props = defineProps<{
  modelValue: LLMConfig
  saving?: boolean
  testing?: boolean
  testResult?: TestConnectionResult | null
}>()

defineEmits<{
  save: [config: LLMConfig]
  test: []
}>()

const form = reactive({ ...props.modelValue })
watch(
  () => props.modelValue,
  value => {
    Object.assign(form, value)
  },
)
</script>

<style scoped>
.repeat-control {
  width: 100%;
}
.preset-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 8px;
}
.repeat-help {
  margin-bottom: 16px;
}
.test-result {
  margin-bottom: 16px;
}
.actions {
  display: flex;
  gap: 12px;
}
</style>
