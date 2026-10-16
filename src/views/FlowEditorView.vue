<script setup lang="ts">
/**
 * Visual workflow editor (merged from the standalone frontend-node-v app).
 *
 * Scoped to ONE evaluation (opened from that evaluation's "Flow" button):
 * other evaluations are never listed or loaded here. Models Evaluation →
 * Prompt population → Target LLM / Bot(s) → Run → Responses as draggable Vue
 * Flow nodes, so the same flow can be re-run after swapping the Target LLM
 * node (manually or from a reusable preset). Every node shows the real API
 * requests/responses it produced (see useFlowApiTrace). All data goes through the main app's services and
 * stores; only the canvas layout, the per-bot configs (without API keys) and
 * the bot → run mapping are kept in (namespaced) localStorage.
 *
 * The backend stores exactly ONE Target LLM config per evaluation, so a
 * multi-bot run is executed strictly sequentially: save bot config → start run
 * → wait for completion → next bot. Each bot remembers its run id.
 */
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'

import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import { VueFlow, addEdge, useVueFlow, type Connection, type Edge, type Node } from '@vue-flow/core'
import { ElMessage } from 'element-plus'

import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import ModelNameSelect from '@/components/llm/ModelNameSelect.vue'
import PersonaPicker from '@/components/prompts/PersonaPicker.vue'
import PromptPlanSummary from '@/components/prompts/PromptPlanSummary.vue'
import WorkflowNode, { type FlowNodeData, type FlowNodeKind, type FlowNodeStatus } from '@/components/flow/WorkflowNode.vue'
import { isGenderAttribute, usePersonaCatalog } from '@/composables/usePersonaCatalog'
import { useLlmPresets } from '@/composables/useLlmPresets'
import { NODE_ENDPOINTS, compactForDisplay, useFlowApiTrace, type FlowApiCall } from '@/composables/useFlowApiTrace'
import { CONNECTION_LOST_MESSAGE, useUnmountSignal } from '@/composables/usePolling'
import { formatApiError, isCanceledError, parseApiError } from '@/services/api'
import { evaluationApi, evaluationPath } from '@/services/evaluationApi'
import { llmConfigApi } from '@/services/llmConfigApi'
import { responseApi } from '@/services/responseApi'
import { runApi } from '@/services/runApi'
import { useLlmConfigStore } from '@/stores/llmConfig'
import { usePromptPopulationStore } from '@/stores/promptPopulation'
import { useRunStore } from '@/stores/run'
import {
  PROMPT_AGENT_PROVIDER_OPTIONS,
  PROVIDER_OPTIONS,
  defaultBaseUrl,
  type Evaluation,
  type LLMConfig,
  type PromptGenerationConfig,
  type PromptAgentProvider,
  type Provider,
  type ResponseItem,
  type RunState,
  type RunStatus,
} from '@/types'
import { flowStorageKeys, legacyFlowStorageKeys, readFlowJson, writeFlowJson } from '@/utils/flowStorage'
import { countObjectives, type PickedPersonaInfo, type PromptPlanInput } from '@/utils/promptPlan'

const props = defineProps<{ evaluationId: string }>()

const router = useRouter()
const promptStore = usePromptPopulationStore()
const runStore = useRunStore()
const llmStore = useLlmConfigStore()
const personaCatalog = usePersonaCatalog()
const unmountSignal = useUnmountSignal()

type FlowNode = Node<FlowNodeData> & { data: FlowNodeData }
interface BotRunRecord {
  runId: number
  status: Exclude<RunState, 'idle'>
  modelName: string
  startedAt: string
  errorMessage?: string
}

const NODE_KINDS: FlowNodeKind[] = ['trigger', 'evaluation', 'prompts', 'llm', 'run', 'responses']
const ACTIVE_RUN_STATES: RunState[] = ['pending', 'running']
const EDGE_STYLE = { stroke: '#a6afb9', strokeWidth: 2 }
const RESPONSE_PAGE_SIZE = 20
const TARGET_LLM_NODE_ID = 'target-llm'

function defaultNodes(): FlowNode[] {
  const rows: Array<[string, string, string, number, number, FlowNodeKind]> = [
    ['trigger', 'Manual trigger', 'Start the evaluation flow', 70, 150, 'trigger'],
    ['evaluation', 'Evaluation project', 'Select an existing project', 370, 150, 'evaluation'],
    ['prompts', 'Prompt population', 'Generate test prompts', 670, 150, 'prompts'],
    [TARGET_LLM_NODE_ID, 'Target LLM', 'Model under evaluation (swappable)', 670, 430, 'llm'],
    ['run', 'Run evaluation', 'Execute the selected project', 370, 430, 'run'],
    ['responses', 'Responses', 'Inspect generated outputs', 70, 430, 'responses'],
  ]
  return rows.map(([id, title, subtitle, x, y, kind]) => ({
    id,
    type: 'workflow',
    position: { x, y },
    data: { title, subtitle, kind, status: 'ready' },
  }))
}
function defaultEdges(nodes: FlowNode[]): Edge[] {
  return nodes.slice(0, -1).map((node, i) => ({
    id: `edge-${node.id}`,
    source: node.id,
    target: nodes[i + 1].id,
    style: EDGE_STYLE,
  }))
}
function defaultBotConfig(): LLMConfig {
  return {
    provider: 'openai',
    modelName: '',
    baseUrl: defaultBaseUrl('openai'),
    apiKey: '',
    temperature: 0.7,
    topP: 1,
    maxTokens: 1024,
    generationsPerPrompt: 1,
  }
}

// ---------------------------------------------------------------- canvas state
const nodes = shallowRef<FlowNode[]>(defaultNodes())
const edges = shallowRef<Edge[]>(defaultEdges(nodes.value))
const selectedNodeId = ref('evaluation')
const selectedEdgeId = ref('')
const botConfigs = ref<Record<string, LLMConfig>>({})
const botRuns = ref<Record<string, BotRunRecord>>({})
const { fitView, zoomIn, zoomOut } = useVueFlow()

const selectedNode = computed(() => nodes.value.find(node => node.id === selectedNodeId.value))
const selectedKind = computed<FlowNodeKind | ''>(() => selectedNode.value?.data.kind ?? '')
const botNodes = computed(() => nodes.value.filter(node => node.data.kind === 'llm'))
const selectedBotConfig = computed(() =>
  selectedKind.value === 'llm' ? botConfigs.value[selectedNodeId.value] ?? null : null,
)
const selectedBotRun = computed(() =>
  selectedKind.value === 'llm' ? botRuns.value[selectedNodeId.value] ?? null : null,
)

// ------------------------------------------------------------ evaluation state
// Only the evaluation in the route is ever loaded: the flow is per-task.
const project = ref<Evaluation | null>(null)
const projectLoading = ref(false)
const selectedEvaluation = computed(() =>
  project.value && project.value.id === props.evaluationId ? project.value : null,
)
const listError = ref('')

// Aborted when the evaluation changes or the view unmounts: anything still in
// flight for the previous evaluation (multi-bot sequence, waits) stops.
let evaluationController = new AbortController()
unmountSignal.addEventListener('abort', () => evaluationController.abort(), { once: true })

// ----------------------------------------------------------- prompt node form
const promptCount = ref(100)
const promptProvider = ref<PromptAgentProvider>('openai_compatible')
const promptModel = ref('gpt-4o-mini')
const promptTemperature = ref(0.8)
const personaTargetAttribute = ref('')
const personaSeed = ref(42)
// Personas: picked one by one (default) or sampled at random.
const personaSource = ref<'pick' | 'sample'>('pick')
const pickedPersonaIds = ref<string[]>([])
const pickedPersonaInfo = ref<PickedPersonaInfo[]>([])
const personaDialogOpen = ref(false)
// Start from the people (and label) picked for the latest population, once per population.
let seededFromPopulation: number | null = null
watch(
  () => promptStore.population,
  population => {
    const persona = population?.persona
    if (!population?.populationId || seededFromPopulation === population.populationId) return
    seededFromPopulation = population.populationId
    if (persona?.personaIds?.length) {
      pickedPersonaIds.value = [...persona.personaIds]
      personaSource.value = 'pick'
    }
    const label = persona?.selectedAttributes?.find(key => personaCatalog.protectedFor(key))
    if (label && !personaTargetAttribute.value) personaTargetAttribute.value = label
  },
  { immediate: true },
)
// Estimate of what "Generate prompts" will produce (null = no personas used).
const promptPlanInput = computed<PromptPlanInput | null>(() => {
  const label = personaTargetAttribute.value
  if (!label) return null
  const base = {
    promptCount: promptCount.value,
    objectiveCount: countObjectives(selectedEvaluation.value?.taskObjectives),
    counterfactual: isGenderAttribute(label),
  }
  if (personaSource.value === 'sample') return { ...base, picked: null }
  // The picker reports what it knows; before it is opened, fall back to the
  // attributes recorded on prompts these personas generated earlier.
  const known = new Map(pickedPersonaInfo.value.map(info => [info.id, info]))
  const attributesById = new Map(
    promptStore.prompts.filter(prompt => prompt.personaId).map(prompt => [prompt.personaId!, prompt.personaAttributes ?? {}]),
  )
  return {
    ...base,
    picked: pickedPersonaIds.value.map<PickedPersonaInfo>(id => {
      const info = known.get(id)
      if (info) return info
      const attributes = attributesById.get(id)
      return attributes
        ? { id, name: id, hasDiagnostics: label in attributes, gender: attributes.gender_identity ?? attributes.gender ?? null }
        : { id, name: id, hasDiagnostics: null, gender: null }
    }),
  }
})
// Fairness labels are limited to LangFair's protected attributes (gender, race/ethnicity).
const personaAttributeOptions = computed(() =>
  personaCatalog.protectedAttributes.value.map(attribute => ({
    label: `${attribute.label} (${attribute.counterfactual ? 'counterfactual pairs' : 'group comparison'})`,
    value: attribute.key,
  })),
)

