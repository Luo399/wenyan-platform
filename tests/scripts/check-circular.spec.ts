/**
 * `scripts/check-circular.mjs` 的门禁有效性测试。
 *
 * 存在的理由：2026-10-30 查出来的事实是——CI 里的 circular-check 用
 * `circular-dependency-scanner`，**不加 `-t` 时发现环也 exit 0**（实测：夹具里
 * 放一个环，不带 `-t` 退出码 0、带 `-t` 退出码 1），而且它只认根 `tsconfig.json`
 * 里的 paths，本仓根 tsconfig.json 是 `{files: [], references: [...]}` 的
 * solution 形态、别名定义在 `tsconfig.app.json`，所以 262 条 `@/` 边它一条都看不见。
 * 也就是说旧门禁既不会红、也看不见本项目的主要引入方式。
 *
 * 所以这里测的重点不是「能不能画图」，而是三件门禁必须具备的性质：
 *   1. 有环必红（含 `@/` 别名环和后端 `require` 环）；
 *   2. 懒加载不误伤（动态 `import()` 不构成加载期环）；
 *   3. 图不完整时不许假绿（解析不到的本仓引入直接失败）。
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const CHECKER = path.join(REPO_ROOT, 'scripts', 'check-circular.mjs')

let fixtureRoot: string

/** 每个用例一套独立夹具：把被测脚本原样复制进 <夹具>/scripts，PROJECT_ROOT 就是夹具根 */
function makeFixture(name: string, files: Record<string, string>) {
  const root = path.join(fixtureRoot, name)
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true })
  fs.copyFileSync(CHECKER, path.join(root, 'scripts', 'check-circular.mjs'))
  fs.writeFileSync(
    path.join(root, 'tsconfig.app.json'),
    JSON.stringify({ compilerOptions: { paths: { '@/*': ['./src/*'] } } }, null, 2),
  )
  for (const [relPath, content] of Object.entries(files)) {
    const target = path.join(root, relPath)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, content)
  }
  return root
}

/** 用 spawnSync：成功与失败都要能同时拿到 stdout 与 stderr（有些判定只写在 stderr 上） */
function runChecker(root: string, args: string[]) {
  const result = spawnSync(
    process.execPath,
    [path.join(root, 'scripts', 'check-circular.mjs'), ...args],
    {
      cwd: root,
      encoding: 'utf8',
    },
  )
  return { code: result.status ?? -1, output: `${result.stdout ?? ''}${result.stderr ?? ''}` }
}

beforeAll(() => {
  fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'check-circular-'))
})

afterAll(() => {
  fs.rmSync(fixtureRoot, { recursive: true, force: true })
})

