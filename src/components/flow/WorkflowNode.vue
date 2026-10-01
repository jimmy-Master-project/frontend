<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import { computed } from 'vue'

export type FlowNodeKind = 'trigger' | 'evaluation' | 'prompts' | 'llm' | 'run' | 'responses'
export type FlowNodeStatus = 'ready' | 'active' | 'done' | 'error'
export interface FlowNodeData {
  title: string
  subtitle: string
  kind: FlowNodeKind
  status?: FlowNodeStatus
  detail?: string
}

const props = defineProps<{
  id: string
  data: FlowNodeData
  selected?: boolean
}>()
const emit = defineEmits<{ inspect: [port: 'input' | 'output'] }>()

const KIND_COLOR: Record<FlowNodeKind, string> = {
  trigger: '#f0a45d',
  evaluation: '#48b8a5',
  prompts: '#a78bfa',
  llm: '#65a9f3',
  run: '#f0a45d',
  responses: '#e27c92',
}
const KIND_ICON: Record<FlowNodeKind, string> = {
  trigger: '▶',
  evaluation: '◈',
  prompts: '◈',
  llm: '✳',
  run: '↗',
  responses: '▤',
}
const STATUS_ICON: Record<FlowNodeStatus, string> = { ready: '○', active: '◌', done: '●', error: '✕' }

const accent = computed(() => KIND_COLOR[props.data.kind] ?? '#718096')
const icon = computed(() => KIND_ICON[props.data.kind] ?? '◈')
const statusIcon = computed(() => STATUS_ICON[props.data.status ?? 'ready'])
</script>

<template>
  <div class="flow-node" :class="[`kind-${data.kind}`, { selected }]" :style="{ '--node-accent': accent }">
    <Handle type="target" :position="Position.Left" />
    <button class="port-label port-in" type="button" @click.stop="emit('inspect', 'input')">I/O</button>
    <div class="node-topline">
      <span class="node-icon">{{ icon }}</span>
      <span class="node-kind">{{ data.kind }}</span>
      <span class="node-state" :class="data.status" :title="data.status || 'ready'">{{ statusIcon }}</span>
    </div>
    <strong>{{ data.title }}</strong>
    <p>{{ data.subtitle }}</p>
    <small v-if="data.detail">{{ data.detail }}</small>
    <button class="port-label port-out" type="button" @click.stop="emit('inspect', 'output')">I/O</button>
    <Handle type="source" :position="Position.Right" />
  </div>
</template>

<style scoped>
.flow-node { position: relative; width: 224px; padding: 14px 16px 15px; background: #fff; border: 1px solid #d9dee5; border-top: 2px solid var(--node-accent); border-radius: 8px; color: #20252b; box-shadow: 0 3px 10px #17202b12; transition: border-color .15s, box-shadow .15s; }
.flow-node.selected { border-color: var(--node-accent); box-shadow: 0 0 0 1px var(--node-accent), 0 5px 16px #17202b1c; }
.flow-node strong { display: block; margin: 11px 0 5px; font-size: 14px; font-weight: 600; overflow-wrap: anywhere; }
.flow-node p { margin: 0; color: #66717e; font-size: 12px; line-height: 1.45; overflow-wrap: anywhere; }
.flow-node small { display: block; margin-top: 10px; padding-top: 8px; border-top: 1px solid #edf0f3; color: #77818d; font-size: 11px; overflow-wrap: anywhere; }
.node-topline { display: flex; align-items: center; gap: 8px; color: var(--node-accent); }
.node-icon { font-size: 13px; }
.node-kind { font-size: 10px; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; }
.node-state { margin-left: auto; color: #8a949f; }
.node-state.done { color: #24a47b; }
.node-state.active { color: #c78220; }
.node-state.error { color: #be3e4b; }
.port-label { position: absolute; top: 50%; transform: translateY(-50%); z-index: 2; padding: 3px 5px; border: 1px solid #d9dee5; border-radius: 4px; background: #fff; color: #55616d; font-size: 8px; font-weight: 700; letter-spacing: .04em; cursor: pointer; }
.port-label:hover, .port-label:focus-visible { border-color: var(--node-accent); color: #20252b; outline: none; }
.port-in { left: -12px; }
.port-out { right: -12px; }
.vue-flow__handle { width: 8px; height: 8px; background: var(--node-accent); border: 2px solid #fff; }
</style>