// --------------------------------------------------------------- run / bots
const sequenceRunning = ref(false)
const activeBotId = ref<string | null>(null)
const sequenceStep = ref<{ index: number; total: number } | null>(null)
const testingConnection = ref(false)
const runActive = computed(() => ACTIVE_RUN_STATES.includes(runStore.status))
const busy = computed(() => sequenceRunning.value || runActive.value || promptStore.isGenerating)

// ----------------------------------------------------------------- responses
const responseRows = ref<ResponseItem[]>([])
const responseTotal = ref(0)
const responseRunId = ref<string | number | null>(null)
const responsePage = ref(1)
const responsesLoading = ref(false)
const pendingDelete = ref<{ kind: 'node' } | { kind: 'response'; record: ResponseItem } | null>(null)
const deleting = ref(false)

const connectionLost = computed(() => runStore.connectionLost || promptStore.connectionLost)

// ----------------------------------------------------------------- node I/O
const ioDialog = ref<{ open: boolean; nodeTitle: string; direction: 'input' | 'output'; data: unknown }>({
  open: false,
  nodeTitle: '',
  direction: 'input',
  data: null,
})
const latestRunSnapshot = computed(() =>
  runStore.runId
    ? {
        runId: runStore.runId,
        status: runStore.status,
        progress: runStore.progress,
        completedGenerations: runStore.completedGenerations,
        totalGenerations: runStore.totalGenerations,
        failedGenerations: runStore.failedGenerations,
        error: runStore.error,
      }
    : null,
)
function nodeIo(nodeId: string) {
  const node = nodes.value.find(item => item.id === nodeId)
  const project = selectedEvaluation.value
  const population = promptStore.population
  const promptPreview = promptStore.prompts.slice(0, 3).map(({ id, index, text, category }) => ({ id, index, text, category }))
  const responsePreview = responseRows.value.slice(0, 3).map(
    ({ id, promptIndex, promptText, response, generationIndex, inputTokens, outputTokens, latencyMs }) =>
      ({ id, promptIndex, promptText, response, generationIndex, inputTokens, outputTokens, latencyMs }),
  )
  switch (node?.data.kind) {
    case 'trigger':
      return { input: { trigger: 'manual' }, output: { projectId: props.evaluationId ?? null, projectName: project?.name ?? null } }
    case 'evaluation':
      return {
        input: { selectedProjectId: props.evaluationId ?? null },
        output: project
          ? { name: project.name, taskType: project.taskType, useCaseDescription: project.useCaseDescription, status: project.status, promptCount: project.promptCount }
          : null,
      }
    case 'prompts':
      return {
        input: {
          projectId: props.evaluationId ?? null,
          useCaseDescription: project?.useCaseDescription ?? '',
          provider: population?.provider || promptProvider.value,
          model: population?.generationModel || promptModel.value,
          requestedCount: population?.requested ?? promptCount.value,
          temperature: population?.temperature ?? promptTemperature.value,
          targetAttribute: population?.stratifiedBy || personaTargetAttribute.value || null,
        },
        output: { population, promptCount: promptStore.promptCount, preview: promptPreview },
      }
    case 'llm': {
      const config = botConfigs.value[nodeId]
      return {
        input: { targetBot: config ? { ...config, apiKey: config.apiKey ? '••••' : '' } : null, prompts: promptPreview },
        output: { run: botRuns.value[nodeId] ?? null },
      }
    }
    case 'run':
      return {
        input: {
          projectId: props.evaluationId ?? null,
          promptCount: project?.promptCount ?? 0,
          bots: botNodes.value.map(bot => ({ nodeId: bot.id, modelName: botConfigs.value[bot.id]?.modelName ?? '' })),
        },
        output: { latestRun: latestRunSnapshot.value, botRuns: botRuns.value },
      }
    case 'responses':
      return { input: { runId: responseRunId.value }, output: { total: responseTotal.value, preview: responsePreview } }
    default:
      return { input: {}, output: {} }
  }
}
const selectedNodeIo = computed(() => (selectedNode.value ? nodeIo(selectedNode.value.id) : { input: {}, output: {} }))
const formatData = (value: unknown) => JSON.stringify(value, null, 2) ?? 'No data yet.'

// Real API traffic per node (request params/body → status/response body).
const apiTrace = useFlowApiTrace(() => props.evaluationId)
const selectedNodeCalls = computed<FlowApiCall[]>(() =>
  selectedNode.value ? apiTrace.callsFor(selectedNode.value.id, selectedNode.value.data.kind) : [],
)
const selectedNodeEndpoints = computed(() => (selectedKind.value ? NODE_ENDPOINTS[selectedKind.value] : []))
watch(
  [() => activeBotId.value, selectedNodeId],
  () => apiTrace.setLlmNode(activeBotId.value ?? (selectedKind.value === 'llm' ? selectedNodeId.value : null)),
  { immediate: true },
)
const callTime = (call: FlowApiCall) => new Date(call.startedAt).toLocaleTimeString()
function callRequest(call: FlowApiCall) {
  return { method: call.method, url: call.url, params: call.params, body: call.requestBody }
}
function inspectNodeData(nodeId: string, direction: 'input' | 'output') {
  const node = nodes.value.find(item => item.id === nodeId)
  if (!node) return
  selectedNodeId.value = nodeId
  const calls = apiTrace.callsFor(nodeId, node.data.kind)
  const api = direction === 'input'
    ? calls.map(call => ({ at: call.startedAt, ...callRequest(call) }))
    : calls.map(call => ({ at: call.startedAt, endpoint: call.endpoint, status: call.status, error: call.error, durationMs: call.durationMs, body: compactForDisplay(call.responseBody, 20) }))
  ioDialog.value = {
    open: true,
    nodeTitle: node.data.title,
    direction,
    data: { summary: nodeIo(nodeId)[direction], [direction === 'input' ? 'apiRequests' : 'apiResponses']: api },
  }
}

const runHint = computed(() => {
  if (!props.evaluationId) return 'Open a flow from an evaluation.'
  if (!promptStore.promptCount && !selectedEvaluation.value?.promptCount) return 'Next: generate prompts in Prompt population.'
  if (!botNodes.value.length) return 'Run uses the saved Target LLM. Add a Target LLM node to swap or compare models.'
  if (botNodes.value.length === 1) return 'Swap the Target LLM node (or load a preset) and run again to reuse this flow.'
  return `${botNodes.value.length} Target LLMs will run one after another; each run is recorded on its node.`
})

// ------------------------------------------------------- derived node status
function botStatus(nodeId: string): FlowNodeStatus {
  if (activeBotId.value === nodeId) return 'active'
  const record = botRuns.value[nodeId]
  if (!record) return 'ready'
  if (record.status === 'completed') return 'done'
  if (record.status === 'failed') return 'error'
  return 'active'
}
function nodePatch(node: FlowNode): Partial<FlowNodeData> {
  const project = selectedEvaluation.value
  switch (node.data.kind) {
    case 'trigger':
      return { status: project ? 'done' : 'ready' }
    case 'evaluation':
      return project
        ? {
            title: project.name,
            subtitle: project.useCaseDescription || 'Use case not available',
            detail: `${project.taskType.replace(/_/g, ' ')} · ${project.promptCount} prompts`,
            status: 'done',
          }
        : { title: 'Evaluation project', subtitle: 'Select an existing project', detail: undefined, status: 'ready' }
    case 'prompts': {
      const count = promptStore.promptCount
      if (promptStore.isGenerating) return { status: 'active', detail: 'Generating prompts…' }
      if (promptStore.generationStatus === 'failed') return { status: 'error', detail: promptStore.error || 'Generation failed' }
      return count ? { status: 'done', detail: `${count} prompts available` } : { status: 'ready', detail: undefined }
    }
    case 'llm': {
      const config = botConfigs.value[node.id]
      const record = botRuns.value[node.id]
      const parts = [config?.modelName || 'Not configured']
      if (record) parts.push(`run #${record.runId} ${record.status}`)
      return { status: botStatus(node.id), detail: parts.join(' · ') }
    }
    case 'run': {
      const step = sequenceStep.value ? ` · bot ${sequenceStep.value.index}/${sequenceStep.value.total}` : ''
      if (!runStore.runId) return { status: sequenceRunning.value ? 'active' : 'ready', detail: step ? step.slice(3) : undefined }
      const label = `run #${runStore.runId}`
      if (runActive.value) return { status: 'active', detail: `${label} · ${runStore.progress}%${step}` }
      if (runStore.status === 'failed') return { status: 'error', detail: `${label} failed${step}` }
      if (runStore.status === 'completed') return { status: sequenceRunning.value ? 'active' : 'done', detail: `${label} completed${step}` }
      return { status: 'ready', detail: undefined }
    }
    case 'responses':
      return responseTotal.value
        ? { status: 'done', detail: `${responseTotal.value} responses (run #${responseRunId.value})` }
        : { status: 'ready', detail: undefined }
  }
}
const NODE_DATA_KEYS: Array<keyof FlowNodeData> = ['title', 'subtitle', 'status', 'detail']
function syncNodeData() {
  let changed = false
  const next = nodes.value.map(node => {
    const patch = nodePatch(node)
    const data = { ...node.data, ...patch }
    if (NODE_DATA_KEYS.every(key => data[key] === node.data[key])) return node
    changed = true
    return { ...node, data }
  })
  if (changed) nodes.value = next
}
watch(
  () => [
    selectedEvaluation.value,
    promptStore.promptCount,
    promptStore.generationStatus,
    promptStore.error,
    runStore.runId,
    runStore.status,
    runStore.progress,
    responseTotal.value,
    responseRunId.value,
    activeBotId.value,
    sequenceStep.value,
    sequenceRunning.value,
  ],
  syncNodeData,
)
watch(botConfigs, syncNodeData, { deep: true })
watch(botRuns, syncNodeData, { deep: true })

