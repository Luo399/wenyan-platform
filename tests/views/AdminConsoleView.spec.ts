import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'

// vi.mock 会被提升到文件顶部，mock 句柄必须用 hoisted 持有
const mocks = vi.hoisted(() => ({
  listTeachers: vi.fn(),
  createTeacher: vi.fn(),
  updateTeacher: vi.fn(),
  deleteTeacher: vi.fn(),
  approveTeacher: vi.fn(),
  rejectTeacher: vi.fn(),
  resetTeacherPassword: vi.fn(),
  listStudents: vi.fn(),
  createStudent: vi.fn(),
  updateStudent: vi.fn(),
  deleteStudent: vi.fn(),
  resetStudentPassword: vi.fn(),
}))

vi.mock('@/services/adminService', () => mocks)
vi.mock('@/utils/debug', () => ({ debugError: vi.fn() }))

// ClassPicker 依赖年级/班级数据，这里只保留 v-model 契约，避免测试被组件内部实现绑死
vi.mock('@/components/ClassPicker.vue', () => ({
  default: {
    name: 'ClassPicker',
    props: {
      modelValue: { type: Array, default: () => [] },
      fullAccess: { type: Boolean, default: false },
    },
    emits: ['update:modelValue', 'update:full-access'],
    template: '<div class="class-picker-stub"></div>',
  },
}))

import AdminConsoleView from '@/views/AdminConsoleView.vue'

const TEACHERS = [
  {
    id: 1,
    phone: 'a001',
    name: '张老师',
    school_id: 1,
    status: 'active' as const,
    class_codes: ['202501'],
    can_view_all: 0,
  },
  {
    id: 2,
    phone: 'a002',
    name: '李老师',
    school_id: 1,
    status: 'pending' as const,
    class_codes: [],
    can_view_all: 1,
  },
]

const STUDENTS = [
  { id: 1, student_id: '20250101', student_name: '王五', class_code: '202501', school_id: 1 },
  { id: 2, student_id: '20250102', student_name: '赵六', class_code: '202501', school_id: 1 },
]

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/admin-dashboard', component: { template: '<div />' } },
    ],
  })
}

