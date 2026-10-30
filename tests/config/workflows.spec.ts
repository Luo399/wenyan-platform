import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from 'yaml'

/**
 * 工作流护栏。
 *
 * 依赖升级（尤其是 GitHub Actions 大版本）不能只看 YAML 有没有改错字：
 * - action 必须用版本 tag，不能跟 main/branch；
 * - 升级后的主版本要在此处显式登记，防止回退；
 * - setup-node / setup-python / login-action / ssh-agent / create-pull-request
 *   的关键输入必须仍在，否则动作会在运行时才失败；
 * - CI 的关键门禁步骤（coverage、backend test、figma test、code.js 同步）不能被误删。
 */

interface WorkflowStep {
  name?: string
  uses?: string
  run?: string
  with?: Record<string, unknown>
}

interface WorkflowJob {
  steps?: WorkflowStep[]
}

interface WorkflowDoc {
  on?: unknown
  jobs?: Record<string, WorkflowJob>
}

const WORKFLOW_DIR = resolve(process.cwd(), '.github/workflows')

const EXPECTED_ACTIONS: Record<string, string> = {
  'actions/checkout': 'v4',
  'actions/setup-node': 'v7',
  'actions/setup-python': 'v7',
  'gitleaks/gitleaks-action': 'v2',
  'docker/setup-buildx-action': 'v3',
  'docker/login-action': 'v4',
  'docker/build-push-action': 'v5',
  'webfactory/ssh-agent': 'v0.10.0',
  'peter-evans/create-pull-request': 'v8',
}

function loadWorkflows(): Record<string, WorkflowDoc> {
  const files = readdirSync(WORKFLOW_DIR)
    .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
    .sort()
  return Object.fromEntries(
    files.map((name) => [
      name,
      parse(readFileSync(resolve(WORKFLOW_DIR, name), 'utf8')) as WorkflowDoc,
    ]),
  )
}

function steps(workflow: WorkflowDoc): WorkflowStep[] {
  return Object.values(workflow.jobs ?? {}).flatMap((job) => job.steps ?? [])
}

function findStep(workflow: WorkflowDoc, action: string): WorkflowStep[] {
  return steps(workflow).filter((step) => step.uses?.split('@')[0] === action)
}

describe('GitHub Actions 工作流护栏', () => {
  const workflows = loadWorkflows()

  it('全部工作流都能解析，且 action 使用版本 tag、版本不低于登记值', () => {
    expect(Object.keys(workflows)).toHaveLength(6)

    for (const [file, workflow] of Object.entries(workflows)) {
      expect(workflow.jobs, `${file} 缺少 jobs`).toBeTruthy()

      for (const step of steps(workflow)) {
        if (!step.uses) continue
        const [action = '', ref = ''] = step.uses.split('@')
        expect(ref, `${file} 的 ${action} 必须使用版本 tag，不能引用分支`).toMatch(
          /^v?\d+(\.\d+)*$/,
        )
        expect(EXPECTED_ACTIONS[action], `${file} 引入了未登记版本的 action: ${step.uses}`).toBe(
          ref,
        )
      }
    }
  })

  it('setup-node 统一读取 .nvmrc，Node 主版本不低于 22（vitest 5 要求）', () => {
    const nvmrc = readFileSync(resolve(process.cwd(), '.nvmrc'), 'utf8').trim()
    expect(Number.parseInt(nvmrc, 10)).toBeGreaterThanOrEqual(22)

    const setupNodeSteps = Object.values(workflows).flatMap((workflow) =>
      findStep(workflow, 'actions/setup-node'),
    )
    expect(setupNodeSteps.length).toBeGreaterThanOrEqual(4)
    for (const step of setupNodeSteps) {
      expect(step.with?.['node-version-file']).toBe('.nvmrc')
    }
  })

  it('setup-python 仍用 3.11 + pip 缓存', () => {
    const [step] = findStep(workflows['ci-checks.yml'] ?? {}, 'actions/setup-python')
    expect(step?.with?.['python-version']).toBe('3.11')
    expect(step?.with?.cache).toBe('pip')
    expect(step?.with?.['cache-dependency-path']).toBe('data-pipeline/python/pyproject.toml')
  })

  it('部署工作流的登录、SSH 与自动 PR 输入保持完整', () => {
    const login = findStep(workflows['deploy-backend-test.yml'] ?? {}, 'docker/login-action')
    expect(login).toHaveLength(1)
    expect(login[0].with).toMatchObject({
      registry: expect.any(String),
      username: expect.any(String),
      password: expect.any(String),
    })

    const sshSteps = [
      ...findStep(workflows['deploy-backend.yml'] ?? {}, 'webfactory/ssh-agent'),
      ...findStep(workflows['deploy-backend-test.yml'] ?? {}, 'webfactory/ssh-agent'),
    ]
    expect(sshSteps).toHaveLength(2)
    for (const step of sshSteps) {
      expect(step.with?.['ssh-private-key']).toBeTruthy()
    }

    const [createPr] = findStep(
      workflows['sync-figma-plugin.yml'] ?? {},
      'peter-evans/create-pull-request',
    )
    expect(createPr?.with).toMatchObject({
      token: expect.any(String),
      branch: expect.any(String),
      base: 'main',
      'delete-branch': true,
    })
  })

  it('CI 关键门禁步骤没有被误删', () => {
    const ci = workflows['ci-checks.yml'] ?? {}
    const runs = steps(ci).map((step) => step.run ?? '')

    expect(runs).toContain('npm run test:coverage')
    expect(runs.some((run) => run.includes('npm test'))).toBe(true)

    const figmaRuns =
      Object.values(ci.jobs ?? {})
        .find((job) => job.steps?.some((step) => step.name === 'TypeScript type check'))
        ?.steps?.map((step) => step.run ?? '') ?? []
    expect(figmaRuns.some((run) => run.includes('npm test'))).toBe(true)

    expect(runs.some((run) => run.includes('git diff --exit-code -- code.js'))).toBe(true)
    expect(runs.some((run) => run.includes('scripts/check-circular.mjs'))).toBe(true)
  })
})
