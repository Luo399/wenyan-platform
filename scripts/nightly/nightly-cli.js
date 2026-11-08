#!/usr/bin/env node
/**
 * wenyan-platform 夜间开发自动化 CLI
 *
 * 只负责「机械且必须确定性」的环节：环境前置、仓库同步、任务解析、分支拉取、
 * 本地校验、推送后 CI 轮询、递归合并、勾选与变更记录。
 * 「写业务代码」仍由夜间会话的 agent 完成。
 *
 * 用法：node scripts/nightly/nightly-cli.js <command> [args]
 * 规则来源：.trae/rules/project-workflow.md、.trae/rules/windows-shell-pitfalls-and-sync.md、
 *           rules/maintenance_standards.md
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import https from 'node:https';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OWNER = 'Luo399';
const REPO = 'wenyan-platform';
const REMOTE = `https://github.com/${OWNER}/${REPO}.git`;
const BASE_BRANCH = 'feature-1';
const TASKS_FILE = 'tasks/nightly-tasks.md';

// 红线：这些分支禁止作为推送/合并目标（main 只允许走 PR + 人工审批）
const PROTECTED = new Set(['main', 'master', 'develop', 'staging', 'release/staging']);

const PARENT_RE = /^##\s+\[([ xX])\]\s+(.+?)\s+\(([a-z0-9-]+)\)\s*$/;
const CHILD_RE = /^###\s+\[([ xX])\]\s+(.+?)\s+\(([a-z0-9-]+)\)\s*$/;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(...a);

class CliError extends Error {}

// ---------------------------------------------------------------- 进程执行

/** 本机 git 不在 PATH，MSYS2 的 git-remote-https 又需要 msys-2.0.dll —— 必须把 usr/bin 加进 PATH */
function resolveGit() {
  if (process.env.GIT_BIN && existsSync(process.env.GIT_BIN)) return process.env.GIT_BIN;
  if (process.platform === 'win32') {
    for (const c of ['C:\\msys64\\usr\\bin\\git.exe', 'C:\\Program Files\\Git\\cmd\\git.exe']) {
      if (existsSync(c)) return c;
    }
  }
  return 'git';
}

const GIT = resolveGit();
const GIT_DIR = path.dirname(GIT);

/**
 * Windows 上 process.env 的实际键名是 `Path` 而非 `PATH`。
 * 若直接 `{...process.env}` 再赋 `env.PATH`，会同时存在 `Path` 和 `PATH` 两个大小写重复键，
 * 子进程拿到的是被覆盖成只剩 GIT_DIR 的 PATH —— 于是 `npm run <script>` 里的 `node` 找不到。
 * 因此这里统一剔除所有大小写变体后重建 PATH，并把 git 目录与 node 目录显式注入。
 */
function childEnv(extra = {}) {
  const env = {};
  for (const k of Object.keys(process.env)) {
    if (k.toLowerCase() === 'path') continue;
    env[k] = process.env[k];
  }
  const basePath = process.env.Path || process.env.PATH || '';
  const nodeDir = path.dirname(process.execPath);
  env.PATH = [GIT_DIR, nodeDir, basePath].filter(Boolean).join(path.delimiter);
  Object.assign(env, extra);
  if (!env.HOME) env.HOME = process.env.USERPROFILE || '';
  return env;
}

function run(cmd, args, { cwd = ROOT, allowFail = false, env = {}, quiet = false } = {}) {
  const res = spawnSync(cmd, args, { cwd, env: childEnv(env), encoding: 'utf8' });
  const out = `${res.stdout || ''}${res.stderr || ''}`;
  if (!quiet && out.trim()) process.stdout.write(out);
  if (res.status !== 0 && !allowFail) {
    throw new CliError(`命令失败 (exit ${res.status}): ${cmd} ${args.join(' ')}`);
  }
  return { status: res.status, output: out };
}

function git(args, opts) {
  return run(GIT, ['-C', ROOT, ...args], opts);
}

