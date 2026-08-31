<template>
  <div class="evaluation-create-view">
    <h2>Create Evaluation</h2>
    <el-card shadow="never" class="form-card">
      <EvaluationForm :loading="store.loading" @submit="handleSubmit" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'

import EvaluationForm from '@/components/evaluation/EvaluationForm.vue'
import { evaluationPath } from '@/services/evaluationApi'
import { useEvaluationStore } from '@/stores/evaluation'
import { usePromptPopulationStore } from '@/stores/promptPopulation'
import type { ClassificationLabel, EvaluationLanguage, RecommendationItem, TaskType } from '@/types'

const store = useEvaluationStore()
const promptStore = usePromptPopulationStore()
const router = useRouter()

async function handleSubmit(payload: {
  name: string
  useCaseDescription: string
  taskType: TaskType
  language: EvaluationLanguage
  classificationLabels?: ClassificationLabel[]
  recommendationItems?: RecommendationItem[]
}) {
  try {
    promptStore.reset()
    const evaluation = await store.createEvaluation(payload)
    router.push(evaluationPath(evaluation))
  } catch {
    ElMessage.error('Failed to create evaluation.')
  }
}
</script>

<style scoped>
.form-card {
  max-width: 640px;
}
</style>
