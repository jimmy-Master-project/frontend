import { describe, expect, it } from 'vitest'

import type { TestPlanDirection } from '@/types'
import {
  buildTestPlanRequest,
  coverageGrid,
  defaultTestPlanForm,
  directionsToObjectives,
  isPlannedObjectives,
  parseTestDirections,
  whenLabel,
} from '@/utils/testPlan'

function direction(objective: string, seed: number, when: string, extra: Partial<TestPlanDirection> = {}): TestPlanDirection {
  return {
    objective,
    test_direction: `seed ${seed}`,
    test_direction_index: seed,
    technique: 'boundary_value',
    helm_scenario: { what: 'topic', who: 'passenger', when },
    bias_risk: 'counterfactual_fairness',
    why_identity_could_matter: '',
    is_control: false,
    ...extra,
  }
}

describe('buildTestPlanRequest', () => {
  it('trims, dedupes and drops blank target fields', () => {
    const form = {
      ...defaultTestPlanForm(),
      knownPolicies: '  Refund within 24h.  ',
      riskPriorities: '   ',
      modelName: '  ',
      totalDirections: 8,
    }
    expect(buildTestPlanRequest(form)).toEqual({
      targetInfo: {
        knownPolicies: 'Refund within 24h.',
        whenStages: ['before_travel', 'at_airport', 'during_disruption', 'after_travel'],
      },
      protectedAttributes: ['gender', 'race_ethnicity'],
      totalDirections: 8,
      temperature: 0.7,
      apply: false,
    })
  })

  it('normalizes custom when stages to snake_case keys', () => {
    const request = buildTestPlanRequest({
      ...defaultTestPlanForm(),
      whenStages: ['Before applying', 'after-decision', 'before_applying', '  '],
    })
    expect(request.targetInfo?.whenStages).toEqual(['before_applying', 'after_decision'])
  })

  it('sends the planning model only when given', () => {
    const request = buildTestPlanRequest({ ...defaultTestPlanForm(), modelName: ' gpt-4o ' })
    expect(request.modelName).toBe('gpt-4o')
  })

  it('always previews instead of applying on the server', () => {
    expect(buildTestPlanRequest(defaultTestPlanForm()).apply).toBe(false)
  })
})

describe('directionsToObjectives', () => {
  it('keeps metadata, trims text and drops blank objectives', () => {
    const result = directionsToObjectives([
      direction('  The user asks for a refund.  ', 1, 'after_travel'),
      direction('   ', 1, 'after_travel'),
    ])
    expect(result).toHaveLength(1)
    expect(result[0].objective).toBe('The user asks for a refund.')
    expect(result[0].technique).toBe('boundary_value')
    expect(result[0].test_direction_index).toBe(1)
  })
})

describe('isPlannedObjectives', () => {
  it('detects objectives produced by the planner', () => {
    expect(isPlannedObjectives([{ objective: 'manual' }])).toBe(false)
    expect(isPlannedObjectives([{ objective: 'planned', technique: 'decision_table' }])).toBe(true)
    expect(isPlannedObjectives(null)).toBe(false)
  })
})

describe('coverageGrid', () => {
  it('counts test direction x when cells and lists unexpanded test directions', () => {
    const grid = coverageGrid(
      [
        direction('a', 1, 'after_travel'),
        direction('b', 1, 'after_travel'),
        direction('c', 3, 'at_airport'),
      ],
      ['Test refunds.', 'Test lost baggage.', 'Test complaints.'],
    )
    expect(grid.whens).toEqual(['before_travel', 'at_airport', 'during_disruption', 'after_travel'])
    expect(grid.rows.map(row => [row.index, row.testDirection, row.total])).toEqual([
      [1, 'Test refunds.', 2],
      [2, 'Test lost baggage.', 0],
      [3, 'Test complaints.', 1],
    ])
    expect(grid.rows[0].cells).toEqual([0, 0, 0, 2])
    expect(grid.uncovered).toEqual([2])
    expect(grid.filled).toBe(2)
    expect(grid.totalCells).toBe(12)
    expect(grid.coverage).toBeCloseTo(2 / 12)
  })

  it('uses the planned when stages when given', () => {
    const grid = coverageGrid([direction('a', 1, 'after_decision')], ['Test loans.'], ['before_applying', 'after_decision'])
    expect(grid.whens).toEqual(['before_applying', 'after_decision'])
    expect(grid.rows[0].cells).toEqual([0, 1])
    expect(whenLabel('after_decision')).toBe('After decision')
    expect(whenLabel('at_airport')).toBe('At airport')
  })

  it('handles an empty plan', () => {
    expect(coverageGrid([], []).coverage).toBe(0)
  })
})

describe('parseTestDirections', () => {
  it('splits lines, collapses spaces and drops blanks and duplicates', () => {
    expect(parseTestDirections('  Test refunds. \n\n测试  行李遗失\r\nTest refunds.\n')).toEqual([
      'Test refunds.',
      '测试 行李遗失',
    ])
  })
})
