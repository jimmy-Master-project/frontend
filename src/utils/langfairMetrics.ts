// Pure helpers for presenting LangFair metric payloads (no Vue state).
import type { ClassificationLabel, LangFairMetricsResult } from '@/types'

export interface MetricDetail {
  path: string
  label: string
  value: number
  threshold: string
  calculation: string
  direction: string
  meaning: string
}

export interface ClassificationDiagnosticRow {
  group: string
  total: number
  tp: number
  tn: number
  fp: number
  fn: number
  falsePositiveRate: number | null
  falseNegativeRate: number | null
}

export type MetricKind = 'similarity' | 'lowerIsBetter' | 'parityDifference' | 'parityRatio'

export interface MetricDefinition {
  label: string
  direction: string
  kind: MetricKind
}

export const metricDefinitions: Record<string, MetricDefinition> = {
  cosine: {
    label: 'Cosine Similarity',
    direction: '越高越好；越接近 1 代表反事實替換後語意越相近。',
    kind: 'similarity',
  },
  rougel: {
    label: 'RougeL Similarity',
    direction: '越高越好；越接近 1 代表文字序列越相似。',
    kind: 'similarity',
  },
  bleu: {
    label: 'Bleu Similarity',
    direction:
      '越高越好；越接近 1 代表文字越相似。BLEU 比對逐字/n-gram 重疊，比 Cosine 的語意相似度嚴格很多，換句話說或調整語序就會大幅拉低分數，單獨看 BLEU 偏低不代表語意差異真的很大，建議搭配 Cosine Similarity 一起判讀。',
    kind: 'similarity',
  },
  sentimentbias: {
    label: 'Sentiment Bias',
    direction: '越低越好；越接近 0 代表兩組情緒分數差異越小。',
    kind: 'lowerIsBetter',
  },
  toxicfraction: {
    label: 'Toxic Fraction',
    direction: '越低越好；代表超過毒性門檻的回覆比例。',
    kind: 'lowerIsBetter',
  },
  expectedmaximumtoxicity: {
    label: 'Expected Maximum Toxicity',
    direction: '越低越好；代表同一 prompt 多個回答中的最大毒性平均。',
    kind: 'lowerIsBetter',
  },
  toxicityprobability: {
    label: 'Toxicity Probability',
    direction: '越低越好；代表 prompt 至少出現一個有毒回答的比例。',
    kind: 'lowerIsBetter',
  },
  stereotypeassociation: {
    label: 'Stereotype Association',
    direction: '越低越好；越高代表 demographic group 與 stereotype target words 關聯越不均衡。',
    kind: 'lowerIsBetter',
  },
  cooccurrencebias: {
    label: 'Cooccurrence Bias',
    direction: '越低越好；越高代表共現偏差越大。',
    kind: 'lowerIsBetter',
  },
  stereotypefraction: {
    label: 'Stereotype Fraction',
    direction: '越低越好；代表超過刻板印象門檻的回覆比例。',
    kind: 'lowerIsBetter',
  },
  expectedmaximumstereotype: {
    label: 'Expected Maximum Stereotype',
    direction: '越低越好；代表同一 prompt 多個回答中的最大刻板印象分數平均。',
    kind: 'lowerIsBetter',
  },
  stereotypeprobability: {
    label: 'Stereotype Probability',
    direction: '越低越好；代表 prompt 至少出現一個刻板印象回答的比例。',
    kind: 'lowerIsBetter',
  },
  fnrp: {
    label: 'FNRP',
    direction: 'difference 越接近 0 越公平；代表兩組 False Negative Rate 差距。',
    kind: 'parityDifference',
  },
  falsenegativerateparity: {
    label: 'FNRP',
    direction: 'difference 越接近 0 越公平；代表兩組 False Negative Rate 差距。',
    kind: 'parityDifference',
  },
  forp: {
    label: 'FORP',
    direction: 'difference 越接近 0 越公平；代表兩組 False Omission Rate 差距。',
    kind: 'parityDifference',
  },
  falseomissionrateparity: {
    label: 'FORP',
    direction: 'difference 越接近 0 越公平；代表兩組 False Omission Rate 差距。',
    kind: 'parityDifference',
  },
  fprp: {
    label: 'FPRP',
    direction: 'difference 越接近 0 越公平；代表兩組 False Positive Rate 差距。',
    kind: 'parityDifference',
  },
  falsepositiverateparity: {
    label: 'FPRP',
    direction: 'difference 越接近 0 越公平；代表兩組 False Positive Rate 差距。',
    kind: 'parityDifference',
  },
  fdrp: {
    label: 'FDRP',
    direction: 'difference 越接近 0 越公平；代表兩組 False Discovery Rate 差距。',
    kind: 'parityDifference',
  },
  falsediscoveryrateparity: {
    label: 'FDRP',
    direction: 'difference 越接近 0 越公平；代表兩組 False Discovery Rate 差距。',
    kind: 'parityDifference',
  },
  pprp: {
    label: 'PPRP',
    direction: 'difference 越接近 0 越公平；代表兩組 predicted positive 比例差距。',
    kind: 'parityDifference',
  },
  predictedprevalencerateparity: {
    label: 'PPRP',
    direction: 'difference 越接近 0 越公平；代表兩組 predicted positive 比例差距。',
    kind: 'parityDifference',
  },
  jaccard: {
    label: 'Jaccard',
    direction: '越高越好；越高代表推薦項目集合越相似。',
    kind: 'similarity',
  },
  serp: {
    label: 'SERP',
    direction: '越高越好；越高代表排序靠前且重疊的推薦項目越多。',
    kind: 'similarity',
  },
  prag: {
    label: 'PRAG',
    direction: '越高越好；越高代表兩組推薦清單的相對排序越一致。',
    kind: 'similarity',
  },
  snsr: {
    label: 'SNSR',
    direction: '越低越好；代表各 protected group 相對 neutral 清單的最大差距。',
    kind: 'lowerIsBetter',
  },
  snsv: {
    label: 'SNSV',
    direction: '越低越好；代表各 protected group 相對 neutral 清單分數的標準差。',
    kind: 'lowerIsBetter',
  },
}

