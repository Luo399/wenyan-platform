import { describe, it, expect, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import ClassPicker from '../ClassPicker.vue'
import type { ClassOptions } from '@/services/classOptions'

/** 固定的 mock 选项数据（避免依赖后端） */
const MOCK_OPTIONS: ClassOptions = {
  grades: ['2023', '2024', '2025'],
  gradeMap: {
    '2023': ['202301', '202302'],
    '2024': ['202401', '202402', '202403'],
    '2025': ['202501'],
  },
}

/** 包装：传 options 绕过 fetch */
function factory(props?: Partial<{ modelValue: string[]; fullAccess?: boolean; options: ClassOptions }>) {
  return mount(ClassPicker, {
    props: {
      modelValue: [],
      options: MOCK_OPTIONS,
      ...props,
    },
  }) as VueWrapper<InstanceType<typeof ClassPicker>>
}

/** 手动触发 checkbox change（happy-dom 下 setChecked 可能有 bug） */
async function checkCheckbox(wrapper: VueWrapper, selector: string, checked: boolean) {
  const el = wrapper.get(selector).element as HTMLInputElement
  el.checked = checked
  el.dispatchEvent(new Event('change', { bubbles: true }))
  await wrapper.vm.$nextTick()
}

describe('ClassPicker 组件', () => {
  describe('初始化与渲染', () => {
    it('传 options 后 specific-picker 显示', () => {
      const w = factory()
      // 不传 fullAccess → innerFullAccess=false → isFullAccess=false → specific-picker 显示
      expect(w.find('[data-testid="specific-picker"]').exists()).toBe(true)
    })

    it('传 options + 默认 props → fullAccess checkbox 未勾选', () => {
      const w = factory()
      const cb = w.find('[data-testid="full-access-checkbox"]').element as HTMLInputElement
      expect(cb.checked).toBe(false)
    })

    it('初始 modelValue=[] + fullAccess=true → checkbox 勾上 + specific-picker 隐藏', () => {
      const w = factory({ modelValue: [], fullAccess: true })
      const cb = w.find('[data-testid="full-access-checkbox"]').element as HTMLInputElement
      expect(cb.checked).toBe(true)
      expect(w.find('[data-testid="specific-picker"]').exists()).toBe(false)
    })

    it('onMounted 不传 options → 调 fetchGradesAndClasses 一次', async () => {
      vi.resetModules()
      const spy = vi.fn().mockResolvedValue({
        grades: ['2022'],
        gradeMap: { '2022': ['202201'] },
      })
      vi.doMock('@/services/classOptions', () => ({
        fetchGradesAndClasses: spy,
      }))

      const { default: FreshClassPicker } = await import('../ClassPicker.vue')
      const w = mount(FreshClassPicker as any, { props: { modelValue: [] } })

      await vi.waitFor(() => expect(spy).toHaveBeenCalledTimes(1))
      vi.doUnmock('@/services/classOptions')
      w.unmount()
    })
  })

  describe('v-model 双向同步', () => {
    it('modelValue 初始有值 → 已选列表展示', () => {
      const w = factory({ modelValue: ['202401', '202402'] })
      expect(w.findAll('[data-testid^="selected-"]').length).toBe(2)
    })

    it('更新外部 modelValue → 内部 innerClassCodes 同步', async () => {
      const w = factory({ modelValue: ['202401'] })
      await w.setProps({ modelValue: ['202401', '202402', '202403'] })
      expect(w.findAll('[data-testid^="selected-"]').length).toBe(3)
    })
  })

  describe('全年级权限开关', () => {
    it('勾选全权限 → emit fullAccess=true + modelValue=[] + specific-picker 隐藏', async () => {
      const w = factory({ modelValue: ['202401', '202402'] })
      await checkCheckbox(w, '[data-testid="full-access-checkbox"]', true)

      const emitted = w.emitted()
      // 打开全权限时 isFullAccess 的 setter 触发 emit
      expect(emitted['update:modelValue']![0]).toEqual([[]])
      expect(emitted['update:fullAccess']![0]).toEqual([true])
      expect(w.find('[data-testid="specific-picker"]').exists()).toBe(false)
    })

    it('取消全权限 → emit fullAccess=false + specific-picker 重新显示', async () => {
      const w = factory({ modelValue: [] })
      await checkCheckbox(w, '[data-testid="full-access-checkbox"]', true)
      await checkCheckbox(w, '[data-testid="full-access-checkbox"]', false)

      const fullEmitted = w.emitted('update:fullAccess')!
      expect(fullEmitted[fullEmitted.length - 1][0]).toBe(false)
      expect(w.find('[data-testid="specific-picker"]').exists()).toBe(true)
    })

    it('打开全权限后 specific-picker 隐藏 + selected-row 消失', async () => {
      const w = factory({ modelValue: ['202401', '202402'] })
      await checkCheckbox(w, '[data-testid="full-access-checkbox"]', true)
      expect(w.find('[data-testid="specific-picker"]').exists()).toBe(false)
      expect(w.find('[data-testid="selected-row"]').exists()).toBe(false)
    })
  })

  describe('年级 + 班级 chip 选择（动态联动）', () => {
    it('选 2024 级 → 班级 chip 动态显示', async () => {
      const w = factory()
      await checkCheckbox(w, '[data-testid="grade-2024"] input', true)
      expect(w.find('[data-testid="class-row"]').exists()).toBe(true)
      expect(w.findAll('[data-testid^="class-2024"]').length).toBe(3)
    })

    it('同时选 2023+2025 → 班级 chip 组合正确', async () => {
      const w = factory()
      await checkCheckbox(w, '[data-testid="grade-2023"] input', true)
      await checkCheckbox(w, '[data-testid="grade-2025"] input', true)

      const classIds = w.findAll('[data-testid^="class-"]').map((el) => el.attributes('data-testid'))
      expect(classIds).toContain('class-202301')
      expect(classIds).toContain('class-202302')
      expect(classIds).toContain('class-202501')
      expect(classIds).not.toContain('class-202401')
    })

    it('取消 2023 级 → 2023xx 班级 chip 消失', async () => {
      const w = factory()
      await checkCheckbox(w, '[data-testid="grade-2023"] input', true)
      await checkCheckbox(w, '[data-testid="grade-2023"] input', false)
      expect(w.findAll('[data-testid^="class-2023"]').length).toBe(0)
    })

    it('选班级 chip → emit modelValue + fullAccess=false', async () => {
      const w = factory()
      await checkCheckbox(w, '[data-testid="grade-2024"] input', true)
      await checkCheckbox(w, '[data-testid="class-202402"] input', true)

      const modelEmitted = w.emitted('update:modelValue')!
      const lastModel = modelEmitted[modelEmitted.length - 1][0] as string[]
      expect(lastModel).toEqual(['202402'])

      const fullEmitted = w.emitted('update:fullAccess')!
      expect(fullEmitted[fullEmitted.length - 1][0]).toBe(false)
    })
  })

  describe('手动输入', () => {
    it('合法 6 位编码 → 添加到已选列表', async () => {
      const w = factory()
      const input = w.get('[data-testid="manual-input"]')
      await input.setValue('202501')
      await w.get('[data-testid="add-btn"]').trigger('click')

      expect(w.find('[data-testid="selected-202501"]').exists()).toBe(true)
      const modelEmitted = w.emitted('update:modelValue')!
      expect(modelEmitted[modelEmitted.length - 1][0]).toEqual(['202501'])
    })

    it('合法编码输入后按 Enter 也能添加', async () => {
      const w = factory()
      const input = w.get('[data-testid="manual-input"]')
      await input.setValue('202501')
      await input.trigger('keyup.enter')
      expect(w.find('[data-testid="selected-202501"]').exists()).toBe(true)
    })

    it('非法编码（非 6 位 / 字母 / 空格）→ 不添加', async () => {
      const w = factory()
      const cases = ['', 'abc', '123', '20250', ' 202501', '2025011', '202a01']
      for (const val of cases) {
        await w.get('[data-testid="manual-input"]').setValue(val)
        await w.get('[data-testid="add-btn"]').trigger('click')
      }
      // 全部无效，selected-row 不应出现
      expect(w.find('[data-testid="selected-row"]').exists()).toBe(false)
    })

    it('重复输入同一编码 → 去重不再次添加', async () => {
      const w = factory()
      await w.get('[data-testid="manual-input"]').setValue('202401')
      await w.get('[data-testid="add-btn"]').trigger('click')
      await w.get('[data-testid="manual-input"]').setValue('202401')
      await w.get('[data-testid="add-btn"]').trigger('click')
      expect(w.findAll('[data-testid="selected-202401"]').length).toBe(1)
    })

    it('输入框清空时 添加按钮 disabled', async () => {
      const w = factory()
      const btn = w.get('[data-testid="add-btn"]')
      expect(btn.attributes('disabled')).toBeDefined()
      await w.get('[data-testid="manual-input"]').setValue('202401')
      expect(btn.attributes('disabled')).toBeUndefined()
    })
  })

  describe('已选移除', () => {
    it('点击 × 按钮 → 从已选列表移除 + emit', async () => {
      const w = factory({ modelValue: ['202401', '202402'] })
      await w.get('[data-testid="remove-202401"]').trigger('click')

      expect(w.find('[data-testid="selected-202401"]').exists()).toBe(false)
      expect(w.find('[data-testid="selected-202402"]').exists()).toBe(true)

      const modelEmitted = w.emitted('update:modelValue')!
      expect(modelEmitted[modelEmitted.length - 1][0]).toEqual(['202402'])
    })

    it('移除后若该年级下已无班级 → 年级 chip 自动反推清空', async () => {
      const w = factory()
      await checkCheckbox(w, '[data-testid="grade-2024"] input', true)
      await checkCheckbox(w, '[data-testid="class-202401"] input', true)
      await checkCheckbox(w, '[data-testid="class-202402"] input', true)

      await w.get('[data-testid="remove-202401"]').trigger('click')
      await w.get('[data-testid="remove-202402"]').trigger('click')

      // 2024 没有任何选中班级 → 年级 chip 不应保持选中
      const grade2024 = w.get('[data-testid="grade-2024"]').find('input').element as HTMLInputElement
      expect(grade2024.checked).toBe(false)
    })
  })

  describe('props.fullAccess 外部控制', () => {
    it('父组件传 fullAccess=true + modelValue 有值 → 忽略 modelValue', () => {
      const w = factory({ modelValue: ['202401'], fullAccess: true })
      expect(w.find('[data-testid="specific-picker"]').exists()).toBe(false)
      const cb = w.find('[data-testid="full-access-checkbox"]').element as HTMLInputElement
      expect(cb.checked).toBe(true)
    })

    it('父组件把 fullAccess 从 true 改成 false → specific-picker 重新显示', async () => {
      const w = factory({ modelValue: [], fullAccess: true })
      await w.setProps({ fullAccess: false })
      expect(w.find('[data-testid="specific-picker"]').exists()).toBe(true)
      const cb = w.find('[data-testid="full-access-checkbox"]').element as HTMLInputElement
      expect(cb.checked).toBe(false)
    })
  })
})