/** 用 node 直接跑 npm-cli.js，规避 Windows 上 .cmd/.ps1 shim 的坑 */
function npm(args, opts = {}) {
  const cli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
  if (existsSync(cli)) return run(process.execPath, [cli, ...args], opts);
  return run(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, { ...opts, allowFail: opts.allowFail });
}

// ---------------------------------------------------------------- GitHub API

function getToken() {
  return process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
}

function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'wenyan-nightly', ...headers } }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ statusCode: res.statusCode, body }));
    });
    req.on('error', reject);
  });
}

async function apiGet(pathname, { auth = true } = {}) {
  const token = getToken();
  if (auth && !token) throw new CliError('缺少推送凭证：请设置环境变量 GITHUB_TOKEN 或 GH_TOKEN');
  const headers = auth ? { Authorization: `token ${token}` } : {};
  const res = await httpsGet(`https://api.github.com${pathname}`, headers);
  if (res.statusCode === 401 || res.statusCode === 403) {
    throw new CliError(`GitHub API ${res.statusCode}：缺少推送凭证或权限不足`);
  }
  if (res.statusCode === 404 && !auth) throw new CliError(`GitHub API 404：仓库 ${OWNER}/${REPO} 不可访问`);
  if (res.statusCode >= 400) throw new CliError(`GitHub API ${res.statusCode}: ${res.body.slice(0, 300)}`);
  return JSON.parse(res.body);
}

const OK_CONCLUSIONS = new Set(['success', 'skipped', 'neutral']);

/**
 * 等待某个 SHA 触发的「全部」workflow 结束。
 * - 该 SHA 没有任何 run（路径过滤未命中）→ 宽限期后返回 triggered:false，不无限等待。
 * - 任一 conclusion 非 success/skipped/neutral → 打印失败 job 日志并抛错。
 */
async function waitAllRuns(branch, sha, { timeoutMin = 60, graceSec = 60 } = {}) {
  const deadline = Date.now() + timeoutMin * 60_000;
  const grace = Date.now() + graceSec * 1_000;
  let runs = [];

  while (Date.now() < deadline) {
    const data = await apiGet(
      `/repos/${OWNER}/${REPO}/actions/runs?branch=${encodeURIComponent(branch)}&per_page=50`,
    );
    runs = (data.workflow_runs || []).filter((r) => r.head_sha === sha);

    if (runs.length === 0) {
      if (Date.now() > grace) {
        log(`ℹ️  ${branch}@${sha.slice(0, 7)} 未触发任何 workflow（可能未命中 CI 路径过滤），跳过轮询`);
        return { triggered: false, runs: [] };
      }
      await sleep(10_000);
      continue;
    }

    const pending = runs.filter((r) => r.status !== 'completed');
    log(`⏳ ${branch}@${sha.slice(0, 7)} 共 ${runs.length} 个 workflow，未完成 ${pending.length} 个`);
    if (pending.length === 0) break;
    await sleep(15_000);
  }

  if (runs.length && runs.some((r) => r.status !== 'completed')) {
    throw new CliError(`CI 轮询超时（${timeoutMin} 分钟），仍有 workflow 未完成`);
  }

  const bad = runs.filter((r) => !OK_CONCLUSIONS.has(r.conclusion));
  for (const r of runs) {
    log(`   ${r.conclusion === 'success' ? '✅' : OK_CONCLUSIONS.has(r.conclusion) ? '➖' : '❌'} ${r.name} — ${r.conclusion || r.status}`);
  }
  if (bad.length) {
    await dumpFailureLogs(bad);
    throw new CliError(`${bad.length} 个 workflow 失败：${bad.map((r) => r.name).join(', ')}`);
  }
  return { triggered: true, runs };
}