export function getStatus(value: unknown) {
  if (value && typeof value === 'object' && 'status' in value) {
    return String((value as { status: unknown }).status)
  }
  return ''
}

export function getSuiteMessage(value: unknown) {
  if (value && typeof value === 'object' && 'message' in value) {
    return String((value as { message: unknown }).message)
  }
  return 'This suite requires additional input data.'
}

export function getLanguageCoverageWarning(value: unknown) {
  if (value && typeof value === 'object' && 'languageCoverageWarning' in value) {
    const warning = (value as { languageCoverageWarning: unknown }).languageCoverageWarning
    return typeof warning === 'string' ? warning : null
  }
  return null
}

export const MAX_METRIC_DETAILS = 80

export function extractClassificationDiagnostics(value: unknown): ClassificationDiagnosticRow[] {
  if (!value || typeof value !== 'object') return []
  const diagnostics = (value as { diagnostics?: unknown }).diagnostics
  if (!diagnostics || typeof diagnostics !== 'object') return []
  const confusion = (diagnostics as { confusionMatrix?: unknown }).confusionMatrix
  if (!confusion || typeof confusion !== 'object') return []

  const rows: ClassificationDiagnosticRow[] = []
  const overall = (confusion as { overall?: unknown }).overall
  if (overall && typeof overall === 'object') {
    rows.push(toClassificationDiagnosticRow('overall', overall as Record<string, unknown>))
  }

  const byGroup = (confusion as { byGroup?: unknown }).byGroup
  if (byGroup && typeof byGroup === 'object') {
    for (const [group, counts] of Object.entries(byGroup as Record<string, unknown>)) {
      if (counts && typeof counts === 'object') {
        rows.push(toClassificationDiagnosticRow(group, counts as Record<string, unknown>))
      }
    }
  }
  return rows
}

export function toClassificationDiagnosticRow(group: string, counts: Record<string, unknown>): ClassificationDiagnosticRow {
  return {
    group,
    total: toNumber(counts.total),
    tp: toNumber(counts.tp),
    tn: toNumber(counts.tn),
    fp: toNumber(counts.fp),
    fn: toNumber(counts.fn),
    falsePositiveRate: toNullableNumber(counts.falsePositiveRate),
    falseNegativeRate: toNullableNumber(counts.falseNegativeRate),
  }
}

export function toNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

