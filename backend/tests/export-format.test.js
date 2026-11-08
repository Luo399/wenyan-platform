/**
 * 导出接口输出格式测试（CSV）
 *
 * 背景：原实现用 xlsx@0.18.5 生成 .xlsx，该版本在 npm 上无修复版（原型污染 / ReDoS），
 * 而导出内容正是学生姓名与答案。改为手写 CSV：
 * - UTF-8 BOM（Excel 打开不乱码）
 * - RFC 4180 转义（逗号/引号/换行）
 * - 多表导出用 sheet 列 + 空行分隔，保持「一次请求一个文件」
 */

const request = require('supertest')

process.env.DB_PATH = ':memory:'
process.env.JWT_SECRET = 'ci-test-secret'
process.env.TEST_MODE = 'true'
process.env.DASHBOARD_PASSWORD = 'dash-test-secret'
process.env.RATE_LIMIT_GLOBAL = '100000'

let app

/** 最小 RFC 4180 单行解析器：只用于验证导出行能否无歧义读回 */
function parseCsvLine(line) {
  const cells = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        current += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      cells.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  cells.push(current)
  return cells
}

const auth = (agent) => agent.set('Authorization', `Bearer ${process.env.DASHBOARD_PASSWORD}`)

beforeAll(async () => {
  const { initAllTables } = require('../src/config/database')
  await initAllTables()

  const { dbRun } = require('../src/utils/dbPromise')
  const { db } = require('../src/config/database')

  // 埋点表没有外键，直接插一条带逗号的 properties，验证转义
  await dbRun(
    db,
    `INSERT INTO tracking_events
      (user_id, session_id, event_type, step_id, properties, page_url, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      '20240101',
      'sess,csv',
      'step_enter',
      'step1',
      JSON.stringify({ note: 'hello, "world"' }),
      '/detail/WEN_01',
      '2026-10-01T08:00:00.000Z',
    ],
  )

  const { createApp } = require('../src/app')
  app = createApp()
})

describe('exportController CSV 单元行为', () => {
  const { escapeCsvCell, toCsv } = require('../src/controllers/exportController')

  it('普通值原样输出', () => {
    expect(escapeCsvCell('abc')).toBe('abc')
    expect(escapeCsvCell(123)).toBe('123')
  })

  it('null/undefined 输出空串（不出现字面量 null）', () => {
    expect(escapeCsvCell(null)).toBe('')
    expect(escapeCsvCell(undefined)).toBe('')
  })

  it('含逗号/引号/换行的值整体加引号，内部引号翻倍', () => {
    expect(escapeCsvCell('a,b')).toBe('"a,b"')
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""')
    expect(escapeCsvCell('line1\nline2')).toBe('"line1\nline2"')
  })

  it('toCsv 首行是表头，行序与 headers 对齐', () => {
    const csv = toCsv(['a', 'b'], [{ a: 1, b: 2 }, { a: 3, b: 4 }])
    expect(csv).toBe('a,b\r\n1,2\r\n3,4')
  })
})

describe('GET /api/export/tracking-events', () => {
  it('返回 text/csv，带 BOM 与表头', async () => {
    const res = await auth(request(app).get('/api/export/tracking-events'))

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/^text\/csv/)
    expect(res.headers['content-disposition']).toContain('.csv')

    const text = res.text
    expect(text.charCodeAt(0)).toBe(0xfeff)

    const lines = text.slice(1).split('\r\n')
    expect(lines[0]).toBe('id,user_id,session_id,event_type,step_id,properties,page_url,timestamp')
  })

  it('含逗号/引号的 field 被正确引用：按 RFC 4180 解析后列数不变', async () => {
    const res = await auth(request(app).get('/api/export/tracking-events'))
    const body = res.text.slice(1)

    const lines = body.split('\r\n')
    const header = lines[0].split(',')
    const row = parseCsvLine(lines[1])

    expect(header).toHaveLength(8)
    expect(row).toHaveLength(8)
    expect(row[2]).toBe('sess,csv')
    expect(row[5]).toBe(JSON.stringify({ note: 'hello, "world"' }))
  })

  it('未配置 DASHBOARD_PASSWORD 时 fail-closed → 503，不匿名放行', async () => {
    const saved = process.env.DASHBOARD_PASSWORD
    delete process.env.DASHBOARD_PASSWORD
    try {
      const res = await request(app).get('/api/export/answers')
      expect(res.status).toBe(503)
      expect(res.body.error).toBe('DASHBOARD_AUTH_NOT_CONFIGURED')
    } finally {
      process.env.DASHBOARD_PASSWORD = saved
    }
  })
})

describe('GET /api/export/dashboard-summary', () => {
  it('多表导出合并为一个 CSV：每块带 sheet 列，块间空行', async () => {
    const res = await auth(request(app).get('/api/export/dashboard-summary'))

    expect(res.status).toBe(200)
    const body = res.text.slice(1)

    expect(body).toContain('sheet,step_id,enter_count')
    expect(body).toContain('sheet,module_type,action,count')
    expect(body).toContain('sheet,step_id,word,query_count')
    expect(body).toContain('sheet,step_id,score,count')

    // 4 个块之间用空行分隔 → 连续两个 \r\n
    expect(body).toContain('\r\n\r\nsheet,')
  })
})
