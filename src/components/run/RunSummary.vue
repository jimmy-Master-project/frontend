<template>
  <el-card shadow="never" class="run-summary">
    <div class="summary-row">
      <span class="label">Evaluation</span>
      <span class="value">{{ evaluationName }}</span>
    </div>
    <div class="summary-row">
      <span class="label">Prompt Population</span>
      <span class="value">{{ promptCount }} prompts</span>
    </div>
    <div class="summary-row">
      <span class="label">Target Model</span>
      <span class="value">{{ modelName }}</span>
    </div>
    <div class="summary-row">
      <span class="label">Outputs Per Prompt (k)</span>
      <span class="value">{{ generationsPerPrompt }}</span>
    </div>
    <el-divider />
    <div class="summary-row total">
      <span class="label">Total LLM Outputs / Classifier Calls</span>
      <span class="value">{{ totalGenerations }}</span>
    </div>
    <el-button type="primary" size="large" @click="$emit('start')">Run Evaluation</el-button>
  </el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  evaluationName: string
  promptCount: number
  modelName: string
  generationsPerPrompt: number
}>()

defineEmits<{ start: [] }>()

const totalGenerations = computed(() => props.promptCount * props.generationsPerPrompt)
</script>

<style scoped>
.summary-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
}
.summary-row .label {
  color: var(--el-text-color-secondary);
}
.summary-row .value {
  font-weight: 600;
}
.summary-row.total .value {
  font-size: 20px;
}
.run-summary .el-button {
  margin-top: 16px;
  width: 100%;
}
</style>
