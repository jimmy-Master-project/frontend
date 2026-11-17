import ElementPlus from 'element-plus'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { RunStatus } from '@/types'

const fetchCached = vi.fn()
const start = vi.fn()
vi.mock('@/services/responseApi', () => ({
  responseApi: {
    fetchCachedLangFairMetrics: (...args: unknown[]) => fetchCached(...args),
    startLangFairMetrics: (...args: unknown[]) => start(...args),
  },
}))

import RunMetricsComparison from '@/components/run/RunMetricsComparison.vue'

function run(id: number, model: string): RunStatus {
  return {
    id, status: 'completed', totalPrompts: 2, completedPrompts: 2, totalGenerations: 4, completedGenerations: 4,
    progress: 1, errorMessage: '', heartbeatAt: null, failedGenerations: 0, external: false, label: model,
    llmSnapshot: { provider: 'openai', modelName: model },
  }
}

function completed(gap: number, low: number, high: number) {
  return {
    status: 'completed',
    result: {
      runId: 1, responseCount: 4, availableSuites: ['counterfactual'],
      suites: { counterfactual: { baselineGap: { 'Cosine Similarity': { value: gap, ciLow: low, ciHigh: high } } } },
    },
    error: null,
  }
}

describe('RunMetricsComparison', () => {
  beforeEach(() => {
    fetchCached.mockReset()
    start.mockReset()
  })

  it('shows metrics side by side and computes the missing ones', async () => {
    fetchCached.mockImplementation((runId: number) =>
      Promise.resolve(runId === 1 ? completed(-0.02, -0.03, -0.01) : { status: 'none', result: null, error: null }),
    )
    start.mockResolvedValue(completed(0.01, -0.01, 0.02))
    const wrapper = mount(RunMetricsComparison, {
      props: { runs: [run(1, 'bot-a'), run(2, 'bot-b')], evaluationId: '3' },
      global: { plugins: [ElementPlus] },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('1 flagged')
    expect(wrapper.get('[data-test="compute-missing"]').text()).toContain('(1)')

    await wrapper.get('[data-test="compute-missing"]').trigger('click')
    await flushPromises()

    expect(start).toHaveBeenCalledWith(2)
    const matrix = wrapper.get('[data-test="metric-matrix"]').text()
    expect(matrix).toContain('bot-a')
    expect(matrix).toContain('bot-b')
    expect(matrix).toContain('flagged')
  })
})