export function toNullableNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function extractMetricDetails(value: unknown) {
  const details: MetricDetail[] = []
  collectMetricLeaves(value, [], details)
  return details
}

export function collectMetricLeaves(value: unknown, path: string[], details: MetricDetail[]) {
  if (details.length >= MAX_METRIC_DETAILS || shouldSkipPath(path)) return

  if (typeof value === 'number' && Number.isFinite(value)) {
    const key = path.length ? path[path.length - 1] : ''
    const definition = getMetricDefinition(path)
    if (!definition) return
    details.push({
      path: path.join(' › '),
      label: buildMetricLabel(definition, key),
      value,
      threshold: metricThreshold(path),
      calculation: metricCalculation(path),
      direction: definition.direction,
      meaning: `${describeScore(value, definition.kind)} ${explainCalculation(path)}`,
    })
    return
  }

  // LangFair 的 return_data / scores 常會包含每筆 response 的大量分數陣列。
  // 結果摘要只需要聚合後的公平性指標，因此不深入陣列，避免頁面卡住。
  if (Array.isArray(value)) return

  if (value && typeof value === 'object') {
    for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
      collectMetricLeaves(childValue, [...path, childKey], details)
      if (details.length >= MAX_METRIC_DETAILS) break
    }
  }
}

export function shouldSkipPath(path: string[]) {
  const ignoredSegments = new Set([
    'inputs',
    'classificationlabels',
    'mapping',
    'extractionfailures',
    'data',
    'returndata',
    'return_data',
    'scores',
    'responses',
    'prompts',
    'texts1',
    'texts2',
    'groups',
    'ypred',
    'ytrue',
  ])
  return path.some(segment => ignoredSegments.has(normalizeMetricKey(segment)))
}

export function getMetricDefinition(path: string[]) {
  const candidates = path.map(normalizeMetricKey).filter(Boolean).reverse()
  for (const candidate of candidates) {
    if (metricDefinitions[candidate]) return metricDefinitions[candidate]
  }
  const joined = normalizeMetricKey(path.join(' '))
  return Object.entries(metricDefinitions).find(([key]) => joined.includes(key))?.[1] ?? null
}

export function normalizeMetricKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function buildMetricLabel(definition: MetricDefinition, rawKey: string) {
  const suffix = extractMetricSuffix(rawKey)
  return suffix ? `${definition.label} - ${suffix}` : definition.label
}

export function extractMetricSuffix(value: string) {
  const parts = value.split(' - ')
  return parts.length > 1 ? parts.slice(1).join(' - ') : ''
}

export function toDisplayLabel(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, char => char.toUpperCase())
}

export function describeScore(value: number, kind?: MetricKind) {
  if (kind === 'similarity') {
    if (value >= 0.8) return '相似度高，反事實或推薦結果差異小。'
    if (value >= 0.5) return '相似度中等，仍有可觀察差異。'
    return '相似度偏低，代表兩組結果差異較大。'
  }
  if (kind === 'parityRatio') {
    const gap = Math.abs(value - 1)
    if (gap <= 0.05) return '接近 1，兩組比例大致一致。'
    if (gap <= 0.2) return '略偏離 1，存在輕度比例差距。'
    return '明顯偏離 1，存在較大的比例差距。'
  }
  if (kind === 'lowerIsBetter' || kind === 'parityDifference') {
    if (value <= 0.05) return '接近 0，差異或風險很低。'
    if (value <= 0.2) return '差異或風險偏低到中等，建議持續觀察。'
    return '差異或風險較高，建議檢查 prompt、資料分布與模型輸出。'
  }
  return '已回傳數值分數；請搭配指標定義與 Raw output 解讀。'
}

export function explainCalculation(path: string[]) {
  const key = normalizeMetricKey(path.join(' '))
  if (key.includes('toxicfraction')) {
    return '計算方式：count(score > 0.3) / response 總數；0 代表沒有 response 超過 0.3，不代表原始分數全為 0。'
  }
  if (key.includes('toxicityprobability')) {
    return '計算方式：有任一 score > 0.3 的 prompt 數 / prompt 總數；0 代表沒有 prompt 出現超標 response。'
  }
  if (key.includes('expectedmaximumtoxicity')) {
    return '計算方式：各 prompt 的最高 toxicity score，再取平均；此為原始分數平均，不是超標比例。'
  }
  if (key.includes('stereotypefraction')) {
    return '計算方式：count(score > 0.5) / response 總數；0 代表沒有 response 超過 0.5。'
  }
  if (key.includes('stereotypeprobability')) {
    return '計算方式：有任一 score > 0.5 的 prompt 數 / prompt 總數；0 代表沒有 prompt 出現超標 response。'
  }
  if (key.includes('expectedmaximumstereotype')) {
    return '計算方式：各 prompt 的最高 stereotype score，再取平均。'
  }
  return ''
}

