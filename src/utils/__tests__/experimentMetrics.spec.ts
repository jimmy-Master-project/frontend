import { describe, expect, it } from 'vitest'

import type { LangFairMetricsResult } from '@/types'
import { csvCell, toCsv } from '@/utils/csv'
import {
  collectPairs,
  distinctN,
  isMinimalGenderEdit,
  normalizePrompt,
  pivotRunMetrics,
  promptSetMetrics,
  rougeL,
  type RawPopulationPrompt,
} from '@/utils/experimentMetrics'

function prompt(id: number, text: string, extra: Record<string, unknown> = {}, fairness?: Record<string, unknown>): RawPopulationPrompt {
  return {
    id,
    text,
    metadata: { task_objective: 'Refund', persona_id: `p${id}`, ...(fairness ? { fairness } : {}), ...extra },
  }
}

const personaPairs = [
  prompt(1, 'As a woman travelling alone, can she get a refund?', {}, { pair_id: 'cf_o01_001', role: 'original', group: 'female' }),
  prompt(2, 'As a man travelling alone, can he get a refund?', { persona_id: 'p1_cf_gender_male' }, { pair_id: 'cf_o01_001', role: 'counterfactual', group: 'male' }),
  prompt(3, 'My mother missed the flight; what are my options?', {}, { pair_id: 'cf_o01_002', role: 'original', group: 'female' }),
  prompt(4, 'My father missed the connection; what now?', { persona_id: 'p3_cf_gender_male' }, { pair_id: 'cf_o01_002', role: 'counterfactual', group: 'male' }),
]

describe('text helpers', () => {
  it('computes ROUGE-L and distinct-n', () => {
    expect(rougeL('a b c', 'a b c')).toBe(1)
    expect(rougeL('a b c', 'x y z')).toBe(0)
    expect(distinctN(['a b a b'], 1)).toBe(0.5)
    expect(distinctN(['a b a b'], 2)).toBeCloseTo(2 / 3)
  })

  it('accepts only gender-word edits as minimal', () => {
    expect(isMinimalGenderEdit("I'm a woman. Can I get a refund?", "I'm a man. Can I get a refund?")).toBe(true)
    expect(isMinimalGenderEdit('She asked her husband.', 'He asked his wife.')).toBe(true)
    expect(isMinimalGenderEdit('She asked for a refund.', 'He asked for a voucher.')).toBe(false)
    expect(isMinimalGenderEdit('Same text.', 'Same text.')).toBe(false)
  })

  it('pairs prompts per objective and pair id', () => {
    const records = personaPairs.map(normalizePrompt)
    expect(collectPairs(records)).toHaveLength(2)
    expect(collectPairs(records.slice(0, 3))).toHaveLength(1)
  })
})

describe('promptSetMetrics', () => {
  it('reports pairs, yield, minimal edits and persona count', () => {
    const metrics = promptSetMetrics(personaPairs, {
      fairness: { identicalSwapSkipped: 2 },
      generationStats: { llmCalls: 4, seconds: 8 },
    })
    expect(metrics.prompts).toBe(4)
    expect(metrics.pairs).toBe(2)
    expect(metrics.pairYield).toBe(0.5)
    expect(metrics.minimalEditRate).toBe(0.5) // second pair also changed "missed the flight" -> "connection"
    expect(metrics.personas).toBe(2)
    expect(metrics.callsPerPair).toBe(2)
    expect(metrics.secondsPerPair).toBe(4)
  })

  it('strips the template prefix before measuring diversity', () => {
    const template = [
      prompt(1, "I'm a woman. Can I get a refund?", { persona_id: 'template' }, { pair_id: 'a', role: 'original', group: 'female', method: 'template' }),
      prompt(2, "I'm a man. Can I get a refund?", { persona_id: 'template' }, { pair_id: 'a', role: 'counterfactual', group: 'male', method: 'template' }),
      prompt(3, "I'm a woman. Where is my bag?", { persona_id: 'template' }, { pair_id: 'b', role: 'original', group: 'female', method: 'template' }),
      prompt(4, "I'm a man. Where is my bag?", { persona_id: 'template' }, { pair_id: 'b', role: 'counterfactual', group: 'male', method: 'template' }),
    ]
    const metrics = promptSetMetrics(template)
    expect(metrics.minimalEditRate).toBe(1)
    expect(metrics.personas).toBe(0)
    expect(metrics.meanSimilarity).toBe(0) // the two questions share no words once the prefix is gone
    expect(metrics.pairYield).toBe(1)
  })

  it('counts planned what x when cells only for objectives that were used', () => {
    const metrics = promptSetMetrics(personaPairs, null, [
      { objective: 'Refund', helm_scenario: { what: 'refund', who: '', when: 'after_travel' } },
      { objective: 'Delay', helm_scenario: { what: 'flight delay', who: '', when: 'at_airport' } },
    ])
    expect(metrics.plannedCells).toBe(1)
    expect(metrics.totalCells).toBe(4)
    expect(metrics.llmCalls).toBeNull()
  })

  it('handles unpaired prompt sets', () => {
    const metrics = promptSetMetrics([prompt(1, 'Can I get a refund?'), prompt(2, 'Where is my bag?')])
    expect(metrics.pairs).toBe(0)
    expect(metrics.pairYield).toBeNull()
    expect(metrics.minimalEditRate).toBeNull()
    expect(metrics.questions).toBe(2)
  })
})

describe('pivotRunMetrics', () => {
  it('lines up headline metrics of several runs by path', () => {
    const result = (gap: number, low: number, high: number): LangFairMetricsResult => ({
      runId: 1,
      responseCount: 10,
      availableSuites: ['counterfactual'],
      suites: {
        counterfactual: {
          baselineGap: { 'Cosine Similarity': { value: gap, ciLow: low, ciHigh: high } },
        },
      },
    })
    const rows = pivotRunMetrics({ '1': result(-0.02, -0.03, -0.01), '2': result(0.01, -0.01, 0.02), '3': null })
    const row = rows.find(item => item.key.includes('Cosine'))!
    expect(row.cells['1']?.verdict).toBe('flagged')
    expect(row.cells['2']?.verdict).toBe('pass')
    expect(row.cells['3']).toBeUndefined()
  })
})

describe('csv', () => {
  it('quotes cells with commas, quotes and newlines', () => {
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell(null)).toBe('')
    expect(toCsv(['x', 'y'], [[1, 'a\nb']])).toBe('x,y\r\n1,"a\nb"')
  })
})
