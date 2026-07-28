import https from 'https';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = 'Luo399';
const REPO = 'wenyan-platform';
const RUN_ID = process.argv[2] || '29304185973';

function fetch(url, headers) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
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

async function main() {
  console.log(`获取 Actions Run #${RUN_ID} 的日志...\n`);
  
  const jobsRes = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/actions/runs/${RUN_ID}/jobs`,
    { 'User-Agent': 'node', 'Authorization': `token ${GITHUB_TOKEN}` }
  );
  
  const jobs = JSON.parse(jobsRes.body);
  
  for (const job of jobs.jobs) {
    console.log(`=== ${job.name} (${job.status} - ${job.conclusion}) ===`);
    console.log(`Job ID: ${job.id}`);
    
    if (job.conclusion === 'failure') {
      const logsRes = await fetch(
        `https://api.github.com/repos/${OWNER}/${REPO}/actions/jobs/${job.id}/logs`,
        { 'User-Agent': 'node', 'Authorization': `token ${GITHUB_TOKEN}` }
      );
      
      const logs = logsRes.body;
      const lines = logs.split('\n').filter(line => line.includes('error') || line.includes('Error') || line.includes('FAIL') || line.includes('fail') || line.includes('Error:'));
      
      if (lines.length > 0) {
        console.log('\n错误信息:');
        lines.forEach(line => console.log(' ', line));
      } else {
        console.log('\n错误信息 (最后50行):');
        const lastLines = logs.split('\n').slice(-50);
        lastLines.forEach(line => console.log(' ', line));
      }
    }
    console.log('');
  }
}

main().catch(err => {
  console.error('❌ 获取日志失败:', err.message);
  process.exit(1);
});