async function dumpFailureLogs(runs) {
  for (const r of runs) {
    log(`\n=== 失败 workflow：${r.name} (${r.html_url}) ===`);
    try {
      const jobs = await apiGet(`/repos/${OWNER}/${REPO}/actions/runs/${r.id}/jobs`);
      for (const job of jobs.jobs || []) {
        if (job.conclusion === 'failure') {
          log(`--- job: ${job.name} ---`);
          const res = await httpsGet(
            `https://api.github.com/repos/${OWNER}/${REPO}/actions/jobs/${job.id}/logs`,
            { 'User-Agent': 'wenyan-nightly', Authorization: `token ${getToken()}` },
          );
          const lines = res.body.split('\n');
          const errs = lines.filter((l) => /error|Error|FAIL|fail|exit code/.test(l));
          (errs.length ? errs : lines).slice(-40).forEach((l) => log(`   ${l}`));
        }
      }
    } catch (e) {
      log(`   （拉取日志失败：${e.message}）`);
    }
  }
}

// ---------------------------------------------------------------- 任务解析

function parseTasks() {
  const file = path.join(ROOT, TASKS_FILE);
  if (!existsSync(file)) throw new CliError(`任务清单不存在：${TASKS_FILE}（今夜无新任务）`);

  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  const parents = [];
  let current = null;

  lines.forEach((line, idx) => {
    const p = line.match(PARENT_RE);
    if (p) {
      current = { done: p[1].toLowerCase() === 'x', title: p[2].trim(), slug: p[3], line: idx, children: [] };
      parents.push(current);
      return;
    }
    const c = line.match(CHILD_RE);
    if (c) {
      if (!current) throw new CliError(`第 ${idx + 1} 行出现子功能但没有父功能：${line}`);
      current.children.push({ done: c[1].toLowerCase() === 'x', title: c[2].trim(), slug: c[3], line: idx });
    }
  });

  return parents;
}

function findParent(slug) {
  const parent = parseTasks().find((p) => p.slug === slug);
  if (!parent) throw new CliError(`任务清单中找不到父功能 slug：${slug}`);
  return parent;
}

/**
 * 分支命名：父功能 `feature/<父slug>/main`，子功能 `feature/<父slug>/<子slug>`。
 *
 * 为什么父分支不是 `feature/<父slug>`：git 的 ref 以文件形式存放，
 * 一旦存在 refs/heads/feature/X（文件），就无法再创建 refs/heads/feature/X/Y（需要同名目录），
 * 会报 "cannot lock ref ... 'refs/heads/feature/X' exists"。
 * 因此父分支必须占一层叶子名，这与仓库既有先例 `data-pipeline/main` + 子分支一致。
 */
const branchOf = (parentSlug, childSlug) =>
  childSlug ? `feature/${parentSlug}/${childSlug}` : `feature/${parentSlug}/main`;

function assertNotProtected(branch) {
  if (PROTECTED.has(branch)) {
    throw new CliError(`红线：禁止直接推送或合并到受保护分支 ${branch}（main 只允许走 PR + 人工审批）`);
  }
}

// ---------------------------------------------------------------- 子命令

