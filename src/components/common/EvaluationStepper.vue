<template>
  <el-steps :active="active" finish-status="success" align-center class="evaluation-stepper">
    <el-step
      v-for="(step, index) in STEPS"
      :key="step.title"
      :title="step.title"
      :class="{ clickable: canGo(index) }"
      @click="go(index)"
    />
  </el-steps>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const props = defineProps<{ active: number }>()

// Every step after Use Case can be opened at any time within an evaluation.
const STEPS = [
  { title: 'Use Case', route: null },
  { title: 'Prompt Population', route: 'prompt-population' },
  { title: 'Target LLM', route: 'target-llm' },
  { title: 'Run', route: 'evaluation-run' },
  { title: 'Results', route: 'evaluation-responses' },
] as const

const route = useRoute()
const router = useRouter()
const evaluationId = computed(() => route.params.evaluationId as string | undefined)

function canGo(index: number) {
  return Boolean(evaluationId.value && STEPS[index].route && index !== props.active)
}

function go(index: number) {
  const name = STEPS[index].route
  if (!canGo(index) || !name) return
  void router.push({ name, params: { evaluationId: evaluationId.value } })
}
</script>

<style scoped>
.evaluation-stepper {
  margin-bottom: 24px;
}
.clickable {
  cursor: pointer;
}
.clickable :deep(.el-step__title:hover) {
  color: var(--el-color-primary);
}
</style>
