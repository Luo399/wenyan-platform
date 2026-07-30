/**
 * authService 纯函数单元测试（不依赖真实数据库连接）
 *
 * 覆盖：
 *  1. DEFAULT_STUDENT_PASSWORD 常量
 *  2. extractClassCode：从学号截取前 6 位班级编码
 *  3. generateTemporaryPassword：生成指定长度的随机密码
 *  4. hashPassword + verifyPassword：bcrypt 哈希与校验正确性
 *  5. 默认密码 "123456" 经哈希后能通过 verifyPassword
 */

// 必须在 require database 之前设置，使用内存数据库避免污染工作区
process.env.DB_PATH = ':memory:'

const { z } = require('zod')
const {
  DEFAULT_STUDENT_PASSWORD,
  BCRYPT_ROUNDS,
  extractClassCode,
  generateTemporaryPassword,
  hashPassword,
  verifyPassword,
  getDefaultPasswordHash,
} = require('../src/services/authService')

describe('authService 常量', () => {
  test('默认学生初始密码应为 123456', () => {
    expect(DEFAULT_STUDENT_PASSWORD).toBe('123456')
  })
  test('BCRYPT_ROUNDS 为合法整数', () => {
    expect(Number.isInteger(BCRYPT_ROUNDS)).toBe(true)
    expect(BCRYPT_ROUNDS).toBeGreaterThanOrEqual(8)
    expect(BCRYPT_ROUNDS).toBeLessThanOrEqual(14)
  })
})

describe('extractClassCode 班级编码提取', () => {
  test('推荐 8 位学号：前 6 位为班级编码', () => {
    expect(extractClassCode('20240901')).toBe('202409')
    expect(extractClassCode('20230131')).toBe('202301')
    expect(extractClassCode('20241299')).toBe('202412')
  })
  test('恰好 6 位学号（班内序号为 0 位）：返回全部 6 位', () => {
    expect(extractClassCode('202409')).toBe('202409')
  })
  test('长度不足 6 位返回 null', () => {
    expect(extractClassCode('123')).toBeNull()
    expect(extractClassCode('12345')).toBeNull()
    expect(extractClassCode('')).toBeNull()
    expect(extractClassCode(null)).toBeNull()
    expect(extractClassCode(undefined)).toBeNull()
  })
  test('非字符串类型返回 null', () => {
    expect(extractClassCode(20240901)).toBeNull()
    expect(extractClassCode({})).toBeNull()
    expect(extractClassCode([])).toBeNull()
  })
  test('字母开头的学号：按字符串截取不做格式校验（格式由 Zod schema 负责）', () => {
    expect(extractClassCode('ABCDEF01')).toBe('ABCDEF')
  })
})

describe('generateTemporaryPassword 随机临时密码', () => {
  test('默认长度 10', () => {
    const p = generateTemporaryPassword()
    expect(typeof p).toBe('string')
    expect(p).toHaveLength(10)
  })
  test('可自定义长度', () => {
    expect(generateTemporaryPassword(6)).toHaveLength(6)
    expect(generateTemporaryPassword(20)).toHaveLength(20)
  })
  test('每次生成内容不相同（极大概率）', () => {
    const a = generateTemporaryPassword(16)
    const b = generateTemporaryPassword(16)
    expect(a).not.toBe(b)
  })
  test('不包含易混字符：0 O 1 l', () => {
    for (let i = 0; i < 20; i++) {
      const p = generateTemporaryPassword(32)
      expect(p).not.toMatch(/[0O1l]/)
    }
  })
})

describe('bcrypt 密码哈希与校验', () => {
  test('hashPassword 返回值为 bcrypt 格式字符串（以 $2a$ 或 $2b$ 开头）', async () => {
    const hash = await hashPassword('mypassword123')
    expect(hash).toMatch(/^\$2[ab]\$/)
    expect(hash.length).toBeGreaterThan(50)
  })

  test('verifyPassword：正确密码匹配，错误密码不匹配', async () => {
    const pass = 'FooBar@2026!'
    const hash = await hashPassword(pass)
    await expect(verifyPassword(pass, hash)).resolves.toBe(true)
    await expect(verifyPassword('otherpassword', hash)).resolves.toBe(false)
    await expect(verifyPassword('', hash)).resolves.toBe(false)
    await expect(verifyPassword(null, null)).resolves.toBe(false)
  })

  test('默认学生密码 123456 经哈希后能正确校验', async () => {
    const h = await getDefaultPasswordHash()
    await expect(verifyPassword('123456', h)).resolves.toBe(true)
    await expect(verifyPassword('12345', h)).resolves.toBe(false)
  })
})

