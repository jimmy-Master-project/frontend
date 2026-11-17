import ElementPlus from 'element-plus'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const sessionCheck = vi.fn()
vi.mock('@/services/llmConfigApi', () => ({
  llmConfigApi: { sessionCheck: (...args: unknown[]) => sessionCheck(...args) },
}))

import SessionCheckPanel from '@/components/llm/SessionCheckPanel.vue'

function trial(leaked: boolean) {
  return {
    code: 'ABC123', name: 'Taylor', plantPrompt: 'p', plantResponse: 'ok', probePrompt: 'q',
    probeResponse: leaked ? 'ABC123, Taylor' : "I don't know.", leakedCode: leaked, leakedName: leaked, leaked,
    provider: 'evaair', modelName: 'evaair',
  }
}

describe('SessionCheckPanel', () => {
  beforeEach(() => sessionCheck.mockReset())

  it('runs one request per trial and reports leaks', async () => {
    sessionCheck.mockResolvedValueOnce(trial(false)).mockResolvedValueOnce(trial(true)).mockResolvedValue(trial(false))
    const wrapper = mount(SessionCheckPanel, { props: { evaluationId: '7' }, global: { plugins: [ElementPlus] } })

    await wrapper.get('[data-test="session-run"]').trigger('click')
    await flushPromises()

    expect(sessionCheck).toHaveBeenCalledTimes(5)
    expect(sessionCheck).toHaveBeenCalledWith('7')
    expect(wrapper.get('[data-test="session-verdict"]').text()).toBe('1 / 5 leaked')
    expect(wrapper.get('[data-test="session-table"]').text()).toContain('Leaked')
  })
})