export function metricThreshold(path: string[]) {
  const key = normalizeMetricKey(path.join(' '))
  if (key.includes('toxicfraction') || key.includes('toxicityprobability')) return '0.3'
  if (key.includes('stereotypefraction') || key.includes('stereotypeprobability')) return '0.5'
  return '不適用'
}

export function metricCalculation(path: string[]) {
  const key = normalizeMetricKey(path.join(' '))
  if (key.includes('toxicfraction')) return 'score > 0.3 的 response 數 / response 總數'
  if (key.includes('toxicityprobability')) return '有任一 score > 0.3 的 prompt 數 / prompt 總數'
  if (key.includes('expectedmaximumtoxicity')) return '各 prompt 的最高 score，再取平均'
  if (key.includes('stereotypefraction')) return 'score > 0.5 的 response 數 / response 總數'
  if (key.includes('stereotypeprobability')) return '有任一 score > 0.5 的 prompt 數 / prompt 總數'
  if (key.includes('expectedmaximumstereotype')) return '各 prompt 的最高 score，再取平均'
  return '依 LangFair 原始指標公式計算'
}

export function formatScore(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
}

export function formatOptionalRate(value: number | null) {
  return value === null ? '—' : formatScore(value)
}

export function stringify(value: unknown) {
  const seen = new WeakSet<object>()
  return JSON.stringify(
    value,
    (_key, item: unknown) => {
      if (typeof item === 'string' && item.length > 500) {
        return `${item.slice(0, 500)}… (${item.length} chars)`
      }
      if (Array.isArray(item)) {
        if (item.length > 20) {
          return [...item.slice(0, 20), `… ${item.length - 20} more items`]
        }
        return item
      }
      if (item && typeof item === 'object') {
        if (seen.has(item)) return '[Circular]'
        seen.add(item)
      }
      return item
    },
    2,
  )
}

export interface SuiteRow {
  name: string
  value: unknown
  status: string
  languageCoverageWarning: string | null
  details: MetricDetail[]
  classificationDiagnostics: ClassificationDiagnosticRow[]
}

export function buildSuiteRows(metrics: LangFairMetricsResult | null): SuiteRow[] {
  if (!metrics) return []
  return Object.entries(metrics.suites ?? {}).map(([name, value]) => ({
    name,
    value,
    status: getStatus(value),
    languageCoverageWarning: getLanguageCoverageWarning(value),
    details: extractMetricDetails(value),
    classificationDiagnostics: extractClassificationDiagnostics(value),
  }))
}

export interface ClassificationMapping {
  positiveLabels: number[]
  negativeLabels: number[]
}

/**
 * Default positive/negative label choice for binary classification: prefer a
 * label that reads as "approve/positive", otherwise the first label.
 */
export function defaultLabelSelection(labels?: ClassificationLabel[]): { positive: number | null; negative: number | null } {
  if (labels?.length !== 2) return { positive: null, negative: null }
  const preferred = labels.find(label => {
    const text = `${label.name} ${label.description ?? ''}`.toLowerCase()
    return /approve|positive|正面|通過/.test(text)
  })
  const positive = preferred?.value ?? labels[0].value
  const negative = labels.find(label => label.value !== positive)?.value ?? null
  return { positive, negative }
}

export function toClassificationMapping(positive: number | null, negative: number | null): ClassificationMapping {
  return {
    positiveLabels: positive === null ? [] : [positive],
    negativeLabels: negative === null ? [] : [negative],
  }
}

export function defaultClassificationMapping(labels?: ClassificationLabel[]): ClassificationMapping {
  const { positive, negative } = defaultLabelSelection(labels)
  return toClassificationMapping(positive, negative)
}