// Keep a bot's run record in sync while the run store tracks that run.
watch(
  () => [runStore.runId, runStore.status, runStore.error] as const,
  ([runId, status, error]) => {
    if (!runId || status === 'idle') return
    for (const [nodeId, record] of Object.entries(botRuns.value)) {
      if (String(record.runId) === runId && record.status !== status) {
        botRuns.value[nodeId] = { ...record, status, errorMessage: error ?? undefined }
      }
    }
  },
)

// ---------------------------------------------------------------- persistence
function isFlowNode(value: unknown): value is FlowNode {
  if (!value || typeof value !== 'object') return false
  const node = value as Partial<FlowNode>
  return (
    typeof node.id === 'string' &&
    !!node.position &&
    typeof node.position.x === 'number' &&
    typeof node.position.y === 'number' &&
    !!node.data &&
    typeof node.data.title === 'string' &&
    NODE_KINDS.includes(node.data.kind as FlowNodeKind)
  )
}
function restoreLayout(evaluationId: string) {
  const saved = readFlowJson(flowStorageKeys.layout(evaluationId), legacyFlowStorageKeys.layout(evaluationId)) as
    | { nodes?: unknown; edges?: unknown }
    | null
  if (saved && Array.isArray(saved.nodes) && Array.isArray(saved.edges)) {
    const restoredNodes = saved.nodes.filter(isFlowNode).map(node => ({ ...node, type: 'workflow' }))
    if (restoredNodes.length) {
      const ids = new Set(restoredNodes.map(node => node.id))
      nodes.value = restoredNodes
      edges.value = (saved.edges as Edge[]).filter(
        edge => edge && typeof edge.id === 'string' && ids.has(edge.source) && ids.has(edge.target),
      )
      ensureTargetLlmNode()
      return
    }
  }
  nodes.value = defaultNodes()
  edges.value = defaultEdges(nodes.value)
}
/** Layouts saved before the Target LLM node existed get one wired in. */
function ensureTargetLlmNode() {
  if (nodes.value.some(node => node.data.kind === 'llm')) return
  const target = defaultNodes().find(node => node.id === TARGET_LLM_NODE_ID)!
  nodes.value = [...nodes.value, target]
  const ids = new Set(nodes.value.map(node => node.id))
  const rewired = edges.value.filter(edge => !(edge.source === 'prompts' && edge.target === 'run'))
  if (ids.has('prompts')) rewired.push({ id: 'edge-prompts', source: 'prompts', target: TARGET_LLM_NODE_ID, style: EDGE_STYLE })
  if (ids.has('run')) rewired.push({ id: `edge-${TARGET_LLM_NODE_ID}`, source: TARGET_LLM_NODE_ID, target: 'run', style: EDGE_STYLE })
  edges.value = rewired
}
function restoreBots(evaluationId: string) {
  const savedConfigs = readFlowJson(flowStorageKeys.bots(evaluationId), legacyFlowStorageKeys.bots(evaluationId))
  const configs: Record<string, LLMConfig> = {}
  for (const node of nodes.value.filter(item => item.data.kind === 'llm')) {
    const saved = savedConfigs && typeof savedConfigs === 'object'
      ? (savedConfigs as Record<string, Partial<LLMConfig>>)[node.id]
      : undefined
    // API keys are never persisted; they must be re-entered per session.
    const merged = { ...defaultBotConfig(), ...(saved && typeof saved === 'object' ? saved : {}), apiKey: '' }
    // Bots saved before the provider list changed (openai_compatible, custom…).
    configs[node.id] = PROVIDER_OPTIONS.some(option => option.value === merged.provider)
      ? merged
      : { ...merged, provider: 'openai', baseUrl: defaultBaseUrl('openai') }
  }
  botConfigs.value = configs
  const savedRuns = readFlowJson(flowStorageKeys.botRuns(evaluationId))
  botRuns.value = savedRuns && typeof savedRuns === 'object' && !Array.isArray(savedRuns)
    ? (savedRuns as Record<string, BotRunRecord>)
    : {}
}
let persistTimer: ReturnType<typeof setTimeout> | undefined
function persistNow(evaluationId: string | undefined = props.evaluationId) {
  clearTimeout(persistTimer)
  if (!evaluationId) return
  const nodeIds = new Set(nodes.value.map(node => node.id))
  // Only the serializable essentials (Vue Flow adds runtime-only fields).
  writeFlowJson(flowStorageKeys.layout(evaluationId), {
    nodes: nodes.value.map(({ id, position, data }) => ({ id, type: 'workflow', position: { x: position.x, y: position.y }, data })),
    edges: edges.value.map(({ id, source, target, sourceHandle, targetHandle }) => ({ id, source, target, sourceHandle, targetHandle, style: EDGE_STYLE })),
  })
  writeFlowJson(
    flowStorageKeys.bots(evaluationId),
    Object.fromEntries(
      Object.entries(botConfigs.value)
        .filter(([id]) => nodeIds.has(id))
        .map(([id, config]) => [id, { ...config, apiKey: '' }]),
    ),
  )
  writeFlowJson(
    flowStorageKeys.botRuns(evaluationId),
    Object.fromEntries(Object.entries(botRuns.value).filter(([id]) => nodeIds.has(id))),
  )
}
function schedulePersist() {
  clearTimeout(persistTimer)
  persistTimer = setTimeout(() => persistNow(), 200)
}
watch([nodes, edges], schedulePersist, { deep: true })
watch([botConfigs, botRuns], schedulePersist, { deep: true })
onBeforeUnmount(() => persistNow())

// ------------------------------------------------------------------- loading
async function loadEvaluation(evaluationId: string | undefined = props.evaluationId) {
  if (!evaluationId) return
  listError.value = ''
  projectLoading.value = true
  try {
    const evaluation = await evaluationApi.get(evaluationId)
    if (evaluationId === props.evaluationId) project.value = evaluation
  } catch (e) {
    if (evaluationId === props.evaluationId) listError.value = formatApiError(e, 'Unable to load this evaluation.')
  } finally {
    if (evaluationId === props.evaluationId) projectLoading.value = false
  }
}

/**
 * Bot nodes without a model yet start from the evaluation's saved Target LLM
 * config, so the flow reflects what the evaluation currently runs against.
 */
async function seedBotsFromServer(evaluationId: string) {
  const unconfigured = Object.entries(botConfigs.value).filter(([, config]) => !config.modelName.trim())
  if (!unconfigured.length) return
  try {
    const saved = await llmConfigApi.fetchConfig(evaluationId)
    if (evaluationId !== props.evaluationId || !saved?.modelName) return
    for (const [nodeId, config] of unconfigured) {
      if (!config.modelName.trim()) botConfigs.value[nodeId] = { ...defaultBotConfig(), ...saved, apiKey: '' }
    }
  } catch {
    // No Target LLM saved yet: keep the defaults.
  }
}

async function loadResponses(evaluationId: string, page = 1) {
  responsesLoading.value = true
  try {
    const result = await responseApi.fetchResponses(evaluationId, { page, pageSize: RESPONSE_PAGE_SIZE }, evaluationController.signal)
    if (evaluationId !== props.evaluationId) return
    responseRows.value = page === 1 ? result.items : [...responseRows.value, ...result.items]
    responseTotal.value = result.total
    responseRunId.value = result.runId
    responsePage.value = page
  } catch (e) {
    if (!isCanceledError(e) && evaluationId === props.evaluationId) {
      ElMessage.error(formatApiError(e, 'Unable to load response records.'))
    }
  } finally {
    if (evaluationId === props.evaluationId) responsesLoading.value = false
  }
}

