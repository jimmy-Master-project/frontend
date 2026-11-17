import ElementPlus from 'element-plus'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import FieldLabel from '@/components/common/FieldLabel.vue'
import EvaluationForm from '@/components/evaluation/EvaluationForm.vue'
import { FIELD_HELP } from '@/utils/fieldHelp'

describe('FieldLabel', () => {
  it('shows the help text only after the help icon is clicked', async () => {
    const wrapper = mount(FieldLabel, {
      props: { label: 'Test Directions', help: 'What this field is for.' },
      global: { plugins: [ElementPlus] },
      attachTo: document.body,
    })
    expect(wrapper.text()).toBe('Test Directions')
    const popover = () => document.querySelector('[data-test="field-help-text"]')?.closest('.el-popover') as HTMLElement
    expect(popover().style.display).toBe('none')

    await wrapper.get('[data-test="field-help"]').trigger('click')
    // The popover opens on a timer (show-after), not synchronously.
    await new Promise(resolve => setTimeout(resolve, 50))
    await flushPromises()

    expect(popover().style.display).not.toBe('none')
    expect(popover().textContent).toContain('What this field is for.')
    wrapper.unmount()
  })

  it('renders no help icon without help text', () => {
    const wrapper = mount(FieldLabel, { props: { label: 'Name' }, global: { plugins: [ElementPlus] } })
    expect(wrapper.find('[data-test="field-help"]').exists()).toBe(false)
  })

  it('gives every evaluation form field a help icon', () => {
    const wrapper = mount(EvaluationForm, { global: { plugins: [ElementPlus] } })
    // Name, target description, test directions, file, task type, language.
    expect(wrapper.findAll('[data-test="field-help"]')).toHaveLength(6)
  })

  it('has non-empty help text for every key', () => {
    for (const [key, text] of Object.entries(FIELD_HELP)) expect(text.trim(), key).not.toBe('')
  })
})
