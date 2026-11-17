import { beforeEach, describe, expect, it, vi } from 'vitest'

const { post } = vi.hoisted(() => ({ post: vi.fn() }))
vi.mock('@/services/api', () => ({ default: { post } }))

import { TEST_PLAN_TIMEOUT_MS, testPlanApi } from '@/services/testPlanApi'

describe('testPlanApi.generate', () => {
  beforeEach(() => {
    post.mockReset()
  })

  it('posts to the evaluation test-plan endpoint with a long timeout', async () => {
    post.mockResolvedValue({ data: { directions: [] } })
    const result = await testPlanApi.generate('7', { apply: false, totalDirections: 5 })

    expect(post).toHaveBeenCalledWith(
      '/evaluations/7/test-plan/',
      { apply: false, totalDirections: 5 },
      { timeout: TEST_PLAN_TIMEOUT_MS },
    )
    expect(TEST_PLAN_TIMEOUT_MS).toBeGreaterThan(30_000)
    expect(result).toEqual({ directions: [] })
  })

  it('propagates errors', async () => {
    post.mockRejectedValue(new Error('boom'))
    await expect(testPlanApi.generate('1', {})).rejects.toThrow('boom')
  })
})
