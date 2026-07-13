import https from 'https';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = 'Luo399';
const REPO = 'wenyan-platform';
const BRANCH = 'main';

if (!GITHUB_TOKEN) {
  console.error('❌ 请设置 GITHUB_TOKEN 环境变量');
  console.error('');
  console.error('获取方式: https://github.com/settings/tokens');
  console.error('需要的权限: repo (所有子权限)');
  process.exit(1);
}

const options = {
  hostname: 'api.github.com',
  path: `/repos/${OWNER}/${REPO}/branches/${BRANCH}/protection`,
  method: 'PUT',
  headers: {
    'User-Agent': 'Node.js',
    'Authorization': `token ${GITHUB_TOKEN}`,
    'Content-Type': 'application/json',
  },
};

const body = JSON.stringify({
  required_pull_request_reviews: {
    required_approving_review_count: 1,
  },
  required_status_checks: {
    strict: true,
    contexts: [],
  },
  enforce_admins: true,
  restrictions: null,
});

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      console.log('✅ 分支保护规则设置成功');
      console.log('');
      console.log('已启用的保护规则:');
      console.log('- ✅ 必须通过 Pull Request 合并');
      console.log('- ✅ 需要至少 1 个审核通过');
      console.log('- ✅ 需要状态检查通过');
      console.log('- ✅ 管理员强制执行');
    } else {
      console.error('❌ 设置失败');
      console.error(`状态码: ${res.statusCode}`);
      try {
        const error = JSON.parse(data);
        console.error('错误信息:', error.message || error);
      } catch {
        console.error('响应:', data);
      }
    }
  });
});

req.on('error', (e) => {
  console.error('❌ 请求失败:', e.message);
});

req.write(body);
req.end();
