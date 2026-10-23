import { describe, it, expect, vi, beforeEach } from 'vitest'
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
function factory(props?: Partial<{ modelValue: string[]; options: ClassOptions }>) {
  return mount(ClassPicker, {
    props: {
      modelValue: [],
      options: MOCK_OPTIONS,
      ...props,
    },
  }) as VueWrapper<InstanceType<typeof ClassPicker>>
}

describe('ClassPicker 组件', () => {
  describe('初始化与渲染', () => {
    it('传 options 后年级 chip 全部渲染', () => {
      const w = factory()
      expect(w.findAll('[data-testid^="grade-"]').length).toBe(3)
      expect(w.get('[data-testid="grade-2023"]').text()).toContain('2023级')
    })

    it('modelValue 初始为空数组 → 全权限 checkbox 不勾选 + 具体班级选择显示', () => {
      const w = factory({ modelValue: [] })
      expect(w.find('[data-testid="full-access-checkbox"]').element.checked).toBe(false)
      expect(w.find('[data-testid="specific-picker"]').exists()).toBe(true)
    })

    it('modelValue 初始有值 → 全权限 checkbox 不勾选 + 具体班级选择显示', () => {
      const w = factory({ modelValue: ['202401'] })
      expect(w.find('[data-testid="full-access-checkbox"]').element.checked).toBe(false)
      expect(w.find('[data-testid="specific-picker"]').exists()).toBe(true)
    })
  })

  describe('v-model / emit 双向同步', () => {
    it('modelValue 初始有值 → 已选列表展示', () => {
      const w = factory({ modelValue: ['202401', '202402'] })
      expect(w.findAll('[data-testid^="selected-2024"]').length).toBe(2)
    })

    it('更新外部 modelValue → 内部 innerClassCodes 同步', async () => {
      const w = factory({ modelValue: ['202401'] })
      await w.setProps({ modelValue: ['202401', '202402', '202403'] })
      expect(w.findAll('[data-testid^="selected-"]').length).toBe(3)
    })
  })

  describe('全年级权限开关', () => {
    it('勾选全权限 → emit update:fullAccess=true + modelValue=[]', async () => {
      const w = factory({ modelValue: ['202401', '202402'] })
      const cb = w.get('[data-testid="full-access-checkbox"]')
      await cb.setChecked(true)

      const updateModel = w.emitted('update:modelValue')
      const updateFull = w.emitted('update:fullAccess')
      expect(updateModel![0]).toEqual([[]])
      expect(updateFull![0]).toEqual([true])
      // 全权限状态下 specific-picker 应隐藏
      expect(w.find('[data-testid="specific-picker"]').exists()).toBe(false)
    })

    it('取消全权限 → emit fullAccess=false，specific-picker 重新显示', async () => {
      const w = factory({ modelValue: ['202401'] })
      const cb = w.get('[data-testid="full-access-checkbox"]')
      await cb.setChecked(true) // 先开
      await cb.setChecked(false) // 再关

      // 关闭时 classCodes 仍是空数组，所以 fullAccess=false
      expect(w.emitted('update:fullAccess')![1]).toEqual([false])
      expect(w.find('[data-testid="specific-picker"]').exists()).toBe(true)
    })
  })

  describe('年级 + 班级 chip 选择（动态联动）', () => {
    it('选 2024 级 → 班级 chip 动态显示 202401/202402/202403', async () => {
      const w = factory()
      // 选 2024（chip 的 input 是隐藏的，直接 setChecked）
      await w.get('[data-testid="grade-2024"]').find('input').setChecked(true)
      // 班级行出现，且有 3 个班级
      expect(w.find('[data-testid="class-row"]').exists()).toBe(true)
      expect(w.findAll('[data-testid^="class-2024"]').length).toBe(3)
    })

    it('同时选 2023+2025 → 班级 chip 包含 202301/202302/202501', async () => {
      const w = factory()
      await w.get('[data-testid="grade-2023"]').find('input').setChecked(true)
      await w.get('[data-testid="grade-2025"]').find('input').setChecked(true)

      const classLabels = w.findAll('[data-testid^="class-"]').map((el) => el.attributes('data-testid'))
      expect(classLabels).toContain('class-202301')
      expect(classLabels).toContain('class-202302')
      expect(classLabels).toContain('class-202501')
      expect(classLabels).not.toContain('class-202401')
    })

    it('取消 2023 级 → 2023xx 班级 chip 消失', async () => {
      const w = factory()
      await w.get('[data-testid="grade-2023"]').find('input').setChecked(true)
      await w.get('[data-testid="grade-2023"]').find('input').setChecked(false)

      expect(w.findAll('[data-testid^="class-2023"]').length).toBe(0)
    })

    it('选班级 chip → 已选列表同步 + emit update:modelValue', async () => {
      const w = factory()
      await w.get('[data-testid="grade-2024"]').find('input').setChecked(true)
      await w.get('[data-testid="class-202402"]').find('input').setChecked(true)

      const emitted = w.emitted('update:modelValue')!
      const lastEmitted = emitted[emitted.length - 1][0] as string[]
      expect(lastEmitted).toEqual(['202402'])
      // 已选列表 UI
      expect(w.find('[data-testid="selected-202402"]').exists()).toBe(true)
    })
  })

  describe('手动输入', () => {
    let w: VueWrapper<InstanceType<typeof ClassPicker>>
    beforeEach(() => { w = factory() })

    it('合法 6 位编码 → 添加到已选列表', async () => {
      const input = w.get('[data-testid="manual-input"]')
      await input.setValue('202501')
      await w.get('[data-testid="add-btn"]').trigger('click')

      expect(w.find('[data-testid="selected-202501"]').exists()).toBe(true)
      const emitted = w.emitted('update:modelValue')
      expect(emitted![emitted!.length - 1][0]).toEqual(['202501'])
    })

    it('合法编码输入后按 Enter 也能添加', async () => {
      const input = w.get('[data-testid="manual-input"]')
      await input.setValue('202501')
      await input.trigger('keyup.enter')

      expect(w.find('[data-testid="selected-202501"]').exists()).toBe(true)
    })

    it('非法编码（非 6 位 / 字母 / 前导空格）→ 不添加', async () => {
      const cases = ['', 'abc', '123', '20250', ' 202501', '2025011']
      for (const val of cases) {
        await w.get('[data-testid="manual-input"]').setValue(val)
        await w.get('[data-testid="add-btn"]').trigger('click')
      }
      // 全部无效，所以 selected-row 不应出现
      expect(w.find('[data-testid="selected-row"]').exists()).toBe(false)
    })

    it('重复输入同一编码 → 去重不再次添加', async () => {
      await w.get('[data-testid="manual-input"]').setValue('202401')
      await w.get('[data-testid="add-btn"]').trigger('click')
      await w.get('[data-testid="manual-input"]').setValue('202401')
      await w.get('[data-testid="add-btn"]').trigger('click')

      // 只有 1 个 selected-202401
      expect(w.findAll('[data-testid="selected-202401"]').length).toBe(1)
    })

    it('输入框清空时 添加按钮 disabled', async () => {
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

      const emitted = w.emitted('update:modelValue')!
      expect(emitted[emitted.length - 1][0]).toEqual(['202402'])
    })

    it('移除后若该年级下已无班级 → 年级 chip 自动反推清空', async () => {
      const w = factory()
      await w.get('[data-testid="grade-2024"]').find('input').setChecked(true)
      await w.get('[data-testid="class-202401"]').find('input').setChecked(true)
      await w.get('[data-testid="class-202402"]').find('input').setChecked(true)

      // 两个都移除
      await w.get('[data-testid="remove-202401"]').trigger('click')
      await w.get('[data-testid="remove-202402"]').trigger('click')

      // 2024 没有任何选中班级 → 年级 chip 不应保持选中
      const grade2024 = w.get('[data-testid="grade-2024"]').find('input')
      expect((grade2024.element as HTMLInputElement).checked).toBe(false)
    })
  })

  describe('fetch 调用（不传 options 时 onMounted 触发）', () => {
    it('mount 不传 options → fetchGradesAndClasses 被调用一次', async () => {
      vi.resetModules()
      const spy = vi.fn().mockResolvedValue({
        grades: ['2022'],
        gradeMap: { '2022': ['202201'] },
      })
      vi.doMock('@/services/classOptions', () => ({
        fetchGradesAndClasses: spy,
      }))

      // dynamic import 让 doMock 生效
      const { default: FreshClassPicker } = await import('../ClassPicker.vue')
      const w = mount(FreshClassPicker as any, {
        props: { modelValue: [] },
      })

      await vi.waitFor(() => expect(spy).toHaveBeenCalledTimes(1))
      expect(w.findAll('[data-testid^="grade-2022"]').length).toBe(1)
      vi.doUnmock('@/services/classOptions')
    })
  })
})
