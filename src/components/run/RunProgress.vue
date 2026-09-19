<template>
  <el-card shadow="never" class="run-progress">
    <template v-if="status === 'running'">
      <h3>Evaluation Running</h3>
      <p class="status-text">Sending prompts to target LLM...</p>
      <el-progress :percentage="progress" :stroke-width="14" />
      <p class="progress-text">{{ completedGenerations }} / {{ totalGenerations }} generations</p>
      <div class="detail-row"><span>Status</span><span>Running</span></div>
      <div class="detail-row"><span>Prompts</span><span>{{ completedPrompts }} / {{ totalPrompts }}</span></div>
      <div class="detail-row">
        <span>Generations</span><span>{{ completedGenerations }} / {{ totalGenerations }}</span>
      </div>
    </template>

    <template v-else-if="status === 'failed'">
      <h3>Evaluation Failed</h3>
      <el-alert
        type="error"
        show-icon
        :closable="false"
        title="Error"
        :description="error ?? 'Unable to connect to target LLM.'"
      />
       <div class="actions">
         <el-button type="primary" @click="$emit('resume')">Resume from checkpoint</el-button>
         <el-button @click="$emit('retry')">Start new run</el-button>
        <el-button @click="$emit('back-to-llm')">Back to LLM Configuration</el-button>
      </div>
    </template>

    <template v-else-if="status === 'completed'">
      <h3>Evaluation Completed</h3>
      <div class="detail-row"><span>Prompts</span><span>{{ totalPrompts }}</span></div>
      <div class="detail-row"><span>Responses</span><span>{{ completedGenerations }}</span></div>
      <div class="actions">
        <el-button type="primary" @click="$emit('retry')">Start New Run</el-button>
        <el-button :disabled="completedGenerations === 0" @click="$emit('view-responses')">
          View Responses
        </el-button>
      </div>
    </template>
  </el-card>
</template>

<script setup lang="ts">
defineProps<{
  status: 'idle' | 'running' | 'completed' | 'failed'
  totalPrompts: number
  completedPrompts: number
  totalGenerations: number
  completedGenerations: number
  progress: number
  error: string | null
}>()

defineEmits<{
  retry: []
  resume: []
  'back-to-llm': []
  'view-responses': []
}>()
</script>

<style scoped>
h3 {
  margin-top: 0;
}
.status-text {
  color: var(--el-text-color-secondary);
  margin-bottom: 16px;
}
.progress-text {
  margin: 12px 0 20px;
  color: var(--el-text-color-secondary);
}
.detail-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  border-top: 1px solid var(--el-border-color-lighter);
}
.actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}
.run-progress .el-button {
  margin-top: 16px;
}
</style>