/** One-shot refresh of bot runs that were still in progress when last seen. */
async function refreshStaleBotRuns(evaluationId: string, signal: AbortSignal) {
  const stale = Object.entries(botRuns.value).filter(([, record]) => ACTIVE_RUN_STATES.includes(record.status))
  await Promise.all(
    stale.map(async ([nodeId, record]) => {
      try {
        const status = await runApi.fetchRunStatus(String(record.runId), signal)
        if (signal.aborted || evaluationId !== props.evaluationId) return
        const current = botRuns.value[nodeId]
        if (current?.runId === record.runId) {
          botRuns.value[nodeId] = { ...current, status: status.status, errorMessage: status.errorMessage || undefined }
        }
      } catch {
        // Keep the last known status; the run may have been deleted.
      }
    }),
  )
}

async function loadProject(evaluationId: string, signal: AbortSignal) {
  promptStore.ensureEvaluation(evaluationId)
  runStore.ensureEvaluation(evaluationId)
  responseRows.value = []
  responseTotal.value = 0
  responseRunId.value = null
  await Promise.all([
    promptStore.fetchPopulation(evaluationId).catch(() => undefined),
    promptStore.fetchPrompts(evaluationId).catch(() => undefined),
    // Restores the latest run and resumes polling it (stops on unmount).
    runStore.restoreLatestRun(evaluationId, signal),
    loadResponses(evaluationId),
    refreshStaleBotRuns(evaluationId, signal),
    seedBotsFromServer(evaluationId),
  ])
  if (signal.aborted) return
  promptStore.resumeTracking(evaluationId, signal)
  syncNodeData()
}

watch(
  () => props.evaluationId,
  async (evaluationId, previousId) => {
    // Flush the previous evaluation's layout under ITS key before restoring.
    if (previousId) persistNow(previousId)
    evaluationController.abort()
    evaluationController = new AbortController()
    const signal = evaluationController.signal
    sequenceRunning.value = false
    activeBotId.value = null
    sequenceStep.value = null
    apiTrace.clear()
    project.value = null
    if (!evaluationId) {
      nodes.value = defaultNodes()
      edges.value = defaultEdges(nodes.value)
      botConfigs.value = {}
      botRuns.value = {}
      return
    }
    restoreLayout(evaluationId)
    restoreBots(evaluationId)
    syncNodeData()
    await Promise.all([loadEvaluation(evaluationId), loadProject(evaluationId, signal)])
  },
  { immediate: true },
)

onMounted(() => {
  void personaCatalog.load()
  setTimeout(() => fitView({ padding: 0.15 }), 100)
})

// ---------------------------------------------------------------- canvas ops
function isValidConnection(connection: Connection) {
  return connection.source !== connection.target
}

function removeEdge(edgeId: string) {
  edges.value = edges.value.filter(edge => edge.id !== edgeId)
  if (selectedEdgeId.value === edgeId) selectedEdgeId.value = ''
}
function selectEdge(edgeId: string) {
  selectedEdgeId.value = edgeId
  selectedNodeId.value = ''
}
/** Delete/Backspace removes the selected connection only; nodes are deleted from the inspector. */
function onEdgeDeleteKey(event: KeyboardEvent) {
  if (event.key !== 'Delete' && event.key !== 'Backspace') return
  if (!selectedEdgeId.value) return
  const target = event.target as HTMLElement | null
  if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
  event.preventDefault()
  removeEdge(selectedEdgeId.value)
}
onMounted(() => window.addEventListener('keydown', onEdgeDeleteKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onEdgeDeleteKey))

function onConnect(connection: Connection) {
  // addEdge pushes into the array it is given; pass a copy so the shallowRef sees a new array.
  edges.value = addEdge({ ...connection, id: `edge-${crypto.randomUUID()}`, style: EDGE_STYLE }, [...edges.value]) as Edge[]
}
function addNode(kind: 'prompts' | 'llm' | 'run') {
  const labels: Record<typeof kind, [string, string]> = {
    prompts: ['Prompt population', 'Generate test prompts'],
    llm: ['Target LLM', 'Another model to compare'],
    run: ['Run evaluation', 'Execute the evaluation'],
  }
  const [title, subtitle] = labels[kind]
  const id = `${kind}-${crypto.randomUUID().slice(0, 6)}`
  if (kind === 'llm') {
    botConfigs.value[id] = defaultBotConfig()
    if (props.evaluationId) void seedBotsFromServer(props.evaluationId)
  }
  nodes.value = [
    ...nodes.value,
    { id, type: 'workflow', position: { x: 440, y: 430 + Math.random() * 100 }, data: { title, subtitle, kind, status: 'ready' } },
  ]
  selectedNodeId.value = id
  syncNodeData()
}
function resetLayout() {
  nodes.value = defaultNodes()
  edges.value = defaultEdges(nodes.value)
  botConfigs.value = { [TARGET_LLM_NODE_ID]: defaultBotConfig() }
  botRuns.value = {}
  selectedNodeId.value = 'evaluation'
  if (props.evaluationId) void seedBotsFromServer(props.evaluationId)
  syncNodeData()
  setTimeout(() => fitView({ padding: 0.15 }), 50)
}
function removeSelectedNode() {
  const node = selectedNode.value
  if (!node) return
  nodes.value = nodes.value.filter(item => item.id !== node.id)
  edges.value = edges.value.filter(edge => edge.source !== node.id && edge.target !== node.id)
  delete botConfigs.value[node.id]
  delete botRuns.value[node.id]
  selectedNodeId.value = ''
  ElMessage.success('Node removed from canvas. Project data and records are unchanged.')
}

// ---------------------------------------------------------------- prompts
async function generatePrompts() {
  const evaluationId = props.evaluationId
  if (!evaluationId) return
  if (!promptModel.value.trim()) return ElMessage.warning('Enter the prompt generation model.')
  const targetAttribute = personaTargetAttribute.value
  const picking = personaSource.value === 'pick'
  if (picking && !targetAttribute) return ElMessage.warning('Choose a fairness label first.')
  if (picking && !pickedPersonaIds.value.length) return ElMessage.warning('Choose at least one persona.')
  const config: PromptGenerationConfig = {
    provider: promptProvider.value,
    modelName: promptModel.value.trim(),
    promptCount: promptCount.value,
    temperature: promptTemperature.value,
    ...(picking
      ? {
          persona: {
            enabled: true,
            pool: promptStore.population?.persona?.pool || personaCatalog.pool.value || undefined,
            selectedAttributes: [targetAttribute],
            filters: {},
            stratify: null,
            seed: personaSeed.value,
            counterfactualEnabled: isGenderAttribute(targetAttribute),
            personaIds: [...pickedPersonaIds.value],
          },
        }
      : targetAttribute
      ? {
          persona: {
            enabled: true,
            selectedAttributes: [targetAttribute],
            // Only sample values LangFair has a group for (e.g. Man/Woman).
            filters: personaCatalog.supportedValues(targetAttribute).length
              ? { [targetAttribute]: personaCatalog.supportedValues(targetAttribute) }
              : {},
            stratify: targetAttribute,
            seed: personaSeed.value,
            counterfactualEnabled: isGenderAttribute(targetAttribute),
          },
        }
      : {}),
  }
  try {
    // The store polls the population until completed/failed (no artificial
    // cap, exponential backoff on errors, stops when this view unmounts).
    await promptStore.generatePopulation(evaluationId, config, evaluationController.signal)
  } catch (e) {
    if (!isCanceledError(e)) ElMessage.error(formatApiError(e, 'Prompt generation failed.'))
  }
}
watch(
  () => promptStore.generationStatus,
  (status, previous) => {
    const wasGenerating = previous === 'pending' || previous === 'generating'
    if (!wasGenerating) return
    if (status === 'completed') {
      ElMessage.success(`Generated ${promptStore.promptCount} prompts.`)
      void loadEvaluation()
    } else if (status === 'failed') {
      ElMessage.error(promptStore.error || 'Prompt generation failed.')
    }
  },
)

// ------------------------------------------------------------------- bots
function botPayload(config: LLMConfig): LLMConfig {
  // An omitted apiKey tells the backend to keep the stored credential.
  return { ...config, modelName: config.modelName.trim(), apiKey: config.apiKey?.trim() || undefined }
}
function saveBot() {
  const config = selectedBotConfig.value
  if (!config || !config.modelName.trim()) return ElMessage.warning('Enter the bot model name.')
  persistNow()
  ElMessage.success('Bot saved on the canvas. It is applied to the evaluation when the run reaches this bot.')
}
// Reusable Target LLM presets (shared with the step view's Target LLM page).
const llmPresets = useLlmPresets()
const botPresets = llmPresets.presets
const selectedPresetId = ref('')
watch(selectedNodeId, () => (selectedPresetId.value = ''))

