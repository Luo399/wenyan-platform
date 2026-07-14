import https from 'https';
import { execSync } from 'child_process';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = 'Luo399';
const REPO = 'wenyan-platform';

function fetch(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'node', ...headers } }, (res) => {
      if (res.statusCode === 302 && res.headers.location) {
        fetch(res.headers.location, {}).then(resolve).catch(reject);
        return;
      }
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
    });
    req.on('error', reject);
  });
}

async function getLatestRun(branch) {
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/actions/runs?branch=${branch}&per_page=1`,
    { 'Authorization': `token ${GITHUB_TOKEN}` }
  );
  return JSON.parse(res.body).workflow_runs[0];
}

async function getJobLogs(jobId) {
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/actions/jobs/${jobId}/logs`,
    { 'Authorization': `token ${GITHUB_TOKEN}` }
  );
  return res.body;
}

function parseErrors(logs) {
  const errorLines = logs.split('\n').filter(line => 
    line.includes('error') || line.includes('Error') || line.includes('FAIL') || 
    line.includes('fail') || line.includes('Error:') || line.includes('exit code 1')
  );
  return errorLines.slice(-30);
}

async function waitForRunComplete(runId, timeout = 300) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout * 1000) {
    const res = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/actions/runs/${runId}`,
      { 'Authorization': `token ${GITHUB_TOKEN}` }
    );
    const run = JSON.parse(res.body);
    
    if (run.status === 'completed') {
      return run;
    }
    
    console.log(`⏳ 等待 Actions 完成... (${run.status})`);
    await new Promise(resolve => setTimeout(resolve, 15000));
  }
  throw new Error('Actions 超时');
}

async function main() {
  if (!GITHUB_TOKEN) {
    console.error('❌ 请设置 GITHUB_TOKEN 环境变量');
    process.exit(1);
  }

  const branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
  console.log(`📤 当前分支: ${branch}`);

  console.log('\n📤 推送代码到远程...');
  try {
    const output = execSync('git push origin HEAD', { encoding: 'utf-8', stderr: 'inherit' });
    console.log(output);
  } catch (err) {
    console.error('❌ 推送失败:', err.message);
    process.exit(1);
  }

  console.log('\n🔍 获取最新 Actions Run...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  let run = await getLatestRun(branch);
  if (!run) {
    console.log('⏳ 等待 Actions 触发...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    run = await getLatestRun(branch);
  }

  if (!run) {
    console.error('❌ 无法获取 Actions Run');
    process.exit(1);
  }

  console.log(`🚀 Actions 已启动: ${run.html_url}`);
  console.log(`📊 状态: ${run.status}, 结果: ${run.conclusion || 'pending'}`);

  console.log('\n⏳ 等待 Actions 完成...');
  run = await waitForRunComplete(run.id);

  console.log(`\n📊 Actions 完成! 状态: ${run.status}, 结果: ${run.conclusion}`);

  if (run.conclusion === 'success') {
    console.log('✅ 所有测试通过!');
    process.exit(0);
  }

  console.log('\n❌ 测试失败，获取错误信息...');
  
  const jobsRes = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/actions/runs/${run.id}/jobs`,
    { 'Authorization': `token ${GITHUB_TOKEN}` }
  );
  const jobs = JSON.parse(jobsRes.body);

  for (const job of jobs.jobs) {
    if (job.conclusion === 'failure') {
      console.log(`\n=== ${job.name} ===`);
      const logs = await getJobLogs(job.id);
      const errors = parseErrors(logs);
      console.log('错误信息:');
      errors.forEach(line => console.log(' ', line));
    }
  }

  console.log('\n❌ Actions 失败，请手动修复后重新推送');
  process.exit(1);
}

main().catch(err => {
  console.error('❌ 执行失败:', err.message);
  process.exit(1);
});
