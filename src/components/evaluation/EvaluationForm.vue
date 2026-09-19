<template>
  <el-form ref="formRef" :model="form" :rules="rules" label-position="top" @submit.prevent>
    <el-form-item label="Project Name" prop="name">
      <el-input v-model="form.name" placeholder="Resume Screening Evaluation" />
    </el-form-item>
    <el-form-item v-if="!taskFile" label="Use Case Description" prop="useCaseDescription">
      <el-input
        v-model="form.useCaseDescription"
        type="textarea"
        :rows="4"
        placeholder="使用 LLM 分析應徵者履歷，並根據工作需求推薦最適合的候選人。"
      />
    </el-form-item>
    <el-form-item label="Task Objectives File (optional)">
      <el-upload :auto-upload="false" :limit="1" accept=".json,.xlsx" :on-change="handleFileChange" :on-remove="() => (taskFile = undefined)">
        <el-button>Choose JSON / Excel</el-button>
        <template #tip><div class="el-upload__tip">JSON array or XLSX with an objective/task/target column.</div></template>
      </el-upload>
    </el-form-item>
    <el-form-item label="Task Type" prop="taskType">
      <el-select v-model="form.taskType" placeholder="Select task type" style="width: 100%">
        <el-option v-for="opt in TASK_TYPE_OPTIONS" :key="opt.value" :label="opt.label" :value="opt.value" />
      </el-select>
    </el-form-item>
    <el-form-item label="Language" prop="language">
      <el-select v-model="form.language" placeholder="Select language" style="width: 100%">
        <el-option label="English" value="en" />
        <el-option label="Auto detect" value="auto" />
      </el-select>
    </el-form-item>

    <el-form-item v-if="form.taskType === 'classification'" label="Binary Classification Labels" prop="classificationLabels">
      <div class="label-list">
        <el-alert
          type="info"
          show-icon
          :closable="false"
          title="分類任務目前限制為二元分類。請明確設定哪個類別代表負類、哪個代表正類，後續 LangFair FNRP/FPRP 等指標會使用這組定義。"
        />
        <div class="label-row">
          <el-tag type="danger" effect="plain">Negative / 負類</el-tag>
          <el-input-number v-model="form.classificationLabels[0].value" :controls="false" placeholder="Value" class="label-value" />
          <el-input v-model="form.classificationLabels[0].name" placeholder="reject" />
          <el-input v-model="form.classificationLabels[0].description" placeholder="不通過 / negative outcome" />
        </div>
        <div class="label-row">
          <el-tag type="success" effect="plain">Positive / 正類</el-tag>
          <el-input-number v-model="form.classificationLabels[1].value" :controls="false" placeholder="Value" class="label-value" />
          <el-input v-model="form.classificationLabels[1].name" placeholder="approve" />
          <el-input v-model="form.classificationLabels[1].description" placeholder="通過 / positive outcome" />
        </div>
      </div>
    </el-form-item>

    <el-form-item v-if="form.taskType === 'recommendation'" label="Candidate Items (optional)" prop="recommendationItems">
      <div class="item-list">
        <el-alert
          type="info"
          show-icon
          :closable="false"
          title="定義一組固定候選項目後，目標 LLM 只能從這份清單中選擇並排序推薦，讓推薦公平性指標的抽取更可靠。留空則維持自由生成推薦內容（沿用原本規則式抽取）。"
        />
        <div v-for="(item, index) in form.recommendationItems" :key="index" class="item-row">
          <el-input v-model="item.name" placeholder="項目名稱，例如：高蛋白燕麥飲" />
          <el-input v-model="item.description" placeholder="簡短描述（選填）" />
          <el-button text type="danger" @click="removeRecommendationItem(index)">移除</el-button>
        </div>
        <el-button @click="addRecommendationItem">+ 新增候選項目</el-button>
      </div>
    </el-form-item>
    <el-form-item>
      <el-button type="primary" :loading="loading" @click="handleSubmit">
        {{ submitText }}
      </el-button>
    </el-form-item>
  </el-form>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import type { FormInstance, FormRules, UploadFile } from 'element-plus'

import { TASK_TYPE_OPTIONS, type ClassificationLabel, type EvaluationLanguage, type RecommendationItem, type TaskType } from '@/types'

const props = withDefaults(
  defineProps<{
    modelValue?: {
      name: string
      useCaseDescription: string
      taskType: TaskType
      language?: EvaluationLanguage
       classificationLabels?: ClassificationLabel[]
       recommendationItems?: RecommendationItem[]
        taskFile?: File
    }
    loading?: boolean
    submitText?: string
  }>(),
  {
    loading: false,
    submitText: 'Create Evaluation',
  },
)

const emit = defineEmits<{
  submit: [
    payload: {
      name: string
      useCaseDescription: string
      taskType: TaskType
      language: EvaluationLanguage
      classificationLabels?: ClassificationLabel[]
      recommendationItems?: RecommendationItem[]
      taskFile?: File
    },
  ]
}>()

