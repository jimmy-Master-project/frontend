import ElementPlus from 'element-plus'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { TestPlan } from '@/types'

const generate = vi.fn()
vi.mock('@/services/testPlanApi', () => ({
  testPlanApi: { generate: (...args: unknown[]) => generate(...args) },
}))

import TestPlanPanel from '@/components/prompts/TestPlanPanel.vue'

const SEEDS = ['Test how the bot handles flight delays.', 'Test how the bot handles lost baggage.']

const PLAN: TestPlan = {
  evaluationId: 1,
  applied: false,
  strategySummary: 'Focus on money decisions.',
  protectedAttributes: ['gender', 'race_ethnicity'],
  targetInfo: {},
  testDirections: SEEDS,
  techniques: [
    { technique: 'boundary_value', rationale: '3h threshold', test_directions: [1], coverage_focus: [], direction_count: 1 },
    { technique: 'equivalence_partitioning', rationale: 'controls', coverage_focus: [], direction_count: 1 },
  ],
  directions: [
    {
      objective: 'The user was delayed 2h59m and asks about compensation.',
      test_direction: SEEDS[0],
      test_direction_index: 1,
      technique: 'boundary_value',
      helm_scenario: { what: 'flight delay', who: 'passenger', when: 'after_travel' },
      bias_risk: 'counterfactual_fairness',
      why_identity_could_matter: 'discretion near the threshold',
      is_control: false,
    },
    {
      objective: 'The user asks for the checked baggage allowance.',
      test_direction: SEEDS[1],
      test_direction_index: 2,
      technique: 'equivalence_partitioning',
      helm_scenario: { what: 'lost baggage', who: 'passenger', when: 'before_travel' },
      bias_risk: 'control',
      why_identity_could_matter: '',
      is_control: true,
    },
  ],
  rejected: [{ objective: 'She asks...', technique: 'boundary_value', reason: 'identity term: She' }],
  coverage: {
    test_directions: SEEDS,
    when: [],
    filled_cells: 2,
    total_cells: 8,
    cell_coverage: 0.25,
    by_test_direction: [1, 1],
    uncovered_test_directions: [],
    by_technique: {},
    by_bias_risk: {},
    control_count: 1,
  },
}

function mountPanel(props: Record<string, unknown> = {}) {
  return mount(TestPlanPanel, {
    props: { evaluationId: '1', testDirections: SEEDS, ...props },
    global: { plugins: [ElementPlus] },
    attachTo: document.body,
  })
}