describe('check-circular 的环检测', () => {
  it('能发现 @/ 别名构成的加载期环（旧扫描器看不见的那一类）', () => {
    const root = makeFixture('alias-cycle', {
      'src/utils/api.ts':
        "import { useAuthStore } from '@/stores/auth'\nexport const t = () => useAuthStore()\n",
      'src/stores/auth.ts':
        "import { t } from '@/utils/api'\nexport const useAuthStore = () => ({ x: t() })\n",
    })
    const result = runChecker(root, ['src', '--min-modules', '1'])
    expect(result.code).toBe(1)
    expect(result.output).toContain('循环依赖')
    expect(result.output).toContain('src/utils/api.ts')
    expect(result.output).toContain('src/stores/auth.ts')
  })

  it('能发现 CommonJS require 构成的环', () => {
    const root = makeFixture('require-cycle', {
      'src/a.js': "const b = require('./b')\nmodule.exports = { b }\n",
      'src/b.js': "const a = require('./a')\nmodule.exports = { a }\n",
    })
    const result = runChecker(root, ['src', '--min-modules', '1'])
    expect(result.code).toBe(1)
    expect(result.output).toContain('src/a.js')
    expect(result.output).toContain('src/b.js')
  })

  it('注释里的假引入不算边', () => {
    const root = makeFixture('comment-only', {
      'src/real.ts': 'export const a = 1\n',
      'src/fake.ts':
        "// import { a } from './real'\n/* import { a } from './real' */\nexport const b = a\n",
    })
    const result = runChecker(root, ['src', '--min-modules', '1'])
    expect(result.code).toBe(0)
    expect(result.output).toContain('静态边 0 条')
  })

  it('动态 import() 不构成环：路由懒加载不会误伤', () => {
    const root = makeFixture('lazy-ok', {
      'src/router.ts':
        "const view = () => import('@/views/HomeView.vue')\nexport const routes = [{ component: view }]\n",
      'src/views/HomeView.vue':
        '<script setup lang="ts">\nimport { routes } from \'@/router\'\n</script>\n<template><div /></template>\n',
    })
    const result = runChecker(root, ['src', '--min-modules', '1'])
    expect(result.output).toContain('动态 import() 1 条')
    expect(result.code).toBe(0)
  })

  it('静态边加动态边真的成环时仍然红', () => {
    const root = makeFixture('lazy-plus-static', {
      'src/router.ts':
        "import { title } from '@/views/HomeView.vue'\nconst v = () => import('@/views/Other.vue')\nexport const r = [title, v]\n",
      'src/views/HomeView.vue':
        "<script setup lang=\"ts\">\nimport { r } from '@/router'\nconst o = () => import('@/views/Other.vue')\n</script>\n<template><div>{{ r }}{{ o }}</div></template>\n",
      'src/views/Other.vue':
        '<script setup lang="ts">\nconst x = 1\n</script>\n<template><div>{{ x }}</div></template>\n',
    })
    const result = runChecker(root, ['src', '--min-modules', '1'])
    expect(result.code).toBe(1)
  })

  it('解析不到的本仓引入判为图不完整，不给假绿', () => {
    const root = makeFixture('unresolved', {
      'src/entry.ts': "import { x } from './nope'\nexport const y = x\n",
    })
    const result = runChecker(root, ['src', '--min-modules', '1'])
    expect(result.code).toBe(1)
    expect(result.output).toContain('解析不到文件')
  })

  it('资源与 Vite query 后缀不误报成解析失败', () => {
    const root = makeFixture('assets-ok', {
      'src/entry.ts':
        "import './styles/main.css'\nimport icon from '@/assets/logo.svg'\nimport raw from '@/views/HomeView.vue?raw'\nexport const i = icon + raw\n",
      'src/styles/main.css': 'body { margin: 0 }\n',
      'src/assets/logo.svg': '<svg xmlns="http://www.w3.org/2000/svg" />\n',
      'src/views/HomeView.vue': '<template><div /></template>\n',
    })
    const result = runChecker(root, ['src', '--min-modules', '1'])
    expect(result.code).toBe(0)
  })

  it('tsconfig 里没有 paths 时退回默认别名并打警告，不是静默失效', () => {
    const root = makeFixture('no-paths', {
      'tsconfig.app.json': JSON.stringify({ compilerOptions: {} }),
      'src/a.ts': "import { b } from '@/b'\nexport const a = b\n",
      'src/b.ts': 'export const b = 1\n',
    })
    const result = runChecker(root, ['src', '--min-modules', '1'])
    expect(result.code).toBe(0)
    expect(result.output).toContain('没有 compilerOptions.paths')
    expect(result.output).toContain('别名边 1 条')
  })

  it('模块数低于下限时判为图不完整（防止扫描器静默失效）', () => {
    const root = makeFixture('too-few', {
      'src/only.ts': 'export const a = 1\n',
    })
    const result = runChecker(root, ['src', '--min-modules', '10'])
    expect(result.code).toBe(1)
    expect(result.output).toContain('下限 10')
  })
})

describe('check-circular 对本仓的实测', () => {
  it('src 与 backend/src 当前都没有加载期环（有环就是这条先红）', () => {
    // 别名解析一旦坏掉，脚本自己会以「解析不到文件」红掉，所以这里不需要对模块数做脆断言。
    const result = runChecker(REPO_ROOT, ['src', 'backend/src'])
    expect(result.code).toBe(0)
    expect(result.output).toContain('OK 无加载期循环依赖')
  })
})