const formRef = ref<FormInstance>()
const taskFile = ref<File>()

function handleFileChange(file: UploadFile) {
  taskFile.value = file.raw
}

const defaultClassificationLabels: ClassificationLabel[] = [
  { value: 0, name: 'reject', description: '不通過' },
  { value: 1, name: 'approve', description: '通過' },
]

const form = reactive({
  name: props.modelValue?.name ?? '',
  useCaseDescription: props.modelValue?.useCaseDescription ?? '',
  taskType: props.modelValue?.taskType ?? ('text_generation' as TaskType),
  language: props.modelValue?.language ?? ((import.meta.env.VITE_LANGFAIR_DEFAULT_LANGUAGE || 'en') as EvaluationLanguage),
  classificationLabels: cloneLabels(props.modelValue?.classificationLabels ?? defaultClassificationLabels),
  recommendationItems: cloneItems(props.modelValue?.recommendationItems ?? []),
})

watch(
  () => props.modelValue,
  value => {
    if (!value) return
    form.name = value.name
    form.useCaseDescription = value.useCaseDescription
    form.taskType = value.taskType
    form.language = value.language ?? ((import.meta.env.VITE_LANGFAIR_DEFAULT_LANGUAGE || 'en') as EvaluationLanguage)
    form.classificationLabels = cloneLabels(value.classificationLabels ?? defaultClassificationLabels)
    form.recommendationItems = cloneItems(value.recommendationItems ?? [])
  },
)

const rules: FormRules = {
  name: [{ required: true, message: 'Project name is required.', trigger: 'blur' }],
  useCaseDescription: [{ validator: validateUseCaseDescription, trigger: 'blur' }],
  taskType: [{ required: true, message: 'Task type is required.', trigger: 'change' }],
  classificationLabels: [{ validator: validateClassificationLabels, trigger: 'change' }],
  recommendationItems: [{ validator: validateRecommendationItems, trigger: 'change' }],
}

function cloneLabels(labels: ClassificationLabel[]) {
  const cloned = labels.slice(0, 2).map(label => ({ ...label }))
  while (cloned.length < 2) cloned.push({ ...defaultClassificationLabels[cloned.length] })
  return cloned
}

function cloneItems(items: RecommendationItem[]) {
  return items.map(item => ({ ...item }))
}

function addRecommendationItem() {
  form.recommendationItems.push({ name: '', description: '' })
}

function removeRecommendationItem(index: number) {
  form.recommendationItems.splice(index, 1)
}

function validateClassificationLabels(_rule: unknown, value: ClassificationLabel[], callback: (error?: Error) => void) {
  if (form.taskType !== 'classification') return callback()
  if (!value || value.length !== 2) return callback(new Error('Classification tasks currently support exactly two labels.'))
  const names = value.map(label => label.name.trim())
  const values = value.map(label => Number(label.value))
  if (names.some(name => !name)) return callback(new Error('Every label needs a name.'))
  if (new Set(names).size !== names.length) return callback(new Error('Label names must be unique.'))
  if (new Set(values).size !== values.length) return callback(new Error('Label values must be unique.'))
  callback()
}

function validateUseCaseDescription(_rule: unknown, value: string, callback: (error?: Error) => void) {
  if (value.trim() || taskFile.value) return callback()
  callback(new Error('Use case description or a task objectives file is required.'))
}

function validateRecommendationItems(_rule: unknown, value: RecommendationItem[], callback: (error?: Error) => void) {
  // Candidate items are opt-in: leaving the list empty is valid and keeps the
  // task unconstrained. Only enforce shape once the user starts defining one.
  if (form.taskType !== 'recommendation' || !value || value.length === 0) return callback()
  if (value.length < 2) return callback(new Error('Define at least two candidate items, or remove all of them to leave recommendations unconstrained.'))
  const names = value.map(item => item.name.trim())
  if (names.some(name => !name)) return callback(new Error('Every candidate item needs a name.'))
  if (new Set(names).size !== names.length) return callback(new Error('Candidate item names must be unique.'))
  callback()
}

async function handleSubmit() {
  if (!formRef.value) return
  await formRef.value.validate(valid => {
    if (valid) {
      emit('submit', {
        name: form.name,
        useCaseDescription: form.useCaseDescription,
        taskType: form.taskType,
        language: form.language,
        classificationLabels: form.taskType === 'classification' ? cloneLabels(form.classificationLabels) : undefined,
        recommendationItems:
          form.taskType === 'recommendation' && form.recommendationItems.length > 0
            ? cloneItems(form.recommendationItems)
            : undefined,
        taskFile: taskFile.value,
      })
    }
  })
}
</script>

<style scoped>
.label-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.label-row {
  display: grid;
  grid-template-columns: 150px 90px 1fr 1fr;
  gap: 8px;
  align-items: center;
}

.label-value {
  width: 90px;
}

.item-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.item-row {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 8px;
  align-items: center;
}
</style>
