<template>
  <el-card shadow="never" class="run-progress">
    <el-alert
      v-if="connectionLost"
      type="warning"
      show-icon
      :closable="false"
      :title="CONNECTION_LOST_MESSAGE"
      class="connection-alert"
    />

    <template v-if="status === 'pending'">
      <h3>Evaluation Queued</h3>
      <p class="status-text">Waiting for the backend worker to start this run...</p>
      <el-progress :percentage="0" :stroke-width="14" :indeterminate="true" />
      <div class="detail-row"><span>Status</span><span>Pending</span></div>
      <div class="detail-row"><span>Prompts</span><span>{{ totalPrompts }}</span></div>
    </template>

    <template v-else-if="status === 'running'">
      <h3>Evaluation Running</h3>
      <p class="status-text">Sending prompts to target LLM...</p>
      <el-progress :percentage="progress" :stroke-width="14" />
      <p class="progress-text">{{ completedGenerations }} / {{ totalGenerations }} generations</p>
      <div class="detail-row"><span>Status</span><span>Running</span></div>
      <div class="detail-row"><span>Prompts</span><span>{{ completedPrompts }} / {{ totalPrompts }}</span></div>
      <div class="detail-row">
        <span>Generations</span><span>{{ completedGenerations }} / {{ totalGenerations }}</span>
      </div>
      <div v-if="failedGenerations" class="detail-row">
        <span>Failed generations</span><span class="failed-count">{{ failedGenerations }}</span>
      </div>
      <div v-if="heartbeatAt" class="detail-row">
        <span>Last heartbeat</span><span>{{ formatTime(heartbeatAt) }}</span>
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
      <div class="detail-row">
        <span>Generations</span><span>{{ completedGenerations }} / {{ totalGenerations }} succeeded</span>
      </div>
      <div v-if="failedGenerations" class="detail-row">
        <span>Failed generations</span>
        <span class="failed-count">
          {{ failedGenerations }} 筆失敗{{ external ? '' : '，可 Resume 重跑' }}
        </span>
      </div>
       <div class="actions">
         <el-button v-if="!external" type="primary" :loading="starting" :disabled="starting" @click="$emit('resume')">
           Resume from checkpoint
         </el-button>
         <el-button :disabled="starting" @click="$emit('retry')">Start new run</el-button>
        <el-button @click="$emit('back-to-llm')">Back to LLM Configuration</el-button>
      </div>
    </template>

    <template v-else-if="status === 'completed'">
      <h3>Evaluation Completed</h3>
      <p class="status-text">Fairness metrics are computed automatically; open Fairness Metrics to see them.</p>
      <div class="detail-row"><span>Prompts</span><span>{{ totalPrompts }}</span></div>
      <div class="detail-row"><span>Responses</span><span>{{ completedGenerations }}</span></div>
      <template v-if="failedGenerations">
        <div class="detail-row">
          <span>Failed generations</span><span class="failed-count">{{ failedGenerations }} 筆失敗</span>
        </div>
        <el-alert
          type="warning"
          show-icon
          :closable="false"
          class="completed-warning"
          :title="`${failedGenerations} 筆 generation 在重試後仍失敗（回應為空）。已完成的 run 無法 Resume；如需補齊請開始新的 run。`"
        />
      </template>
      <div class="actions">
        <el-button type="primary" :disabled="starting" @click="$emit('back-to-llm')">Change Target LLM &amp; run again</el-button>
        <el-button :disabled="starting" @click="$emit('retry')">Start new run</el-button>
        <el-button :disabled="completedGenerations === 0" @click="$emit('view-responses')">
          View Responses
        </el-button>
      </div>
    </template>
  </el-card>
</template>

<script setup lang="ts">
import { CONNECTION_LOST_MESSAGE } from '@/composables/usePolling'
import type { RunState } from '@/types'

defineProps<{
  status: RunState
  totalPrompts: number
  completedPrompts: number
  totalGenerations: number
  completedGenerations: number
  progress: number
  error: string | null
  heartbeatAt?: string | null
  failedGenerations?: number
  external?: boolean
  starting?: boolean
  connectionLost?: boolean
}>()

defineEmits<{
  retry: []
  resume: []
  'back-to-llm': []
  'view-responses': []
}>()

function formatTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString()
}
</script>

<style scoped>
.connection-alert {
  margin-bottom: 16px;
}
.failed-count {
  color: var(--el-color-danger);
  font-weight: 600;
}
.completed-warning {
  margin-top: 12px;
}
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