function applyPreset(presetId: string) {
  const config = selectedBotConfig.value
  const merged = config && llmPresets.applyTo(presetId, { ...defaultBotConfig(), ...config })
  if (!config || !merged) return
  Object.assign(config, merged)
  ElMessage.success(`Loaded preset "${llmPresets.find(presetId)?.name}". Run the flow again to evaluate this model.`)
}
async function savePreset() {
  const config = selectedBotConfig.value
  if (!config?.modelName.trim()) return ElMessage.warning('Enter the model name before saving a preset.')
  const saved = await llmPresets.promptAndSave(botPayload(config))
  if (!saved) return
  selectedPresetId.value = saved.id
  ElMessage.success(`Preset "${saved.name}" saved. It is available in every evaluation (API key not stored).`)
}
function deletePreset() {
  llmPresets.remove(selectedPresetId.value)
  selectedPresetId.value = ''
}
async function loadServerConfig() {
  const evaluationId = props.evaluationId
  const config = selectedBotConfig.value
  if (!evaluationId || !config) return
  try {
    const saved = await llmConfigApi.fetchConfig(evaluationId)
    Object.assign(config, { ...defaultBotConfig(), ...saved, apiKey: '' })
    ElMessage.success('Loaded the Target LLM currently saved on this evaluation.')
  } catch (e) {
    ElMessage.error(formatApiError(e, 'No Target LLM is saved on this evaluation yet.'))
  }
}

async function ensureNoActiveRun(evaluationId: string, signal: AbortSignal) {
  runStore.ensureEvaluation(evaluationId)
  const latest = await runStore.restoreLatestRun(evaluationId, signal)
  if (latest && ACTIVE_RUN_STATES.includes(latest.status)) {
    ElMessage.warning(`Run #${latest.id} is still in progress. Wait for it to finish first.`)
    return false
  }
  return true
}
async function testConnection() {
  const evaluationId = props.evaluationId
  const config = selectedBotConfig.value
  if (!evaluationId || !config) return
  if (!config.modelName.trim()) return ElMessage.warning('Enter the bot model name.')
  testingConnection.value = true
  try {
    // Testing requires saving: the backend only tests the stored config.
    if (!(await ensureNoActiveRun(evaluationId, evaluationController.signal))) return
    await llmConfigApi.saveConfig(evaluationId, botPayload(config))
    if (llmStore.currentEvaluationId === evaluationId) void llmStore.fetchConfig(evaluationId).catch(() => undefined)
    const result = await llmConfigApi.testConnection(evaluationId)
    if (result.success) ElMessage.success(result.message)
    else ElMessage.error(result.message)
  } catch (e) {
    if (!isCanceledError(e)) ElMessage.error(formatApiError(e, 'Connection test failed.'))
  } finally {
    testingConnection.value = false
  }
}

// -------------------------------------------------------------------- runs
class SequenceAborted extends Error {}

/**
 * Resolves with the run's terminal status once the run store (which polls
 * without an artificial cap and stops on unmount) reports it.
 */
function waitForRun(runId: string, signal: AbortSignal): Promise<Exclude<RunState, 'idle'>> {
  return new Promise((resolve, reject) => {
    let stopWatch: (() => void) | null = null
    const cleanup = () => {
      stopWatch?.()
      signal.removeEventListener('abort', onAbort)
    }
    const onAbort = () => {
      cleanup()
      reject(new SequenceAborted('Run tracking stopped.'))
    }
    const check = () => {
      if (runStore.runId !== runId) {
        cleanup()
        reject(new Error(`Lost track of run #${runId} (another run or evaluation took over).`))
        return true
      }
      if (runStore.status === 'completed' || runStore.status === 'failed') {
        cleanup()
        resolve(runStore.status)
        return true
      }
      return false
    }
    if (signal.aborted) return onAbort()
    signal.addEventListener('abort', onAbort, { once: true })
    if (check()) return
    stopWatch = watch(() => [runStore.runId, runStore.status], check)
  })
}

function recordBotRun(nodeId: string, run: RunStatus, modelName: string) {
  const previous = botRuns.value[nodeId]
  botRuns.value[nodeId] = {
    runId: run.id,
    status: run.status,
    modelName,
    startedAt: previous?.runId === run.id ? previous.startedAt : new Date().toISOString(),
    errorMessage: run.errorMessage || undefined,
  }
}

async function startAndWait(evaluationId: string, signal: AbortSignal, bot?: { id: string; title: string; modelName: string }) {
  // The label names the run in the run history (which node / model ran).
  const label = bot ? `${bot.title} · ${bot.modelName}` : 'Flow run'
  const started = await runStore.startRun(evaluationId, signal, label)
  if (!started) throw new Error('A run start request is already in flight.')
  if (bot) recordBotRun(bot.id, started, bot.modelName)
  const status = await waitForRun(String(started.id), signal)
  if (bot) {
    botRuns.value[bot.id] = {
      ...botRuns.value[bot.id],
      status,
      errorMessage: runStore.error ?? undefined,
    }
  }
  return status
}

async function executeRun() {
  const evaluationId = props.evaluationId
  if (!evaluationId) return ElMessage.warning('Select a project first.')
  if (!promptStore.promptCount && !selectedEvaluation.value?.promptCount) {
    return ElMessage.warning('Generate prompts before running the evaluation.')
  }
  const bots = botNodes.value.map(node => ({ node, config: botConfigs.value[node.id] }))
  const unconfigured = bots.filter(bot => !bot.config?.modelName?.trim())
  if (unconfigured.length) {
    selectedNodeId.value = unconfigured[0].node.id
    return ElMessage.warning('Configure a model name on every bot node (or remove it) before running.')
  }
  if (sequenceRunning.value) return
  const signal = evaluationController.signal
  sequenceRunning.value = true
  let completed = 0
  try {
    // Saving a config while a run is active would change the target of that
    // run (one llm-config per evaluation), so refuse up front.
    if (!(await ensureNoActiveRun(evaluationId, signal))) return
    if (!bots.length) {
      const status = await startAndWait(evaluationId, signal)
      if (status === 'failed') throw new Error(runStore.error || 'Run failed.')
      ElMessage.success('Evaluation run completed.')
      return
    }
    for (const [index, { node, config }] of bots.entries()) {
      if (signal.aborted) throw new SequenceAborted()
      activeBotId.value = node.id
      sequenceStep.value = { index: index + 1, total: bots.length }
      await llmConfigApi.saveConfig(evaluationId, botPayload(config))
      const status = await startAndWait(evaluationId, signal, { id: node.id, title: node.data.title, modelName: config.modelName.trim() })
      if (status === 'failed') {
        throw new Error(`${node.data.title} (${config.modelName}): ${runStore.error || 'run failed'}. Remaining bots were not run.`)
      }
      completed += 1
    }
    ElMessage.success(`Ran ${completed} bot(s) sequentially. The responses view shows the last run.`)
  } catch (e) {
    if (e instanceof SequenceAborted || signal.aborted || isCanceledError(e)) return
    const apiError = parseApiError(e)
    if (apiError.status === 409) {
      // The run store attached to the run that is already in progress.
      ElMessage.error(`Another run is already in progress for this evaluation: ${apiError.message}`)
    } else {
      ElMessage.error(formatApiError(e, 'Run failed.'))
    }
  } finally {
    if (!signal.aborted) {
      sequenceRunning.value = false
      activeBotId.value = null
      sequenceStep.value = null
      void loadEvaluation(evaluationId)
      void loadResponses(evaluationId)
      // The evaluation's Target LLM now holds the last bot's config.
      if (bots.length && llmStore.currentEvaluationId === evaluationId) {
        void llmStore.fetchConfig(evaluationId).catch(() => undefined)
      }
    }
  }
}