async function mountView(): Promise<VueWrapper> {
  const router = createTestRouter()
  await router.push('/')
  const wrapper = mount(AdminConsoleView, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

/** 教师表固定是第 1 张表，学生表是第 2 张表（v-show 同时挂载） */
function tableRows(wrapper: VueWrapper, index: 0 | 1) {
  return wrapper.findAll('.data-table')[index].findAll('tbody tr')
}

function findRow(wrapper: VueWrapper, index: 0 | 1, keyword: string) {
  return tableRows(wrapper, index).find((row) => row.text().includes(keyword))
}

function teacherInputs(wrapper: VueWrapper) {
  return wrapper.findAll('.edit-form')[0].findAll('input')
}

function studentInputs(wrapper: VueWrapper) {
  return wrapper.findAll('.edit-form')[1].findAll('input')
}

async function fillTeacherForm(wrapper: VueWrapper, phone: string, name: string, password: string) {
  const inputs = teacherInputs(wrapper)
  await inputs[0].setValue(phone)
  await inputs[1].setValue(name)
  await inputs[2].setValue(password)
}

function classPicker(wrapper: VueWrapper) {
  return wrapper.findComponent({ name: 'ClassPicker' })
}

describe('AdminConsoleView.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.listTeachers.mockResolvedValue(TEACHERS)
    mocks.listStudents.mockResolvedValue(STUDENTS)
    mocks.createTeacher.mockResolvedValue({ success: true, message: '教师账号创建成功' })
    mocks.updateTeacher.mockResolvedValue({ success: true, message: '教师账号已更新' })
    mocks.deleteTeacher.mockResolvedValue({ success: true, message: '教师账号已删除' })
    mocks.approveTeacher.mockResolvedValue({ success: true, message: '教师已审批通过' })
    mocks.rejectTeacher.mockResolvedValue({ success: true, message: '教师注册已驳回' })
    mocks.resetTeacherPassword.mockResolvedValue({
      success: true,
      message: '教师密码已重置',
      data: { temporary_password: 'TempT-123' },
    })
    mocks.createStudent.mockResolvedValue({ success: true, message: '学生账号创建成功' })
    mocks.updateStudent.mockResolvedValue({ success: true, message: '学生信息已更新' })
    mocks.deleteStudent.mockResolvedValue({ success: true, message: '学生账号已删除' })
    mocks.resetStudentPassword.mockResolvedValue({
      success: true,
      message: '密码已重置，一次性临时口令：TempS-456（仅本次显示）',
      data: { temporary_password: 'TempS-456' },
    })
  })

  it('挂载时同时加载教师与学生列表，默认停留在教师标签', async () => {
    const wrapper = await mountView()

    expect(mocks.listTeachers).toHaveBeenCalledTimes(1)
    expect(mocks.listStudents).toHaveBeenCalledTimes(1)
    expect(wrapper.find('.tab-btn.active').text()).toBe('教师账号')
  })

  it('渲染教师列表：班级、状态与全年级徽标', async () => {
    const wrapper = await mountView()

    expect(tableRows(wrapper, 0)).toHaveLength(2)
    const activeRow = findRow(wrapper, 0, 'a001')
    expect(activeRow?.text()).toContain('202501')
    expect(activeRow?.text()).toContain('启用')

    const pendingRow = findRow(wrapper, 0, 'a002')
    expect(pendingRow?.find('.full-badge').text()).toBe('全年级')
    expect(pendingRow?.text()).toContain('待审批')
  })

  it('待审批教师显示审批/驳回入口，审批通过后刷新列表', async () => {
    const wrapper = await mountView()
    const pendingRow = findRow(wrapper, 0, 'a002')

    await pendingRow?.find('.link-btn.primary').trigger('click')
    await flushPromises()

    expect(mocks.approveTeacher).toHaveBeenCalledWith('a002')
    expect(mocks.listTeachers).toHaveBeenCalledTimes(2)
  })

  it('驳回教师需要二次确认：取消不调用，确认才调用', async () => {
    const wrapper = await mountView()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    await findRow(wrapper, 0, 'a002')?.find('.link-btn.danger').trigger('click')
    await flushPromises()
    expect(mocks.rejectTeacher).not.toHaveBeenCalled()

    confirmSpy.mockReturnValue(true)
    await findRow(wrapper, 0, 'a002')?.find('.link-btn.danger').trigger('click')
    await flushPromises()
    expect(mocks.rejectTeacher).toHaveBeenCalledWith('a002')
  })

  it('新增教师缺少手机号/姓名时拦截提交', async () => {
    const wrapper = await mountView()

    await wrapper.findAll('.edit-form')[0].trigger('submit')
    await flushPromises()

    expect(mocks.createTeacher).not.toHaveBeenCalled()
    expect(wrapper.find('.toast.error').text()).toContain('请填写手机号与姓名')
  })

  it('新增教师必须选择班级或开启全年级权限', async () => {
    const wrapper = await mountView()
    await fillTeacherForm(wrapper, 'a003', '王老师', 'abc123')

    await wrapper.findAll('.edit-form')[0].trigger('submit')
    await flushPromises()
    expect(mocks.createTeacher).not.toHaveBeenCalled()
    expect(wrapper.find('.toast.error').text()).toContain('请至少选择一个所教班级')

    classPicker(wrapper).vm.$emit('update:modelValue', ['202502'])
    await flushPromises()
    await wrapper.findAll('.edit-form')[0].trigger('submit')
    await flushPromises()

    expect(mocks.createTeacher).toHaveBeenCalledWith({
      phone: 'a003',
      name: '王老师',
      password: 'abc123',
      school_id: 1,
      class_codes: ['202502'],
      can_view_all: false,
    })
  })

  it('新增教师密码少于 6 位时拦截提交', async () => {
    const wrapper = await mountView()
    await fillTeacherForm(wrapper, 'a004', '赵老师', '123')
    classPicker(wrapper).vm.$emit('update:modelValue', ['202502'])
    await flushPromises()

    await wrapper.findAll('.edit-form')[0].trigger('submit')
    await flushPromises()

    expect(mocks.createTeacher).not.toHaveBeenCalled()
    expect(wrapper.find('.toast.error').text()).toContain('密码不能少于 6 位')
  })

  it('点击修改进入编辑态：回填字段并禁用手机号输入', async () => {
    const wrapper = await mountView()
    await findRow(wrapper, 0, 'a001')?.findAll('.link-btn')[0].trigger('click')
    await flushPromises()

    expect(wrapper.findAll('.edit-form')[0].find('h2').text()).toBe('修改教师账号')
    expect(teacherInputs(wrapper)[0].element.disabled).toBe(true)
    expect(teacherInputs(wrapper)[1].element.value).toBe('张老师')
  })

  it('编辑教师提交调用 updateTeacher 并带上状态', async () => {
    const wrapper = await mountView()
    await findRow(wrapper, 0, 'a001')?.findAll('.link-btn')[0].trigger('click')
    await flushPromises()

    await teacherInputs(wrapper)[1].setValue('张老师改')
    await wrapper.findAll('.edit-form')[0].trigger('submit')
    await flushPromises()

    expect(mocks.updateTeacher).toHaveBeenCalledWith('a001', {
      name: '张老师改',
      school_id: 1,
      class_codes: ['202501'],
      can_view_all: false,
      status: 'active',
    })
  })

  it('删除教师需要确认，确认后调用接口并刷新', async () => {
    const wrapper = await mountView()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const deleteBtn = findRow(wrapper, 0, 'a001')?.findAll('.link-btn')[2]

    await deleteBtn?.trigger('click')
    await flushPromises()

    expect(mocks.deleteTeacher).toHaveBeenCalledWith('a001')
    expect(mocks.listTeachers).toHaveBeenCalledTimes(2)
  })

  it('删除教师取消确认时不调用接口', async () => {
    const wrapper = await mountView()
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    await findRow(wrapper, 0, 'a001')?.findAll('.link-btn')[2].trigger('click')
    await flushPromises()

    expect(mocks.deleteTeacher).not.toHaveBeenCalled()
  })

  it('重置教师密码后展示一次性临时口令', async () => {
    const wrapper = await mountView()

    await findRow(wrapper, 0, 'a001')?.findAll('.link-btn')[1].trigger('click')
    await flushPromises()

    expect(mocks.resetTeacherPassword).toHaveBeenCalledWith('a001')
    expect(wrapper.find('.toast').text()).toContain('TempT-123')
  })

  it('切换到学生标签会重新拉取学生列表并渲染行', async () => {
    const wrapper = await mountView()

    await wrapper.findAll('.tab-btn')[1].trigger('click')
    await flushPromises()

    expect(mocks.listStudents).toHaveBeenCalledTimes(2)
    expect(tableRows(wrapper, 1)).toHaveLength(2)
    expect(wrapper.text()).toContain('20250102')
  })

  it('新增学生提交调用 createStudent', async () => {
    const wrapper = await mountView()
    const inputs = studentInputs(wrapper)
    await inputs[0].setValue('20250202')
    await inputs[1].setValue('孙七')

    await wrapper.findAll('.edit-form')[1].trigger('submit')
    await flushPromises()

    expect(mocks.createStudent).toHaveBeenCalledWith({
      student_id: '20250202',
      student_name: '孙七',
      class_code: undefined,
    })
  })

  it('编辑学生提交调用 updateStudent', async () => {
    const wrapper = await mountView()
    await findRow(wrapper, 1, '20250101')?.findAll('.link-btn')[0].trigger('click')
    await flushPromises()

    await studentInputs(wrapper)[1].setValue('王五改')
    await wrapper.findAll('.edit-form')[1].trigger('submit')
    await flushPromises()

    expect(mocks.updateStudent).toHaveBeenCalledWith('20250101', {
      student_name: '王五改',
      class_code: '202501',
    })
  })

  it('删除学生会先确认再调用接口', async () => {
    const wrapper = await mountView()
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    await findRow(wrapper, 1, '20250102')?.findAll('.link-btn')[2].trigger('click')
    await flushPromises()

    expect(mocks.deleteStudent).toHaveBeenCalledWith('20250102')
  })

  it('重置学生密码走独立接口并展示提示', async () => {
    const wrapper = await mountView()

    await findRow(wrapper, 1, '20250101')?.findAll('.link-btn')[1].trigger('click')
    await flushPromises()

    expect(mocks.resetStudentPassword).toHaveBeenCalledWith('20250101')
    expect(wrapper.find('.toast').text()).toContain('TempS-456')
  })

  it('列表加载失败时展示错误提示而不是静默空表', async () => {
    mocks.listTeachers.mockRejectedValue(new Error('教师列表加载失败，请重试'))
    const wrapper = await mountView()

    expect(wrapper.find('.toast.error').text()).toContain('教师列表加载失败，请重试')
  })
})