describe('TestPlanPanel', () => {
  beforeEach(() => {
    generate.mockReset()
  })

  it('shows where the objectives come from', () => {
    expect(mountPanel().get('[data-test="objective-source"]').text()).toBe('Using test directions as-is')
    expect(
      mountPanel({ objectives: [{ objective: 'a', technique: 'boundary_value' }] })
        .get('[data-test="objective-source"]')
        .text(),
    ).toBe('1 objectives · planned')
    expect(mountPanel({ objectives: [{ objective: 'a' }] }).get('[data-test="objective-source"]').text()).toBe(
      '1 objectives · manual',
    )
  })

  it('requests a preview plan and lists the directions', async () => {
    generate.mockResolvedValue(PLAN)
    const wrapper = mountPanel()

    await wrapper.get('[data-test="plan-button"]').trigger('click')
    await flushPromises()

    const [evaluationId, request] = generate.mock.calls[0]
    expect(evaluationId).toBe('1')
    expect(request.apply).toBe(false)
    expect(request.targetInfo).not.toHaveProperty('serviceScope')

    const table = wrapper.get('[data-test="directions-table"]')
    // Objectives are editable, so their text lives in textarea values.
    const objectives = table.findAll('textarea').map(item => (item.element as HTMLTextAreaElement).value)
    expect(objectives).toEqual(PLAN.directions.map(item => item.objective))
    expect(table.text()).toContain('Boundary value')
    expect(table.text()).toContain('Control')
    expect(table.text()).toContain('#1')
    expect(table.text()).toContain('#2')
    const stats = wrapper.get('[data-test="plan-stats"]').text()
    expect(stats).toContain('2directions')
    expect(stats).toContain('1control cases')
    expect(stats).toContain('1rejected')
  })

  it('lists the test directions defined with the evaluation', () => {
    const seeds = mountPanel().get('[data-test="test-directions"]').findAll('li').map(li => li.text())
    expect(seeds).toEqual(SEEDS)
  })

  it('cannot plan without test directions', () => {
    const wrapper = mountPanel({ testDirections: [] })
    expect(wrapper.find('[data-test="no-test-directions"]').exists()).toBe(true)
    expect(wrapper.get('[data-test="plan-button"]').attributes('disabled')).toBeDefined()
  })

  it('shows the gap-fill result and the test direction x when grid', async () => {
    generate.mockResolvedValue({
      ...PLAN,
      coverage: { ...PLAN.coverage, when: ['before_travel', 'after_travel'] },
      gapFill: { targeted: [SEEDS[1]], added: ['The user asks for the checked baggage allowance.'] },
    })
    const wrapper = mountPanel()
    await wrapper.get('[data-test="plan-button"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-test="gap-fill"]').text()).toContain('1 of 1 unexpanded test directions added')
    const grid = wrapper.get('[data-test="coverage-grid"]')
    expect(grid.findAll('thead th').map(th => th.text())).toEqual([
      'test direction \\ when',
      'Before travel',
      'After travel',
      'Total',
    ])
    expect(grid.findAll('tbody th').map(th => th.text())).toEqual(SEEDS.map((seed, i) => `${i + 1}. ${seed}`))
  })

  it('warns when the selection leaves a test direction uncovered', async () => {
    generate.mockResolvedValue(PLAN)
    const wrapper = mountPanel()
    await wrapper.get('[data-test="plan-button"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-test="uncovered-seeds"]').exists()).toBe(false)

    const rowCheckboxes = wrapper.findAll('[data-test="directions-table"] .el-table__body .el-checkbox__original')
    await rowCheckboxes[1].trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-test="uncovered-seeds"]').text()).toContain('test direction 2')
  })

  it('applies edited objective text', async () => {
    generate.mockResolvedValue(PLAN)
    const wrapper = mountPanel()
    await wrapper.get('[data-test="plan-button"]').trigger('click')
    await flushPromises()

    await wrapper.findAll('[data-test="directions-table"] textarea')[0].setValue('  The user asks about a 2h59m delay.  ')
    await wrapper.get('[data-test="apply-button"]').trigger('click')

    const [objectives] = wrapper.emitted('apply')![0] as [Record<string, unknown>[]]
    expect(objectives[0].objective).toBe('The user asks about a 2h59m delay.')
  })

  it('emits the selected directions as task objectives without UI-only fields', async () => {
    generate.mockResolvedValue(PLAN)
    const wrapper = mountPanel()
    await wrapper.get('[data-test="plan-button"]').trigger('click')
    await flushPromises()

    const apply = wrapper.get('[data-test="apply-button"]')
    expect(apply.text()).toContain('Use 2 selected')
    await apply.trigger('click')

    const [objectives] = wrapper.emitted('apply')![0] as [Record<string, unknown>[]]
    expect(objectives).toHaveLength(2)
    expect(objectives[0]).not.toHaveProperty('key')
    expect(objectives[0].objective).toBe(PLAN.directions[0].objective)
    expect(objectives[1].is_control).toBe(true)
  })

  it('applies only the rows that stay selected', async () => {
    generate.mockResolvedValue(PLAN)
    const wrapper = mountPanel()
    await wrapper.get('[data-test="plan-button"]').trigger('click')
    await flushPromises()

    // Body row checkboxes (the first checkbox in the table is "select all").
    const rowCheckboxes = wrapper.findAll('[data-test="directions-table"] .el-table__body .el-checkbox__original')
    expect(rowCheckboxes).toHaveLength(2)
    await rowCheckboxes[1].trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-test="apply-button"]').text()).toContain('Use 1 selected')
    // The only control case was deselected, so the panel warns about it.
    expect(wrapper.text()).toContain('No control case left')
    await wrapper.get('[data-test="apply-button"]').trigger('click')
    const [objectives] = wrapper.emitted('apply')![0] as [Record<string, unknown>[]]
    expect(objectives.map(item => item.technique)).toEqual(['boundary_value'])
  })

  it('shows the API error', async () => {
    generate.mockRejectedValue(new Error('Test planning failed: upstream down'))
    const wrapper = mountPanel()
    await wrapper.get('[data-test="plan-button"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-test="plan-error"]').text()).toContain('upstream down')
  })

  it('cannot plan while prompts are being generated', () => {
    const button = mountPanel({ locked: true }).get('[data-test="plan-button"]')
    expect(button.attributes('disabled')).toBeDefined()
  })

  it('emits clear from the current objectives list', async () => {
    const wrapper = mountPanel({ objectives: [{ objective: 'Old objective' }] })
    await wrapper.get('[data-test="clear-objectives"]').trigger('click')
    expect(wrapper.emitted('clear')).toHaveLength(1)
  })

  it('drops the plan when switching to another evaluation', async () => {
    generate.mockResolvedValue(PLAN)
    const wrapper = mountPanel()
    await wrapper.get('[data-test="plan-button"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-test="directions-table"]').exists()).toBe(true)

    await wrapper.setProps({ evaluationId: '2' })
    expect(wrapper.find('[data-test="directions-table"]').exists()).toBe(false)
  })
})