const commands = {
  async preflight() {
    const problems = [];

    log('▶ 检查 git');
    const v = run(GIT, ['--version'], { allowFail: true, quiet: true });
    if (v.status !== 0) problems.push('git 不可用');
    else log(`   ✅ ${v.output.trim()}`);

    log('▶ 检查远端可达性');
    const ls = git(['ls-remote', '--heads', REMOTE, BASE_BRANCH], { allowFail: true, quiet: true });
    if (ls.status !== 0) problems.push('无法访问远端仓库（git ls-remote 失败）');
    else log('   ✅ 远端可达');

    log('▶ 检查推送凭证');
    const token = getToken();
    if (!token) {
      problems.push('缺少推送凭证：GITHUB_TOKEN 与 GH_TOKEN 均未设置');
      log('   ❌ 缺少推送凭证');
    } else {
      try {
        const repo = await apiGet(`/repos/${OWNER}/${REPO}`);
        log(`   ✅ token 可用（${repo.full_name}）`);
        const perms = repo.permissions || {};
        if (!perms.push) log('   ⚠️  token 可能没有 push 权限（permissions.push = false）');
      } catch (e) {
        problems.push(`token 校验失败：${e.message}`);
      }
    }

    log('▶ 检查 pre-push hook');
    const hooks = git(['config', 'core.hooksPath'], { allowFail: true, quiet: true }).output.trim();
    log(hooks ? `   ⚠️  core.hooksPath = ${hooks}（推送时可能触发 hook）` : '   ✅ 未启用 hooksPath');

    log('▶ 检查 node');
    log(`   ✅ node ${process.version}`);
    const major = Number(process.version.slice(1).split('.')[0]);
    const minor = Number(process.version.split('.')[1]);
    if (major < 22 || (major === 22 && minor < 12)) {
      if (!(major === 20 && minor >= 19)) problems.push(`node ${process.version} 不满足 engines ^20.19.0 || >=22.12.0`);
    }

    if (problems.length) {
      log('\n❌ preflight 未通过：');
      problems.forEach((p) => log(`   - ${p}`));
      process.exit(1);
    }
    log('\n✅ preflight 全部通过');
  },

  async sync() {
    git(['fetch', '--all', '--prune', '--no-tags']);
    const local = git(['rev-parse', '--verify', '--quiet', `refs/heads/${BASE_BRANCH}`], { allowFail: true, quiet: true });
    if (local.status === 0) {
      git(['checkout', BASE_BRANCH]);
      git(['reset', '--hard', `origin/${BASE_BRANCH}`]);
    } else {
      git(['checkout', '-b', BASE_BRANCH, `origin/${BASE_BRANCH}`]);
    }
    log(`✅ ${BASE_BRANCH} 已同步到 ${git(['rev-parse', '--short', 'HEAD'], { quiet: true }).output.trim()}`);
  },

  async plan() {
    const parents = parseTasks();
    const todo = parents
      .filter((p) => !p.done || p.children.some((c) => !c.done))
      .map((p) => ({
        parent: { title: p.title, slug: p.slug, done: p.done, branch: branchOf(p.slug) },
        children: p.children
          .filter((c) => !c.done)
          .map((c) => ({ title: c.title, slug: c.slug, branch: branchOf(p.slug, c.slug) })),
      }));

    if (!todo.length) {
      log('今夜无新任务（所有条目均已完成）');
      process.exit(0);
    }
    log(JSON.stringify({ pending: todo.length, tasks: todo }, null, 2));
  },

  async start(parentSlug, childSlug) {
    const parent = findParent(parentSlug);
    if (childSlug && !parent.children.some((c) => c.slug === childSlug)) {
      throw new CliError(`父功能 ${parentSlug} 下找不到子功能 slug：${childSlug}`);
    }
    if (childSlug === 'main') {
      throw new CliError("子功能 slug 不能为 'main'（与父分支 feature/<父slug>/main 冲突）");
    }

    const branch = branchOf(parentSlug, childSlug);
    const base = childSlug ? branchOf(parentSlug) : BASE_BRANCH;
    assertNotProtected(branch);

    git(['fetch', '--all', '--prune', '--no-tags']);
    const exists = git(['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`], { allowFail: true, quiet: true }).status === 0;
    const baseRef = git(['rev-parse', '--verify', '--quiet', `refs/heads/${base}`], { allowFail: true, quiet: true }).status === 0
      ? base
      : `origin/${base}`;

    if (exists) {
      git(['checkout', branch]);
      git(['rebase', baseRef]);
      log(`✅ 已复用并 rebase：${branch} ← ${baseRef}`);
    } else {
      git(['checkout', '-b', branch, baseRef]);
      log(`✅ 已创建：${branch} ← ${baseRef}`);
    }
  },

  /**
   * 本地校验口径严格对齐 .github/workflows/ci-checks.yml：
   *   阻断项（CI 中会让 job 失败）= 前端 type-check、backend `node -c server.js`、backend `npm test`
   *   参考项（CI 中不阻断或未纳入 CI）= 前端 lint（CI 为 continue-on-error）、前端 vitest（CI 未运行）
   * 只有阻断项失败才退出 1。参考项失败仅告警 —— 避免被仓库既有的 lint/vitest 历史失败卡死。
   */
  async check() {
    const results = [];
    const step = (name, gate, fn) => results.push({ name, gate, ok: fn().status === 0 });

    log('▶ 阻断项（与 CI 一致）');
    step('frontend: npm run type-check', true, () => npm(['run', 'type-check'], { allowFail: true }));
    step('backend: node -c server.js', true, () =>
      run(process.execPath, ['-c', 'server.js'], { cwd: path.join(ROOT, 'backend'), allowFail: true }),
    );
    step('backend: npm test', true, () =>
      npm(['test'], {
        cwd: path.join(ROOT, 'backend'),
        allowFail: true,
        env: { NODE_ENV: 'test', DB_PATH: ':memory:', JWT_SECRET: 'ci-test-secret', AUTH_SECRET: '' },
      }),
    );

    log('\n▶ 参考项（CI 中不阻断或未纳入 CI）');
    step('frontend: npm run lint (CI: continue-on-error)', false, () => npm(['run', 'lint'], { allowFail: true }));
    step('frontend: npm test (CI 未运行 vitest)', false, () => npm(['test'], { allowFail: true }));

    log('');
    for (const r of results) log(`${r.ok ? '✅' : r.gate ? '❌' : '⚠️'} ${r.name}`);

    const gateFails = results.filter((r) => r.gate && !r.ok);
    const warnFails = results.filter((r) => !r.gate && !r.ok);

    if (warnFails.length) {
      log(`\n⚠️  参考项未通过 ${warnFails.length} 项（不阻断提交）：`);
      warnFails.forEach((w) => log(`   - ${w.name}`));
    }
    if (gateFails.length) {
      log(`\n❌ 阻断项未通过 ${gateFails.length} 项：`);
      gateFails.forEach((f) => log(`   - ${f.name}`));
      process.exit(1);
    }
    log('\n✅ 阻断项全部通过（与 CI 等价）');
  },

  async 'push-wait'() {
    const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], { quiet: true }).output.trim();
    assertNotProtected(branch);
    git(['push', '-u', 'origin', 'HEAD']);
    const sha = git(['rev-parse', 'HEAD'], { quiet: true }).output.trim();
    await waitAllRuns(branch, sha);
    log(`\n✅ ${branch}@${sha.slice(0, 7)} CI 全部通过`);
  },

  async merge(from, into, ...flags) {
    if (!from || !into) throw new CliError('用法：merge <from-branch> <into-branch> [--delete-remote <branch>]');
    assertNotProtected(into);

    git(['fetch', '--all', '--prune', '--no-tags']);
    git(['checkout', into]);
    const hasUpstream = git(['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${into}`], { allowFail: true, quiet: true }).status === 0;
    if (hasUpstream) git(['reset', '--hard', `origin/${into}`]);
    git(['merge', '--no-ff', from, '-m', `merge(${into}): 合并 ${from} 到 ${into}`]);
    git(['push', 'origin', into]);

    const sha = git(['rev-parse', 'HEAD'], { quiet: true }).output.trim();
    await waitAllRuns(into, sha);

    const delIdx = flags.indexOf('--delete-remote');
    if (delIdx !== -1 && flags[delIdx + 1]) {
      const target = flags[delIdx + 1];
      assertNotProtected(target);
      git(['push', 'origin', '--delete', target], { allowFail: true });
      log(`🧹 已删除远端分支 ${target}`);
    }
    log(`\n✅ 已合并 ${from} → ${into}（${sha.slice(0, 7)}），CI 通过`);
  },

  async finish(...slugs) {
    const parentSlugs = slugs.filter(Boolean);
    if (!parentSlugs.length) throw new CliError('用法：finish <parentSlug> [childSlug...]');

    const file = path.join(ROOT, TASKS_FILE);
    let text = readFileSync(file, 'utf8');
    const parents = parseTasks();

    for (const slug of parentSlugs) {
      const parent = parents.find((p) => p.slug === slug);
      if (parent) {
        const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], { quiet: true }).output.trim();
        const sha = git(['rev-parse', '--short', 'HEAD'], { quiet: true }).output.trim();
        const note = `- 分支 \`${branch}\` / commit \`${sha}\` / 完成于 ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;
        text = text.replace(
          new RegExp(`(^##\\s+\\[ \\]\\s+.*\\(${slug}\\)\\s*$)`, 'm'),
          (m) => `${m}\n\n${note}`,
        );
        if (parent.children.length && parent.children.every((c) => c.done)) {
          text = text.replace(new RegExp(`(^##\\s+)\\[ \\](\\s+.*\\(${slug}\\))`, 'm'), '$1[x]$2');
        }
      }
      const child = parents.flatMap((p) => p.children).find((c) => c.slug === slug);
      if (child) {
        text = text.replace(new RegExp(`(^###\\s+)\\[ \\](\\s+.*\\(${slug}\\))`, 'm'), '$1[x]$2');
      }
    }
    writeFileSync(file, text);
    log(`✅ 已回写 ${TASKS_FILE}`);

    const today = new Date();
    const stamp = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const logDir = path.join(ROOT, 'docs', 'maintenance', 'changelog');
    const logFile = path.join(logDir, `changelog-${stamp}.md`);

    if (!existsSync(logFile)) {
      const since = `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)} 00:00`;
      const commits = git(['log', '--all', `--since=${since}`, '--pretty=format:%h%x09%s'], { allowFail: true, quiet: true })
        .output.trim()
        .split('\n')
        .filter(Boolean)
        .map((l) => l.split('\t'));

      const rows = commits.length
        ? commits.map(([sha, subject]) => {
            const m = subject.match(/^(\w+)(?:\(([^)]*)\))?:\s*(.*)$/);
            const [, type = 'chore', scope = '-', desc = subject] = m || [];
            return `| ${sha} | ${type} | ${scope} | ${desc} | 已通过 | 待上线 |`;
          })
        : ['| - | - | - | 今夜无新任务 | - | - |'];

      writeFileSync(
        logFile,
        [
          `# 变更记录 ${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}`,
          '',
          '> 依据 `rules/maintenance_standards.md` 4.5.1 / 4.5.3 生成。',
          '',
          '| 变更编号 | 变更类型 | 影响范围 | 变更描述 | 测试状态 | 上线状态 |',
          '|---|---|---|---|---|---|',
          ...rows,
          '',
          '## 夜间任务产出',
          '',
          ...parentSlugs.map((s) => `- ${s}`),
          '',
        ].join('\n'),
      );
      log(`✅ 已生成 ${path.relative(ROOT, logFile)}`);
    } else {
      log(`ℹ️  ${path.relative(ROOT, logFile)} 已存在，未覆盖`);
    }
  },
};