// 顺带测 authController 内定义的 Zod schema：直接重新声明与 controller 中一致
describe('Zod schema 输入校验（与 authController 中声明保持一致）', () => {
  const studentLoginSchema = z.object({
    student_id: z.string().regex(/^\d+$/, '学号必须为纯数字').min(4, '学号长度不能少于 4 位'),
    password: z.string().min(1, '密码必填'),
  })

  const teacherRegisterSchema = z.object({
    phone: z.string().regex(/^1[3-9]\d{9}$/, '手机号格式不正确'),
    name: z.string().min(1, '姓名必填').max(20, '姓名长度不能超过 20'),
    school_id: z.number().int().positive('请选择学校'),
    password: z.string().min(6, '密码长度不能少于 6 位'),
    class_codes: z
      .array(z.string().regex(/^\d{6}$/, '班级编码必须为 6 位数字'))
      .min(1, '至少选择一个所教班级'),
  })

  test('学生登录：合法 8 位学号 + 密码 => 通过', () => {
    const v = studentLoginSchema.parse({ student_id: '20240901', password: '123456' })
    expect(v.student_id).toBe('20240901')
  })
  test('学生登录：学号含字母 => 失败', () => {
    expect(() =>
      studentLoginSchema.parse({ student_id: '202409ab', password: '123456' }),
    ).toThrow(z.ZodError)
  })
  test('学生登录：学号长度 <4 => 失败', () => {
    expect(() =>
      studentLoginSchema.parse({ student_id: '123', password: '123456' }),
    ).toThrow(z.ZodError)
  })

  test('教师注册：完整合法输入 => 通过', () => {
    const v = teacherRegisterSchema.parse({
      phone: '13812345678',
      name: '张老师',
      school_id: 1,
      password: 'teacher@123',
      class_codes: ['202409', '202410'],
    })
    expect(v.phone).toBe('13812345678')
    expect(v.class_codes).toEqual(['202409', '202410'])
  })
  test('教师注册：班级编码 5 位 => 失败', () => {
    expect(() =>
      teacherRegisterSchema.parse({
        phone: '13812345678',
        name: '张老师',
        school_id: 1,
        password: 'teacher@123',
        class_codes: ['20240'],
      }),
    ).toThrow(z.ZodError)
  })
  test('教师注册：class_codes 空数组 => 失败', () => {
    expect(() =>
      teacherRegisterSchema.parse({
        phone: '13812345678',
        name: '张老师',
        school_id: 1,
        password: 'teacher@123',
        class_codes: [],
      }),
    ).toThrow(z.ZodError)
  })
  test('教师注册：手机号前缀不合法（11 开头） => 失败', () => {
    expect(() =>
      teacherRegisterSchema.parse({
        phone: '11912345678',
        name: '张老师',
        school_id: 1,
        password: 'teacher@123',
        class_codes: ['202409'],
      }),
    ).toThrow(z.ZodError)
  })
})

describe('教师班级权限校验规则（纯逻辑规则，不连 DB）', () => {
  /**
   * 规则：
   *   1. 教师所教班级编码集合记为 S
   *   2. 待添加学生 student_id 的前 6 位 classCode
   *   3. classCode ∈ S 才能添加
   */
  function canAdd(teacherClasses, studentId) {
    const cc = extractClassCode(String(studentId || ''))
    if (!cc) return { ok: false, reason: 'INVALID_STUDENT_ID' }
    if (!teacherClasses.includes(cc)) {
      return { ok: false, reason: 'CLASS_NOT_ALLOWED' }
    }
    return { ok: true }
  }

  test('仅教 202409 的老师可加 202409xx，不可加 202301xx', () => {
    expect(canAdd(['202409'], '20240901').ok).toBe(true)
    expect(canAdd(['202409'], '20240999').ok).toBe(true)
    expect(canAdd(['202409'], '20230101').ok).toBe(false)
    expect(canAdd(['202409'], '20230101').reason).toBe('CLASS_NOT_ALLOWED')
  })

  test('多班级老师可以加多个班级学生', () => {
    const classes = ['202409', '202412', '202301']
    expect(canAdd(classes, '20240901').ok).toBe(true)
    expect(canAdd(classes, '20241201').ok).toBe(true)
    expect(canAdd(classes, '20230131').ok).toBe(true)
    expect(canAdd(classes, '20220101').ok).toBe(false)
  })

  test('学号不足 6 位无法通过权限前置检查', () => {
    expect(canAdd(['202409'], '123').ok).toBe(false)
    expect(canAdd(['202409'], '123').reason).toBe('INVALID_STUDENT_ID')
  })
})