// ---------------------------------------------------------------- deletion
function askDeleteNode() {
  if (selectedNode.value) pendingDelete.value = { kind: 'node' }
}
function askDeleteResponse(record: ResponseItem) {
  pendingDelete.value = { kind: 'response', record }
}
const deleteDialogOpen = computed({
  get: () => pendingDelete.value !== null,
  set: open => {
    if (!open) pendingDelete.value = null
  },
})
const deleteDialogText = computed(() =>
  pendingDelete.value?.kind === 'response'
    ? {
        title: 'Delete response record',
        message: 'Delete this output record? The project and run history will be kept.',
        confirm: 'Delete record',
      }
    : {
        title: 'Delete node',
        message: 'Remove this node and its canvas connections? The project and saved records will remain.',
        confirm: 'Delete node',
      },
)
async function confirmDelete() {
  const pending = pendingDelete.value
  const evaluationId = props.evaluationId
  if (!pending) return
  if (pending.kind === 'node') {
    removeSelectedNode()
    pendingDelete.value = null
    return
  }
  if (!evaluationId || responseRunId.value === null) return
  deleting.value = true
  try {
    await responseApi.deleteResponse(responseRunId.value, pending.record.id)
    ElMessage.success('Response record deleted.')
    pendingDelete.value = null
    await loadResponses(evaluationId)
  } catch (e) {
    const apiError = parseApiError(e)
    ElMessage.error(
      apiError.status === 409
        ? 'Responses cannot be deleted while the run is active.'
        : formatApiError(e, 'Unable to delete response record.'),
    )
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="flow-shell">
    <header class="toolbar">
      <div class="crumb">
        <router-link to="/">Projects</router-link>
        <span>/</span>
        <span class="crumb-project">{{ selectedEvaluation?.name || `Evaluation #${evaluationId}` }}</span>
        <span>/</span>
        <strong>Flow</strong>
        <i class="saved-dot" />
        <small>Layout saved locally</small>
      </div>
      <div class="top-actions">
        <el-button v-if="selectedEvaluation" @click="router.push(evaluationPath(selectedEvaluation))">Step view</el-button>
        <el-button @click="router.push({ name: 'run-history', params: { evaluationId } })">Run history</el-button>
        <el-button type="primary" :loading="sequenceRunning" :disabled="!evaluationId || busy" @click="executeRun">
          ▶ Run evaluation
        </el-button>
      </div>
    </header>

    <div class="workspace">
      <main class="canvas-wrap">
        <div class="canvas-head">
          <div>
            <div class="eyebrow">CANVAS · {{ nodes.length }} NODES</div>
            <h1>{{ selectedEvaluation?.name || 'Evaluation pipeline' }}</h1>
            <p>{{ runHint }}</p>
          </div>
          <div class="canvas-tools">
            <el-dropdown trigger="click" @command="addNode">
              <el-button text>＋ Add step</el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="prompts">Prompt population</el-dropdown-item>
                  <el-dropdown-item command="llm">Target LLM</el-dropdown-item>
                  <el-dropdown-item command="run">Run evaluation</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            <el-button text :disabled="sequenceRunning" @click="resetLayout">Reset layout</el-button>
            <el-button text aria-label="Zoom out" @click="zoomOut()">−</el-button>
            <el-button text aria-label="Zoom in" @click="zoomIn()">＋</el-button>
            <el-button text aria-label="Fit workflow" @click="fitView({ padding: 0.15 })">Fit</el-button>
          </div>
        </div>
        <div class="canvas">
          <VueFlow
            v-model:nodes="nodes"
            v-model:edges="edges"
            :default-viewport="{ x: 0, y: 0, zoom: 0.78 }"
            :min-zoom="0.25"
            :max-zoom="1.5"
            :delete-key-code="null"
            :connection-radius="40"
            :is-valid-connection="isValidConnection"
            @connect="onConnect"
            @node-click="({ node }) => ((selectedNodeId = node.id), (selectedEdgeId = ''))"
            @edge-click="({ edge }) => selectEdge(edge.id)"
            @edge-double-click="({ edge }) => removeEdge(edge.id)"
            @pane-click="(selectedNodeId = ''), (selectedEdgeId = '')"
          >
            <template #node-workflow="{ id, data, selected }">
              <WorkflowNode :id="id" :data="data" :selected="selected" @inspect="direction => inspectNodeData(id, direction)" />
            </template>
          </VueFlow>
          <div v-if="selectedEdgeId" class="edge-hint">
            <span>Connection selected · press Delete or double-click a line to remove it</span>
            <el-button size="small" type="danger" plain @click="removeEdge(selectedEdgeId)">Delete connection</el-button>
          </div>
          <div v-if="listError" class="canvas-alert">
            <b>API connection issue</b><span>{{ listError }}</span>
            <el-button text @click="loadEvaluation()">Retry</el-button>
          </div>
          <div class="canvas-status" :class="{ warn: connectionLost }">
            <span class="online-dot" />
            {{
              connectionLost
                ? CONNECTION_LOST_MESSAGE
                : projectLoading
                  ? 'Connecting to API…'
                  : evaluationId
                    ? 'Connected to evaluation API'
                    : 'Waiting for a project'
            }}
          </div>
        </div>
      </main>

      <aside class="inspector">
        <div class="inspector-head">
          <div>
            <div class="eyebrow">NODE CONFIGURATION</div>
            <h2>{{ selectedNode?.data.title || 'Select a node' }}</h2>
          </div>
          <button class="close-inspector" aria-label="Deselect node" @click="selectedNodeId = ''">×</button>
        </div>

        <template v-if="selectedNode">
          <div class="node-summary">
            <span class="inspector-badge" :class="selectedKind">{{ selectedKind }}</span>
            <span class="state-label" :class="selectedNode.data.status">{{ selectedNode.data.status || 'ready' }}</span>
            <el-button text type="danger" size="small" :disabled="sequenceRunning" @click="askDeleteNode">Delete node</el-button>
          </div>

          <section v-if="selectedKind === 'evaluation' || selectedKind === 'trigger'" class="config-section">
            <label>PROJECT</label>
            <template v-if="selectedEvaluation">
              <div class="readout"><span>Name</span><b>{{ selectedEvaluation.name }}</b></div>
              <div class="readout"><span>Task type</span><b>{{ selectedEvaluation.taskType.replace(/_/g, ' ') }}</b></div>
              <div class="readout"><span>Prompt count</span><b>{{ selectedEvaluation.promptCount }}</b></div>
              <div class="readout description"><span>Use case</span><p>{{ selectedEvaluation.useCaseDescription }}</p></div>
            </template>
            <p class="help-text">This flow belongs to this evaluation only. Open another evaluation's flow from the project list.</p>
          </section>

          <section v-else-if="selectedKind === 'prompts'" class="config-section">
            <label>GENERATION PROVIDER</label>
            <el-select v-model="promptProvider" class="full-width">
              <el-option v-for="option in PROMPT_AGENT_PROVIDER_OPTIONS" :key="option.value" :label="option.label" :value="option.value" />
            </el-select>
            <label>MODEL</label>
            <el-input v-model="promptModel" placeholder="gpt-4o-mini" />
            <label>NUMBER OF PROMPTS</label>
            <el-input-number v-model="promptCount" :min="1" :max="1000" class="full-width" />
            <label>TEMPERATURE <span class="label-value">{{ promptTemperature.toFixed(1) }}</span></label>
            <el-slider v-model="promptTemperature" :min="0" :max="2" :step="0.1" />
            <label>FAIRNESS LABEL (LANGFAIR)</label>
            <el-select
              v-model="personaTargetAttribute"
              clearable
              filterable
              :loading="personaCatalog.loading.value"
              placeholder="Gender or race/ethnicity"
              class="full-width"
            >
              <el-option v-for="attribute in personaAttributeOptions" :key="attribute.value" :label="attribute.label" :value="attribute.value" />
            </el-select>
            <label>PERSONAS</label>
            <el-radio-group v-model="personaSource" size="small">
              <el-radio-button value="pick">Pick personas</el-radio-button>
              <el-radio-button value="sample">Random sampling</el-radio-button>
            </el-radio-group>
            <template v-if="personaSource === 'pick'">
              <div class="readout"><span>Selected personas</span><b>{{ pickedPersonaIds.length }}</b></div>
              <el-button class="full-width" @click="personaDialogOpen = true">Choose personas…</el-button>
            </template>
            <template v-else-if="personaTargetAttribute">
              <label>PERSONA SEED</label>
              <el-input-number v-model="personaSeed" :min="0" class="full-width" />
            </template>
            <p v-if="personaCatalog.error.value" class="help-text error-text">{{ personaCatalog.error.value }}</p>
            <p class="help-text">
              LangFair supports gender (counterfactual pairs) and race/ethnicity (group comparison).
              {{ personaSource === 'pick' ? 'Only the personas you choose are used, in turn.' : 'Sampling is limited to values that map onto a LangFair group and stratified across them.' }}
            </p>
            <PromptPlanSummary v-if="promptPlanInput" :input="promptPlanInput" />
            <el-alert v-if="promptStore.generationStatus === 'failed' && promptStore.error" type="error" :closable="false" :title="promptStore.error" />
            <el-button
              type="primary"
              :loading="promptStore.isGenerating"
              :disabled="!evaluationId || busy"
              class="full-width action-button"
              @click="generatePrompts"
            >
              Generate prompts
            </el-button>
          </section>

          <section v-else-if="selectedKind === 'llm' && selectedBotConfig" class="config-section">
            <label>PRESET</label>
            <div class="preset-row">
              <el-select
                v-model="selectedPresetId"
                placeholder="Load a saved Target LLM"
                filterable
                clearable
                :disabled="sequenceRunning"
                @change="(id: string) => id && applyPreset(id)"
              >
                <el-option v-for="preset in botPresets" :key="preset.id" :label="preset.name" :value="preset.id" />
              </el-select>
              <el-button text type="danger" :disabled="!selectedPresetId" @click="deletePreset">Delete</el-button>
            </div>
            <div class="button-row tight">
              <el-button size="small" :disabled="sequenceRunning" @click="savePreset">Save as preset</el-button>
              <el-button size="small" :disabled="sequenceRunning || !evaluationId" @click="loadServerConfig">Load saved config</el-button>
            </div>
            <label>PROVIDER</label>
            <el-select
              v-model="selectedBotConfig.provider"
              class="full-width"
              @change="(provider: Provider) => selectedBotConfig && Object.assign(selectedBotConfig, { baseUrl: defaultBaseUrl(provider), modelName: '' })"
            >
              <el-option v-for="option in PROVIDER_OPTIONS" :key="option.value" :label="option.label" :value="option.value" />
            </el-select>
            <label>MODEL NAME</label>
            <ModelNameSelect
              v-model="selectedBotConfig.modelName"
              :provider="selectedBotConfig.provider"
              :base-url="selectedBotConfig.baseUrl"
              :api-key="selectedBotConfig.apiKey"
              :evaluation-id="evaluationId"
              placeholder="gpt-4o-mini"
            />
            <label>BASE URL</label>
            <el-input
              v-model="selectedBotConfig.baseUrl"
              :placeholder="defaultBaseUrl(selectedBotConfig.provider)"
            />
            <label>API KEY</label>
            <el-input
              v-model="selectedBotConfig.apiKey"
              type="password"
              show-password
              autocomplete="new-password"
              placeholder="Blank keeps the key stored on the server"
            />
            <label>MAX TOKENS</label>
            <el-input-number v-model="selectedBotConfig.maxTokens" :min="1" :max="128000" class="full-width" />
            <label>TEMPERATURE <span class="label-value">{{ selectedBotConfig.temperature.toFixed(1) }}</span></label>
            <el-slider v-model="selectedBotConfig.temperature" :min="0" :max="2" :step="0.1" />
            <label>TOP P</label>
            <el-input-number v-model="selectedBotConfig.topP" :min="0" :max="1" :step="0.05" :precision="2" class="full-width" />
            <label>GENERATIONS PER PROMPT</label>
            <el-input-number v-model="selectedBotConfig.generationsPerPrompt" :min="1" :max="100" class="full-width" />
            <p class="help-text">
              The evaluation has a single Target LLM config: this node is written to it right before its run (and by
              "Test connection"). Swap the model here or load a preset, then run the flow again to reuse it. API keys
              are kept in memory only and are not saved in the browser; a blank key keeps whatever key the server
              already stores.
            </p>
            <div v-if="selectedBotRun" class="readout">
              <span>Last run</span>
              <b>#{{ selectedBotRun.runId }} · {{ selectedBotRun.status }}</b>
            </div>
            <p v-if="selectedBotRun?.errorMessage" class="help-text error-text">{{ selectedBotRun.errorMessage }}</p>
            <div class="button-row">
              <el-button :loading="testingConnection" :disabled="busy" @click="testConnection">Test connection</el-button>
              <el-button type="primary" @click="saveBot">Save node</el-button>
            </div>
          </section>

          <section v-else-if="selectedKind === 'run'" class="config-section">
            <div class="run-card">
              <span>↗</span>
              <b>Execute this evaluation</b>
              <p v-if="botNodes.length">
                {{ botNodes.length }} Target LLM node(s) run sequentially: save config → start run → wait for completion →
                next node. A failed run stops the sequence.
              </p>
              <p v-else>Uses the evaluation's saved Target LLM and the current prompt population.</p>
            </div>
            <template v-if="runStore.runId">
              <div class="readout"><span>Latest run</span><b>#{{ runStore.runId }} · {{ runStore.status }}</b></div>
              <el-progress :percentage="runStore.progress" :status="runStore.status === 'failed' ? 'exception' : runStore.status === 'completed' ? 'success' : undefined" />
              <p v-if="runStore.error" class="help-text error-text">{{ runStore.error }}</p>
            </template>
            <el-alert v-if="runStore.startError" type="error" :title="runStore.startError" @close="runStore.startError = null" />
            <div v-if="botNodes.length" class="bot-run-list">
              <label>TARGET LLM → RUN</label>
              <div v-for="bot in botNodes" :key="bot.id" class="readout">
                <span>{{ botConfigs[bot.id]?.modelName || bot.data.title }}</span>
                <b>{{ botRuns[bot.id] ? `#${botRuns[bot.id].runId} · ${botRuns[bot.id].status}` : '—' }}</b>
              </div>
            </div>
            <el-button
              type="primary"
              :loading="sequenceRunning"
              :disabled="!evaluationId || busy"
              class="full-width action-button"
              @click="executeRun"
            >
              ▶ Run evaluation
            </el-button>
            <el-button v-if="evaluationId" class="full-width" @click="router.push({ name: 'run-history', params: { evaluationId } })">
              Compare past runs
            </el-button>
            <el-button v-if="evaluationId" class="full-width" @click="router.push(`/evaluations/${evaluationId}/run`)">Open run page</el-button>
          </section>

          <section v-else-if="selectedKind === 'responses'" class="config-section">
            <label>LATEST RUN RECORDS{{ responseRunId !== null ? ` · RUN #${responseRunId}` : '' }}</label>
            <div class="response-count">{{ responseTotal }} <small>responses</small></div>
            <div v-if="responseRows.length" class="record-list">
              <article v-for="record in responseRows" :key="record.id" class="record-item">
                <div class="record-head">
                  <b>Prompt {{ record.promptIndex }} · Generation {{ record.generationIndex }}</b>
                  <el-button text type="danger" size="small" :disabled="runActive || sequenceRunning" @click="askDeleteResponse(record)">Delete</el-button>
                </div>
                <label>INPUT</label>
                <p>{{ record.promptText }}</p>
                <label>OUTPUT</label>
                <p v-if="record.error" class="error-text">{{ record.error }}</p>
                <p v-else>{{ record.response }}</p>
                <small>{{ record.inputTokens }} in · {{ record.outputTokens }} out · {{ record.latencyMs }} ms</small>
              </article>
            </div>
            <div v-else class="empty-records">No output records for the latest run.</div>
            <el-button class="full-width action-button" :loading="responsesLoading" :disabled="!evaluationId" @click="evaluationId && loadResponses(evaluationId)">
              Refresh records
            </el-button>
            <el-button
              v-if="responseRows.length < responseTotal && evaluationId"
              class="full-width"
              :loading="responsesLoading"
              @click="loadResponses(evaluationId, responsePage + 1)"
            >
              Load more ({{ responseRows.length }} / {{ responseTotal }})
            </el-button>
            <el-button v-if="evaluationId" class="full-width" @click="router.push(`/evaluations/${evaluationId}/responses`)">Open responses page</el-button>
          </section>

          <section class="io-panel">
            <h3>API calls <small>{{ selectedNodeCalls.length }} endpoint(s) this session</small></h3>
            <div v-if="selectedNodeEndpoints.length" class="endpoint-list">
              <code v-for="endpoint in selectedNodeEndpoints" :key="endpoint">{{ endpoint }}</code>
            </div>
            <p v-else class="help-text">This node does not call the API.</p>
            <details v-for="call in selectedNodeCalls" :key="call.endpoint" class="api-call">
              <summary>
                <span class="method" :class="call.method.toLowerCase()">{{ call.method }}</span>
                <span class="call-url">{{ call.url }}</span>
                <span class="call-status" :class="{ failed: call.error }">{{ call.status ?? 'ERR' }}</span>
              </summary>
              <div class="call-meta">{{ callTime(call) }} · {{ call.durationMs }} ms · called {{ call.count }}×</div>
              <label>REQUEST</label>
              <pre>{{ formatData(compactForDisplay(callRequest(call))) }}</pre>
              <label>RESPONSE</label>
              <p v-if="call.error" class="help-text error-text">{{ call.error }}</p>
              <pre>{{ formatData(compactForDisplay(call.responseBody)) }}</pre>
            </details>
            <p v-if="selectedNodeEndpoints.length && !selectedNodeCalls.length" class="help-text">
              No calls recorded yet. Use this node (generate, test connection, run…) to capture its requests and responses.
            </p>
            <h3>Data summary</h3>
            <details open><summary>Input</summary><pre>{{ formatData(selectedNodeIo.input) }}</pre></details>
            <details open><summary>Output</summary><pre>{{ formatData(selectedNodeIo.output) }}</pre></details>
          </section>
        </template>
        <div v-else class="inspector-empty">
          <span>⌖</span>
          <b>Nothing selected</b>
          <p>Choose a canvas node to edit its settings.</p>
        </div>
        <footer class="inspector-foot"><span>Node ID</span><code>{{ selectedNode?.id || '—' }}</code></footer>
      </aside>
    </div>

    <el-dialog v-model="personaDialogOpen" title="Choose personas" width="min(1100px, 94vw)">
      <PersonaPicker
        v-model:selected="pickedPersonaIds"
        :pool="promptStore.population?.persona?.pool || personaCatalog.pool.value"
        :diagnostic-attributes="personaTargetAttribute ? [personaTargetAttribute] : []"
        @selection-info="info => (pickedPersonaInfo = info)"
      />
      <template #footer>
        <el-button type="primary" @click="personaDialogOpen = false">Done ({{ pickedPersonaIds.length }} selected)</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="ioDialog.open" :title="`${ioDialog.nodeTitle} · ${ioDialog.direction.toUpperCase()}`" width="min(760px, 88vw)">
      <pre class="io-dialog-data">{{ formatData(ioDialog.data) }}</pre>
    </el-dialog>

    <ConfirmDialog
      v-model="deleteDialogOpen"
      :title="deleteDialogText.title"
      :message="deleteDialogText.message"
      :confirm-text="deleteDialogText.confirm"
      :loading="deleting"
      danger
      @confirm="confirmDelete"
    />
  </div>
</template>

<style scoped>
.flow-shell { height: calc(100vh - 58px); min-height: 560px; display: flex; flex-direction: column; overflow: hidden; background: #fff; color: #252a31; }
.toolbar { flex: none; display: flex; align-items: center; gap: 16px; padding: 10px 20px; border-bottom: 1px solid #e3e7ec; }
.crumb { flex: 1; display: flex; align-items: center; gap: 9px; color: #7b8490; font-size: 12px; }
.crumb a { color: var(--el-color-primary); text-decoration: none; }
.crumb strong { font-weight: 500; color: #343b44; }
.crumb small { font-size: 10px; }
.saved-dot, .online-dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; background: #20a879; }
.top-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.top-actions .el-button + .el-button { margin-left: 0; }
.workspace { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) 320px; }
.canvas-wrap { min-width: 0; display: flex; flex-direction: column; background: #fff; }
.canvas-head { flex: none; padding: 16px 24px 12px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.eyebrow { font-size: 9px; color: #778391; font-weight: 700; letter-spacing: .13em; }
.canvas-head h1 { font-size: 18px; margin: 8px 0 4px; font-weight: 600; }
.canvas-head p { font-size: 11px; color: #75808d; margin: 0; }
.canvas-tools { display: flex; align-items: center; gap: 4px; }
.canvas { position: relative; flex: 1; min-height: 0; border-top: 1px solid #e8ecf0; background-color: #fff; background-image: radial-gradient(#cfd5dc 1px, transparent 1px); background-size: 22px 22px; }
.canvas :deep(.vue-flow) { background-color: transparent; }
.canvas :deep(.vue-flow__edge-path) { stroke: #a6afb9; stroke-width: 2; }
.canvas-status { position: absolute; bottom: 12px; left: 16px; padding: 7px 10px; border-radius: 5px; background: #fff; border: 1px solid #e5e9ed; color: #67727f; font-size: 10px; display: flex; align-items: center; gap: 7px; }
.canvas-status.warn { color: #a56912; border-color: #f3d9a8; }
.canvas-status.warn .online-dot { background: #e6a23c; }
.edge-hint { position: absolute; z-index: 5; bottom: 12px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 10px; padding: 6px 8px 6px 12px; border: 1px solid #e5e9ed; border-radius: 6px; background: #fff; box-shadow: 0 3px 10px #17202b12; color: #55616d; font-size: 11px; white-space: nowrap; }
.canvas :deep(.vue-flow__edge.selected .vue-flow__edge-path), .canvas :deep(.vue-flow__edge:hover .vue-flow__edge-path) { stroke: #e05a6a !important; }
.canvas :deep(.vue-flow__edge) { cursor: pointer; }
.canvas-alert { position: absolute; z-index: 5; top: 12px; right: 14px; max-width: min(420px, 90%); background: #fdecef; border: 1px solid #f1b9c1; border-radius: 6px; padding: 9px 12px; display: flex; align-items: center; gap: 10px; color: #a3313e; font-size: 11px; }
.inspector { background: #fff; border-left: 1px solid #e3e7ec; display: flex; flex-direction: column; min-width: 0; overflow-y: auto; }
.inspector-head { padding: 18px 18px 14px; border-bottom: 1px solid #e5e9ed; display: flex; justify-content: space-between; align-items: flex-start; }
.inspector-head h2 { margin: 7px 0 0; font-size: 14px; font-weight: 600; color: #303740; overflow-wrap: anywhere; }
.close-inspector { background: none; border: 0; color: #88939f; font-size: 20px; cursor: pointer; }
.node-summary { display: flex; align-items: center; justify-content: space-between; padding: 12px 18px; border-bottom: 1px solid #e5e9ed; }
.inspector-badge { font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: #697582; }
.inspector-badge.prompts { color: #7c5ce0; }
.inspector-badge.llm { color: #2f7fd1; }
.inspector-badge.run { color: #c17a1c; }
.inspector-badge.responses { color: #c8506a; }
.state-label { font-size: 9px; padding: 4px 6px; border-radius: 4px; background: #f1f3f5; color: #697582; }
.state-label.done { color: #14805f; background: #e7f5ef; }
.state-label.active { color: #a56912; background: #fff4dc; }
.state-label.error { color: #be3e4b; background: #fdecef; }
.config-section { padding: 18px; display: flex; flex-direction: column; gap: 9px; }
.config-section > label, .bot-run-list > label { margin-top: 8px; color: #687481; font-size: 9px; font-weight: 700; letter-spacing: .1em; }
.config-section > label:first-child { margin-top: 0; }
.config-section .el-button + .el-button { margin-left: 0; }
.label-value { float: right; color: #39424d; font-size: 10px; }
.full-width { width: 100%; }
.readout { display: flex; justify-content: space-between; gap: 14px; padding: 9px 0; border-bottom: 1px solid #e3e7ec; color: #697582; font-size: 11px; }
.readout b { font-weight: 500; color: #303740; text-transform: capitalize; text-align: right; }
.readout.description { display: block; border: 0; }
.readout.description p { color: #4d5864; font-size: 11px; line-height: 1.5; margin: 7px 0; }
.action-button { margin-top: 10px; }
.help-text { font-size: 10px; color: #697582; line-height: 1.55; margin: 0; }
.error-text { color: #be3e4b; }
.button-row { display: flex; gap: 8px; margin-top: 8px; }
.button-row > * { flex: 1; }
.run-card { padding: 15px; border: 1px solid #e3e7ec; border-radius: 7px; }
.run-card span { display: block; color: #c17a1c; font-size: 20px; margin-bottom: 10px; }
.run-card b { font-size: 12px; }
.run-card p { font-size: 10px; line-height: 1.5; color: #697582; }
.bot-run-list { display: flex; flex-direction: column; }
.response-count { font-size: 24px; color: #252a31; }
.response-count small { font-size: 11px; color: #697582; }
.record-list { display: flex; flex-direction: column; gap: 8px; }
.record-item { padding: 10px; border: 1px solid #e3e7ec; border-radius: 6px; }
.record-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.record-head b { color: #303740; font-size: 10px; }
.record-item label { display: block; margin-top: 10px; color: #687481; font-size: 8px; font-weight: 700; letter-spacing: .1em; }
.record-item p { max-height: 90px; overflow: auto; margin: 4px 0; color: #303740; font-size: 10px; line-height: 1.45; white-space: pre-wrap; overflow-wrap: anywhere; }
.record-item > small, .empty-records { color: #687481; font-size: 9px; }
.empty-records { padding: 8px 0; }
.io-panel { padding: 0 18px 18px; display: flex; flex-direction: column; gap: 8px; }
.io-panel h3 { margin: 4px 0; color: #414a54; font-size: 11px; }
.io-panel h3 small { margin-left: 6px; color: #8a949f; font-weight: 400; }
.endpoint-list { display: flex; flex-direction: column; gap: 3px; }
.endpoint-list code { font: 9px/1.5 ui-monospace, monospace; color: #55616d; overflow-wrap: anywhere; }
.api-call summary { display: flex; align-items: center; gap: 6px; text-transform: none; font-weight: 500; }
.api-call .method { flex: none; font: 700 9px ui-monospace, monospace; color: #2f7fd1; }
.api-call .method.post { color: #14805f; }
.api-call .method.put, .api-call .method.patch { color: #a56912; }
.api-call .method.delete { color: #be3e4b; }
.call-url { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 9px ui-monospace, monospace; color: #39424d; }
.call-status { flex: none; font-size: 9px; color: #14805f; }
.call-status.failed { color: #be3e4b; }
.call-meta { padding: 0 10px 6px; color: #8a949f; font-size: 9px; }
.api-call label { display: block; padding: 6px 10px 3px; color: #687481; font-size: 8px; font-weight: 700; letter-spacing: .1em; }
.api-call .help-text { padding: 0 10px 4px; }
.preset-row { display: flex; align-items: center; gap: 6px; }
.preset-row .el-select { flex: 1; }
.button-row.tight { margin-top: 0; }
.crumb-project { max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #4d5864; }
.io-panel details { border: 1px solid #e3e7ec; border-radius: 5px; }
.io-panel summary { padding: 8px 10px; color: #687481; font-size: 10px; font-weight: 700; text-transform: uppercase; cursor: pointer; }
.io-panel pre, .io-dialog-data { margin: 0; background: #f7f8fa; color: #333b45; white-space: pre-wrap; overflow-wrap: anywhere; overflow: auto; }
.io-panel pre { max-height: 180px; padding: 0 10px 10px; font: 10px/1.5 ui-monospace, monospace; }
.io-dialog-data { max-height: 65vh; padding: 16px; border: 1px solid #e1e6eb; border-radius: 6px; font: 12px/1.6 ui-monospace, monospace; }
.inspector-empty { margin: auto; text-align: center; color: #7e8995; padding: 24px; }
.inspector-empty span { display: block; font-size: 25px; color: #a6afb9; }
.inspector-empty b { display: block; margin-top: 10px; font-size: 12px; color: #414a54; }
.inspector-empty p { font-size: 10px; line-height: 1.5; }
.inspector-foot { margin-top: auto; padding: 12px 18px; border-top: 1px solid #e5e9ed; display: flex; justify-content: space-between; color: #697582; font-size: 10px; }
@media (max-width: 1100px) {
  .workspace { grid-template-columns: minmax(0, 1fr) 280px; }
  .crumb { display: none; }
}
@media (max-width: 800px) {
  .flow-shell { height: auto; min-height: calc(100vh - 58px); overflow: visible; }
  .toolbar { flex-wrap: wrap; padding: 10px 12px; }
  .workspace { display: flex; flex-direction: column; }
  .canvas-wrap { height: 60vh; }
  .canvas-head p { display: none; }
  .inspector { border-left: 0; border-top: 1px solid #e3e7ec; }
}
</style>