// ---------------------------------------------------------------- 入口

const [cmd, ...args] = process.argv.slice(2);

if (!cmd || cmd === '--help' || cmd === '-h') {
  log(`wenyan-platform 夜间开发 CLI

  preflight                  环境前置检查（git / 远端 / 凭证 / hook / node），未通过退出 1
  sync                       同步 ${BASE_BRANCH} 到远端最新
  plan                       解析 ${TASKS_FILE}，输出未完成的父/子功能（JSON）
  start <父slug> [子slug]     拉取父分支 feature/<父slug>/main 或子分支 feature/<父slug>/<子slug>
  check                      本地等价校验：阻断项=type-check + backend node -c + backend test；
                             lint/vitest 为参考项（CI 中不阻断/未运行），仅告警
  push-wait                  推送当前分支并轮询该 SHA 的全部 workflow 至 completed
  merge <from> <into> [--delete-remote <branch>]
                             将 from --no-ff 合并进 into、推送并轮询 CI
  finish <slug>...           勾选任务条目并生成 docs/maintenance/changelog/changelog-YYYYMMDD.md`);
  process.exit(cmd ? 0 : 1);
}

const fn = commands[cmd];
if (!fn) {
  console.error(`未知子命令：${cmd}（用 --help 查看用法）`);
  process.exit(1);
}

fn(...args).catch((e) => {
  console.error(`\n❌ ${e instanceof CliError ? e.message : e.stack || e.message}`);
  process.exit(1);
});